use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer},
};
use ephemeral_rollups_sdk::{
    anchor::{commit, delegate, ephemeral},
    cpi::DelegateConfig,
    ephem::MagicIntentBundleBuilder,
};
use magicblock_magic_program_api::{args::ScheduleTaskArgs, instruction::MagicBlockInstruction};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use session_keys::{session_auth_or, Session, SessionError, SessionTokenV2};

use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
};

// Dedicated Forge Syndicates program. The existing result_registry deployment
// intentionally remains independent.
declare_id!("HPNkzwiFHbWtCJLRhp7oKE1iHttjxCWvDsjtNHT9o1ZM");

const CONFIG_SEED: &[u8] = b"syndicate-config";
const MINT_SEED: &[u8] = b"fusd-mint";
const FAUCET_SEED: &[u8] = b"faucet";
const SYNDICATE_SEED: &[u8] = b"syndicate";
const MEMBER_SEED: &[u8] = b"member";
const SESSION_SEED: &[u8] = b"syndicate-session";
const SETTLEMENT_SEED: &[u8] = b"settlement";
const FAUCET_AMOUNT: u64 = 10_000_000_000;
const SESSION_SECONDS: i64 = 600;
const MAX_TRADES: u16 = 120;
const MAX_TRADE_BPS: u64 = 1_000;
const MAX_ASSET_BPS: u64 = 4_000;
const MAX_DRAWDOWN_BPS: u64 = 2_000;
const PERFORMANCE_FEE_BPS: u64 = 1_000;
const SHARE_SCALE: u128 = 1_000_000;
const ORACLE_MAX_AGE_SECONDS: u64 = 5;

#[ephemeral]
#[program]
pub mod forge_syndicates {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        args: InitializeConfigArgs,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.mint = ctx.accounts.fusd_mint.key();
        config.bump = ctx.bumps.config;
        config.mint_bump = ctx.bumps.fusd_mint;
        config.paused = false;
        config.feed_ids = args.feed_ids;
        Ok(())
    }

    pub fn claim_fusd(ctx: Context<ClaimFusd>) -> Result<()> {
        require!(!ctx.accounts.config.paused, SyndicateError::ProtocolPaused);
        let config = &ctx.accounts.config;
        let signer: &[&[u8]] = &[CONFIG_SEED, &[config.bump]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                MintTo {
                    mint: ctx.accounts.fusd_mint.to_account_info(),
                    to: ctx.accounts.recipient_ata.to_account_info(),
                    authority: config.to_account_info(),
                },
                &[signer],
            ),
            FAUCET_AMOUNT,
        )?;
        ctx.accounts.receipt.authority = ctx.accounts.authority.key();
        ctx.accounts.receipt.claimed_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn create_syndicate(
        ctx: Context<CreateSyndicate>,
        nonce: u64,
        name: [u8; 32],
    ) -> Result<()> {
        let syndicate = &mut ctx.accounts.syndicate;
        syndicate.trader = ctx.accounts.trader.key();
        syndicate.mint = ctx.accounts.fusd_mint.key();
        syndicate.vault = ctx.accounts.vault.key();
        syndicate.nonce = nonce;
        syndicate.name = name;
        syndicate.bump = ctx.bumps.syndicate;
        syndicate.status = Syndicate::IDLE;
        syndicate.high_water_price_e6 = 1_000_000;
        syndicate.created_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, SyndicateError::InvalidAmount);
        let syndicate = &mut ctx.accounts.syndicate;
        require!(
            syndicate.status == Syndicate::IDLE,
            SyndicateError::SessionActive
        );
        let pre_balance = ctx.accounts.vault.amount;
        let shares = shares_for_deposit(amount, syndicate.total_shares, pre_balance)?;
        require!(shares > 0, SyndicateError::ZeroShares);
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.depositor_ata.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            amount,
        )?;
        let member = &mut ctx.accounts.member;
        if member.authority == Pubkey::default() {
            member.authority = ctx.accounts.depositor.key();
            member.syndicate = syndicate.key();
            member.bump = ctx.bumps.member;
            syndicate.backer_count = syndicate
                .backer_count
                .checked_add(1)
                .ok_or(SyndicateError::MathOverflow)?;
        }
        member.shares = member
            .shares
            .checked_add(shares)
            .ok_or(SyndicateError::MathOverflow)?;
        member.total_deposited = member
            .total_deposited
            .checked_add(amount)
            .ok_or(SyndicateError::MathOverflow)?;
        syndicate.total_shares = syndicate
            .total_shares
            .checked_add(shares)
            .ok_or(SyndicateError::MathOverflow)?;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        require!(
            shares > 0 && shares <= ctx.accounts.member.shares,
            SyndicateError::InvalidShares
        );
        let syndicate = &mut ctx.accounts.syndicate;
        require!(
            syndicate.status == Syndicate::IDLE,
            SyndicateError::SessionActive
        );
        let amount =
            tokens_for_withdrawal(shares, syndicate.total_shares, ctx.accounts.vault.amount)?;
        require!(amount > 0, SyndicateError::InvalidAmount);
        let signer: &[&[u8]] = &[
            SYNDICATE_SEED,
            syndicate.trader.as_ref(),
            &syndicate.nonce.to_le_bytes(),
            &[syndicate.bump],
        ];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.recipient_ata.to_account_info(),
                    authority: syndicate.to_account_info(),
                },
                &[signer],
            ),
            amount,
        )?;
        ctx.accounts.member.shares = ctx
            .accounts
            .member
            .shares
            .checked_sub(shares)
            .ok_or(SyndicateError::MathOverflow)?;
        ctx.accounts.member.total_withdrawn = ctx
            .accounts
            .member
            .total_withdrawn
            .checked_add(amount)
            .ok_or(SyndicateError::MathOverflow)?;
        syndicate.total_shares = syndicate
            .total_shares
            .checked_sub(shares)
            .ok_or(SyndicateError::MathOverflow)?;
        Ok(())
    }

    pub fn start_session(ctx: Context<StartSession>, args: StartSessionArgs) -> Result<()> {
        require!(!ctx.accounts.config.paused, SyndicateError::ProtocolPaused);
        let syndicate = &mut ctx.accounts.syndicate;
        require!(
            syndicate.status == Syndicate::IDLE,
            SyndicateError::SessionActive
        );
        require!(
            ctx.accounts.vault.amount > 0 && syndicate.total_shares > 0,
            SyndicateError::EmptyPool
        );
        let now = Clock::get()?.unix_timestamp;
        let session = &mut ctx.accounts.session;
        session.syndicate = syndicate.key();
        session.trader = ctx.accounts.trader.key();
        session.nonce = args.nonce;
        session.bump = ctx.bumps.session;
        session.status = SyndicateSession::ACTIVE;
        session.started_at = now;
        session.expires_at = now
            .checked_add(SESSION_SECONDS)
            .ok_or(SyndicateError::MathOverflow)?;
        session.starting_equity = ctx.accounts.vault.amount;
        session.cash = ctx.accounts.vault.amount;
        session.peak_equity = ctx.accounts.vault.amount;
        session.equity = ctx.accounts.vault.amount;
        session.crank_task_id = args.crank_task_id;
        session.feed_ids = ctx.accounts.config.feed_ids;
        syndicate.status = Syndicate::ACTIVE;
        syndicate.active_session_nonce = args.nonce;
        Ok(())
    }

    pub fn delegate_session(ctx: Context<DelegateSession>, nonce: u64) -> Result<()> {
        ctx.accounts.delegate_session(
            &ctx.accounts.trader,
            &[
                SESSION_SEED,
                ctx.accounts.syndicate.key().as_ref(),
                &nonce.to_le_bytes(),
            ],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|a| a.key()),
                ..DelegateConfig::default()
            },
        )?;
        Ok(())
    }

    /// Registers a one-shot ER task that freezes the session after ten minutes.
    /// `expire_session` is monotonic and permissionless, so scheduler retries are safe.
    pub fn schedule_expiry<'info>(
        ctx: Context<'info, ScheduleExpiry<'info>>,
        nonce: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.session.nonce == nonce,
            SyndicateError::InvalidSession
        );
        let expire_ix = Instruction {
            program_id: crate::ID,
            accounts: vec![AccountMeta::new(ctx.accounts.session.key(), false)],
            data: anchor_lang::InstructionData::data(&crate::instruction::ExpireSession {}),
        };
        let schedule_ix = Instruction::new_with_bincode(
            ctx.accounts.magic_program.key(),
            &MagicBlockInstruction::ScheduleTask(ScheduleTaskArgs {
                task_id: ctx.accounts.session.crank_task_id,
                execution_interval_millis: SESSION_SECONDS * 1_000,
                // The scheduler executes once immediately. That first call is
                // an idempotent early check; the second runs after the interval.
                iterations: 2,
                instructions: vec![expire_ix],
            }),
            vec![
                AccountMeta::new(ctx.accounts.payer.key(), true),
                AccountMeta::new(ctx.accounts.payer.key(), true),
                AccountMeta::new(ctx.accounts.session.key(), false),
            ],
        );
        invoke(
            &schedule_ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.session.to_account_info(),
            ],
        )?;
        Ok(())
    }

    #[session_auth_or(
        ctx.accounts.session.trader == ctx.accounts.actor.key(),
        SessionError::InvalidToken
    )]
    pub fn trade(ctx: Context<Trade>, args: TradeArgs) -> Result<()> {
        let session = &mut ctx.accounts.session;
        require!(
            session.status == SyndicateSession::ACTIVE,
            SyndicateError::SessionNotActive
        );
        require!(
            Clock::get()?.unix_timestamp <= session.expires_at,
            SyndicateError::SessionExpired
        );
        require!(
            args.asset <= 1
                && args.side <= 1
                && args.quantity_micro > 0
                && args.expected_price_micro > 0,
            SyndicateError::InvalidTrade
        );
        require!(session.trade_count < MAX_TRADES, SyndicateError::TradeLimit);
        require!(args.max_slippage_bps <= 100, SyndicateError::InvalidTrade);
        let oracle = ctx
            .accounts
            .price_update
            .get_price_no_older_than(
                &Clock::get()?,
                ORACLE_MAX_AGE_SECONDS,
                &session.feed_ids[args.asset as usize],
            )
            .map_err(|_| error!(SyndicateError::InvalidOracle))?;
        let price_micro = price_to_micro(oracle.price, oracle.exponent)?;
        require_slippage(
            price_micro,
            args.expected_price_micro,
            args.max_slippage_bps,
        )?;
        let notional = mul_div(args.quantity_micro, price_micro, 1_000_000)?;
        require!(notional >= 1_000_000, SyndicateError::MinimumTrade);
        require!(
            notional <= bps_of(session.equity, MAX_TRADE_BPS)?,
            SyndicateError::TradeTooLarge
        );
        let index = args.asset as usize;
        if args.side == 0 {
            require!(session.cash >= notional, SyndicateError::InsufficientCash);
            let next_value = position_value(
                session.positions[index]
                    .quantity_micro
                    .checked_add(args.quantity_micro)
                    .ok_or(SyndicateError::MathOverflow)?,
                price_micro,
            )?;
            require!(
                next_value <= bps_of(session.equity, MAX_ASSET_BPS)?,
                SyndicateError::AssetLimit
            );
            session.cash = session
                .cash
                .checked_sub(notional)
                .ok_or(SyndicateError::MathOverflow)?;
            session.positions[index].quantity_micro = session.positions[index]
                .quantity_micro
                .checked_add(args.quantity_micro)
                .ok_or(SyndicateError::MathOverflow)?;
            session.positions[index].cost_micro = session.positions[index]
                .cost_micro
                .checked_add(notional)
                .ok_or(SyndicateError::MathOverflow)?;
        } else {
            require!(
                session.positions[index].quantity_micro >= args.quantity_micro,
                SyndicateError::InsufficientPosition
            );
            let held = session.positions[index].quantity_micro;
            let released_cost = mul_div(
                session.positions[index].cost_micro,
                args.quantity_micro,
                held,
            )?;
            session.positions[index].quantity_micro = held
                .checked_sub(args.quantity_micro)
                .ok_or(SyndicateError::MathOverflow)?;
            session.positions[index].cost_micro = session.positions[index]
                .cost_micro
                .checked_sub(released_cost)
                .ok_or(SyndicateError::MathOverflow)?;
            session.cash = session
                .cash
                .checked_add(notional)
                .ok_or(SyndicateError::MathOverflow)?;
        }
        session.last_prices_micro[index] = price_micro;
        mark_equity(session)?;
        require!(
            session.drawdown_bps <= MAX_DRAWDOWN_BPS,
            SyndicateError::DrawdownLimit
        );
        session.trade_count = session
            .trade_count
            .checked_add(1)
            .ok_or(SyndicateError::MathOverflow)?;
        emit!(TradeExecuted {
            session: session.key(),
            sequence: session.trade_count,
            asset: args.asset,
            side: args.side,
            quantity_micro: args.quantity_micro,
            price_micro,
            equity_micro: session.equity,
            executed_at: Clock::get()?.unix_timestamp
        });
        Ok(())
    }

    pub fn expire_session(ctx: Context<ExpireSession>) -> Result<()> {
        let session = &mut ctx.accounts.session;
        if session.status == SyndicateSession::ACTIVE
            && Clock::get()?.unix_timestamp >= session.expires_at
        {
            session.status = SyndicateSession::FROZEN;
        }
        Ok(())
    }

    pub fn finalize_session(ctx: Context<FinalizeSession>) -> Result<()> {
        let session = &mut ctx.accounts.session;
        require!(
            session.status == SyndicateSession::FROZEN
                || Clock::get()?.unix_timestamp >= session.expires_at,
            SyndicateError::SessionNotExpired
        );
        session.status = SyndicateSession::COMMITTING;
        // Persist before the commit CPI transfers ownership to the Delegation
        // Program; this prevents Anchor's exit hook from writing stale data.
        session.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[session.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn settle_session(ctx: Context<SettleSession>) -> Result<()> {
        let syndicate = &mut ctx.accounts.syndicate;
        let session = &ctx.accounts.session;
        require!(
            syndicate.status == Syndicate::ACTIVE
                && syndicate.active_session_nonce == session.nonce,
            SyndicateError::InvalidSession
        );
        let settlement = calculate_settlement(
            session.starting_equity,
            session.equity,
            syndicate.total_shares,
            syndicate.high_water_price_e6,
        )?;
        let syndicate_signer: &[&[u8]] = &[
            SYNDICATE_SEED,
            syndicate.trader.as_ref(),
            &syndicate.nonce.to_le_bytes(),
            &[syndicate.bump],
        ];
        let config = &ctx.accounts.config;
        let config_signer: &[&[u8]] = &[CONFIG_SEED, &[config.bump]];
        if settlement.mint_amount > 0 {
            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    MintTo {
                        mint: ctx.accounts.fusd_mint.to_account_info(),
                        to: ctx.accounts.vault.to_account_info(),
                        authority: config.to_account_info(),
                    },
                    &[config_signer],
                ),
                settlement.mint_amount,
            )?;
        }
        if settlement.burn_amount > 0 {
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    Burn {
                        mint: ctx.accounts.fusd_mint.to_account_info(),
                        from: ctx.accounts.vault.to_account_info(),
                        authority: syndicate.to_account_info(),
                    },
                    &[syndicate_signer],
                ),
                settlement.burn_amount,
            )?;
        }
        if settlement.fee_amount > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.trader_ata.to_account_info(),
                        authority: syndicate.to_account_info(),
                    },
                    &[syndicate_signer],
                ),
                settlement.fee_amount,
            )?;
        }
        syndicate.high_water_price_e6 = settlement.next_high_water_price_e6;
        syndicate.total_fees = syndicate
            .total_fees
            .checked_add(settlement.fee_amount)
            .ok_or(SyndicateError::MathOverflow)?;
        syndicate.session_count = syndicate
            .session_count
            .checked_add(1)
            .ok_or(SyndicateError::MathOverflow)?;
        syndicate.max_drawdown_bps = syndicate.max_drawdown_bps.max(session.drawdown_bps as u16);
        syndicate.status = Syndicate::IDLE;
        ctx.accounts.receipt.session = session.key();
        ctx.accounts.receipt.gross_pnl = session.equity as i128 - session.starting_equity as i128;
        ctx.accounts.receipt.mint_amount = settlement.mint_amount;
        ctx.accounts.receipt.burn_amount = settlement.burn_amount;
        ctx.accounts.receipt.fee_amount = settlement.fee_amount;
        ctx.accounts.receipt.settled_at = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + SyndicateConfig::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, SyndicateConfig>,
    #[account(init, payer = admin, seeds = [MINT_SEED], bump, mint::decimals = 6, mint::authority = config)]
    pub fusd_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeConfigArgs {
    pub feed_ids: [[u8; 32]; 2],
}

#[derive(Accounts)]
pub struct ClaimFusd<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, SyndicateConfig>,
    #[account(mut, address = config.mint)]
    pub fusd_mint: Account<'info, Mint>,
    #[account(init, payer = authority, space = 8 + FaucetReceipt::INIT_SPACE, seeds = [FAUCET_SEED, authority.key().as_ref()], bump)]
    pub receipt: Account<'info, FaucetReceipt>,
    #[account(init_if_needed, payer = authority, associated_token::mint = fusd_mint, associated_token::authority = authority)]
    pub recipient_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct CreateSyndicate<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, SyndicateConfig>,
    #[account(address = config.mint)]
    pub fusd_mint: Account<'info, Mint>,
    #[account(init, payer = trader, space = 8 + Syndicate::INIT_SPACE, seeds = [SYNDICATE_SEED, trader.key().as_ref(), &nonce.to_le_bytes()], bump)]
    pub syndicate: Account<'info, Syndicate>,
    #[account(init, payer = trader, associated_token::mint = fusd_mint, associated_token::authority = syndicate)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(mut, has_one = vault)]
    pub syndicate: Account<'info, Syndicate>,
    #[account(init_if_needed, payer = depositor, space = 8 + Membership::INIT_SPACE, seeds = [MEMBER_SEED, syndicate.key().as_ref(), depositor.key().as_ref()], bump)]
    pub member: Account<'info, Membership>,
    #[account(mut, constraint = depositor_ata.owner == depositor.key(), constraint = depositor_ata.mint == syndicate.mint)]
    pub depositor_ata: Account<'info, TokenAccount>,
    #[account(mut, address = syndicate.vault)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = vault)]
    pub syndicate: Account<'info, Syndicate>,
    #[account(mut, seeds = [MEMBER_SEED, syndicate.key().as_ref(), authority.key().as_ref()], bump = member.bump, has_one = authority)]
    pub member: Account<'info, Membership>,
    #[account(mut, address = syndicate.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = recipient_ata.owner == authority.key(), constraint = recipient_ata.mint == syndicate.mint)]
    pub recipient_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(args: StartSessionArgs)]
pub struct StartSession<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(mut, has_one = trader, has_one = vault)]
    pub syndicate: Account<'info, Syndicate>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, SyndicateConfig>,
    #[account(address = syndicate.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(init, payer = trader, space = 8 + SyndicateSession::INIT_SPACE, seeds = [SESSION_SEED, syndicate.key().as_ref(), &args.nonce.to_le_bytes()], bump)]
    pub session: Account<'info, SyndicateSession>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StartSessionArgs {
    pub nonce: u64,
    pub crank_task_id: i64,
}

#[delegate]
#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct DelegateSession<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(has_one = trader)]
    pub syndicate: Account<'info, Syndicate>,
    /// CHECK: decoded and authorized when created; PDA seeds enforce identity.
    #[account(mut, del, seeds = [SESSION_SEED, syndicate.key().as_ref(), &nonce.to_le_bytes()], bump)]
    pub session: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct ScheduleExpiry<'info> {
    /// CHECK: fixed to MagicBlock's Magic Program.
    #[account(address = pubkey!("Magic11111111111111111111111111111111111111"))]
    pub magic_program: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [SESSION_SEED, session.syndicate.as_ref(), &nonce.to_le_bytes()],
        bump = session.bump,
        constraint = session.status == SyndicateSession::ACTIVE @ SyndicateError::SessionNotActive
    )]
    pub session: Account<'info, SyndicateSession>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TradeArgs {
    pub asset: u8,
    pub side: u8,
    pub quantity_micro: u64,
    pub expected_price_micro: u64,
    pub max_slippage_bps: u16,
}

#[derive(Accounts, Session)]
pub struct Trade<'info> {
    #[account(mut)]
    pub actor: Signer<'info>,
    #[account(mut)]
    pub session: Account<'info, SyndicateSession>,
    pub price_update: Account<'info, PriceUpdateV2>,
    #[session(signer = actor, authority = session.trader)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts)]
pub struct ExpireSession<'info> {
    #[account(mut)]
    pub session: Account<'info, SyndicateSession>,
}

#[commit]
#[derive(Accounts)]
pub struct FinalizeSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub session: Account<'info, SyndicateSession>,
}

#[derive(Accounts)]
pub struct SettleSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, SyndicateConfig>>,
    #[account(mut, address = config.mint)]
    pub fusd_mint: Box<Account<'info, Mint>>,
    #[account(mut, has_one = vault, has_one = trader)]
    pub syndicate: Box<Account<'info, Syndicate>>,
    /// CHECK: address constrained by syndicate.
    /// CHECK: constrained by syndicate has_one.
    pub trader: UncheckedAccount<'info>,
    #[account(
        constraint = session.syndicate == syndicate.key() @ SyndicateError::InvalidSession,
        constraint = session.trader == syndicate.trader @ SyndicateError::InvalidSession,
        constraint = session.status == SyndicateSession::COMMITTING @ SyndicateError::SessionNotCommitted
    )]
    pub session: Box<Account<'info, SyndicateSession>>,
    #[account(mut, address = syndicate.vault)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = trader_ata.owner == trader.key(), constraint = trader_ata.mint == syndicate.mint)]
    pub trader_ata: Box<Account<'info, TokenAccount>>,
    #[account(init, payer = payer, space = 8 + SettlementReceipt::INIT_SPACE, seeds = [SETTLEMENT_SEED, session.key().as_ref()], bump)]
    pub receipt: Box<Account<'info, SettlementReceipt>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct SyndicateConfig {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub bump: u8,
    pub mint_bump: u8,
    pub paused: bool,
    pub feed_ids: [[u8; 32]; 2],
}

#[account]
#[derive(InitSpace)]
pub struct FaucetReceipt {
    pub authority: Pubkey,
    pub claimed_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct Syndicate {
    pub trader: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub nonce: u64,
    pub name: [u8; 32],
    pub bump: u8,
    pub status: u8,
    pub total_shares: u64,
    pub high_water_price_e6: u64,
    pub active_session_nonce: u64,
    pub backer_count: u32,
    pub session_count: u32,
    pub total_fees: u64,
    pub max_drawdown_bps: u16,
    pub created_at: i64,
}
impl Syndicate {
    pub const IDLE: u8 = 0;
    pub const ACTIVE: u8 = 1;
}

#[account]
#[derive(InitSpace)]
pub struct Membership {
    pub authority: Pubkey,
    pub syndicate: Pubkey,
    pub shares: u64,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace)]
pub struct SyntheticPosition {
    pub quantity_micro: u64,
    pub cost_micro: u64,
}

#[account]
#[derive(InitSpace)]
pub struct SyndicateSession {
    pub syndicate: Pubkey,
    pub trader: Pubkey,
    pub nonce: u64,
    pub crank_task_id: i64,
    pub bump: u8,
    pub status: u8,
    pub started_at: i64,
    pub expires_at: i64,
    pub starting_equity: u64,
    pub cash: u64,
    pub equity: u64,
    pub peak_equity: u64,
    pub drawdown_bps: u64,
    pub trade_count: u16,
    pub positions: [SyntheticPosition; 2],
    pub last_prices_micro: [u64; 2],
    pub feed_ids: [[u8; 32]; 2],
}
impl SyndicateSession {
    pub const ACTIVE: u8 = 1;
    pub const FROZEN: u8 = 2;
    pub const COMMITTING: u8 = 3;
}

#[account]
#[derive(InitSpace)]
pub struct SettlementReceipt {
    pub session: Pubkey,
    pub gross_pnl: i128,
    pub mint_amount: u64,
    pub burn_amount: u64,
    pub fee_amount: u64,
    pub settled_at: i64,
}

#[event]
pub struct TradeExecuted {
    pub session: Pubkey,
    pub sequence: u16,
    pub asset: u8,
    pub side: u8,
    pub quantity_micro: u64,
    pub price_micro: u64,
    pub equity_micro: u64,
    pub executed_at: i64,
}

#[derive(Default, Debug, PartialEq)]
struct Settlement {
    mint_amount: u64,
    burn_amount: u64,
    fee_amount: u64,
    next_high_water_price_e6: u64,
}

fn shares_for_deposit(amount: u64, total_shares: u64, vault_balance: u64) -> Result<u64> {
    if total_shares == 0 {
        return Ok(amount);
    }
    require!(vault_balance > 0, SyndicateError::InvalidVault);
    mul_div(amount, total_shares, vault_balance)
}
fn tokens_for_withdrawal(shares: u64, total_shares: u64, vault_balance: u64) -> Result<u64> {
    require!(total_shares > 0, SyndicateError::InvalidShares);
    mul_div(shares, vault_balance, total_shares)
}
fn mul_div(a: u64, b: u64, denominator: u64) -> Result<u64> {
    require!(denominator > 0, SyndicateError::MathOverflow);
    let value = (a as u128)
        .checked_mul(b as u128)
        .ok_or(SyndicateError::MathOverflow)?
        / denominator as u128;
    u64::try_from(value).map_err(|_| error!(SyndicateError::MathOverflow))
}
fn bps_of(value: u64, bps: u64) -> Result<u64> {
    mul_div(value, bps, 10_000)
}
fn position_value(quantity_micro: u64, price_micro: u64) -> Result<u64> {
    mul_div(quantity_micro, price_micro, 1_000_000)
}
fn price_to_micro(price: i64, exponent: i32) -> Result<u64> {
    require!(
        price > 0 && (-18..=18).contains(&exponent),
        SyndicateError::InvalidOracle
    );
    let scale = 10_u128
        .checked_pow(exponent.unsigned_abs())
        .ok_or(SyndicateError::MathOverflow)?;
    let value = if exponent >= 0 {
        (price as u128)
            .checked_mul(scale)
            .and_then(|v| v.checked_mul(1_000_000))
    } else {
        (price as u128).checked_mul(1_000_000).map(|v| v / scale)
    }
    .ok_or(SyndicateError::MathOverflow)?;
    u64::try_from(value).map_err(|_| error!(SyndicateError::MathOverflow))
}
fn require_slippage(actual: u64, expected: u64, max_bps: u16) -> Result<()> {
    let difference = actual.abs_diff(expected) as u128;
    let lhs = difference
        .checked_mul(10_000)
        .ok_or(SyndicateError::MathOverflow)?;
    let rhs = (expected as u128)
        .checked_mul(max_bps as u128)
        .ok_or(SyndicateError::MathOverflow)?;
    require!(lhs <= rhs, SyndicateError::SlippageExceeded);
    Ok(())
}
fn mark_equity(session: &mut SyndicateSession) -> Result<()> {
    let mut equity = session.cash;
    for i in 0..2 {
        equity = equity
            .checked_add(position_value(
                session.positions[i].quantity_micro,
                session.last_prices_micro[i],
            )?)
            .ok_or(SyndicateError::MathOverflow)?;
    }
    session.equity = equity;
    session.peak_equity = session.peak_equity.max(equity);
    session.drawdown_bps = if session.peak_equity == 0 {
        0
    } else {
        mul_div(session.peak_equity - equity, 10_000, session.peak_equity)?
    };
    Ok(())
}
fn calculate_settlement(
    start: u64,
    end: u64,
    shares: u64,
    high_water_e6: u64,
) -> Result<Settlement> {
    require!(start > 0 && shares > 0, SyndicateError::EmptyPool);
    if end <= start {
        return Ok(Settlement {
            burn_amount: start - end,
            next_high_water_price_e6: high_water_e6,
            ..Settlement::default()
        });
    }
    let gross_profit = end - start;
    let gross_share_price = ((end as u128)
        .checked_mul(SHARE_SCALE)
        .ok_or(SyndicateError::MathOverflow)?
        / shares as u128) as u64;
    let fee = if gross_share_price > high_water_e6 {
        let eligible = mul_div(
            gross_share_price - high_water_e6,
            shares,
            SHARE_SCALE as u64,
        )?;
        bps_of(eligible.min(gross_profit), PERFORMANCE_FEE_BPS)?
    } else {
        0
    };
    let post_fee = end.checked_sub(fee).ok_or(SyndicateError::MathOverflow)?;
    let next_hwm = ((post_fee as u128)
        .checked_mul(SHARE_SCALE)
        .ok_or(SyndicateError::MathOverflow)?
        / shares as u128) as u64;
    Ok(Settlement {
        mint_amount: gross_profit,
        fee_amount: fee,
        next_high_water_price_e6: high_water_e6.max(next_hwm),
        ..Settlement::default()
    })
}

#[error_code]
pub enum SyndicateError {
    #[msg("The syndicate protocol is paused.")]
    ProtocolPaused,
    #[msg("Enter a positive amount.")]
    InvalidAmount,
    #[msg("The deposit is too small to mint a share.")]
    ZeroShares,
    #[msg("The share amount is invalid.")]
    InvalidShares,
    #[msg("Deposits and withdrawals are locked during a session.")]
    SessionActive,
    #[msg("The pool has no backing capital.")]
    EmptyPool,
    #[msg("The token vault is invalid.")]
    InvalidVault,
    #[msg("The session is not active.")]
    SessionNotActive,
    #[msg("Only the syndicate trader may perform this action.")]
    UnauthorizedTrader,
    #[msg("The session has expired.")]
    SessionExpired,
    #[msg("The session has not expired.")]
    SessionNotExpired,
    #[msg("The trade request is invalid.")]
    InvalidTrade,
    #[msg("The session trade limit has been reached.")]
    TradeLimit,
    #[msg("The minimum trade is 1 fUSD.")]
    MinimumTrade,
    #[msg("The trade exceeds 10% of current equity.")]
    TradeTooLarge,
    #[msg("The position exceeds the 40% asset limit.")]
    AssetLimit,
    #[msg("The pool does not have enough synthetic cash.")]
    InsufficientCash,
    #[msg("The pool does not own enough of this synthetic asset.")]
    InsufficientPosition,
    #[msg("The session reached its maximum drawdown.")]
    DrawdownLimit,
    #[msg("The session does not belong to the active syndicate.")]
    InvalidSession,
    #[msg("The session has not been committed back from the Ephemeral Rollup.")]
    SessionNotCommitted,
    #[msg("The oracle account is stale, invalid, or does not match this market.")]
    InvalidOracle,
    #[msg("The oracle price moved beyond the approved limit.")]
    SlippageExceeded,
    #[msg("Arithmetic overflow.")]
    MathOverflow,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn share_math_preserves_proportions() {
        assert_eq!(shares_for_deposit(500, 1_000, 2_000).unwrap(), 250);
        assert_eq!(tokens_for_withdrawal(250, 1_250, 2_500).unwrap(), 500);
    }
    #[test]
    fn high_water_fee_charges_only_new_profit() {
        let first = calculate_settlement(1_000, 1_200, 1_000, 1_000_000).unwrap();
        assert_eq!(first.mint_amount, 200);
        assert_eq!(first.fee_amount, 20);
        assert_eq!(first.next_high_water_price_e6, 1_180_000);
        let recovery = calculate_settlement(1_000, 1_100, 1_000, 1_180_000).unwrap();
        assert_eq!(recovery.fee_amount, 0);
        assert_eq!(recovery.next_high_water_price_e6, 1_180_000);
    }
    #[test]
    fn loss_burns_without_lowering_high_water_mark() {
        let result = calculate_settlement(1_000, 800, 1_000, 1_100_000).unwrap();
        assert_eq!(result.burn_amount, 200);
        assert_eq!(result.fee_amount, 0);
        assert_eq!(result.next_high_water_price_e6, 1_100_000);
    }
    #[test]
    fn oracle_prices_normalize_to_six_decimals() {
        assert_eq!(price_to_micro(10_000_000_000, -8).unwrap(), 100_000_000);
        assert_eq!(price_to_micro(25, 0).unwrap(), 25_000_000);
    }
    #[test]
    fn slippage_is_inclusive_at_the_requested_limit() {
        assert!(require_slippage(101_000_000, 100_000_000, 100).is_ok());
        assert!(require_slippage(101_000_001, 100_000_000, 100).is_err());
    }
}
