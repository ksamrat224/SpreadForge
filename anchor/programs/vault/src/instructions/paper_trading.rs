//! Private, virtual-only portfolio instructions. No SPL Token accounts or CPIs.
use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use ephemeral_rollups_sdk::{
    access_control::{
        instructions::{CreateEphemeralPermissionCpi, UpdateEphemeralPermissionCpi},
        structs::{
            EphemeralMembersArgs, EphemeralPermission, Member, PERMISSION_SEED,
            ACCOUNT_SIGNATURES_FLAG, AUTHORITY_FLAG, TX_BALANCES_FLAG, TX_LOGS_FLAG,
            TX_MESSAGE_FLAG,
        },
    },
    consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
    ephemeral_accounts::rent,
};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use crate::{constants::*, errors::ResultRegistryError, state::{PaperFill, PaperMarket, PaperMarketRegistry, PaperOrder, PaperPortfolio, PaperPosition, PortfolioCheckpoint, PortfolioPerformance}};

#[derive(Clone, Copy)] struct OracleObservation { price: i64, exponent: i32, published_at: i64 }

/// MagicBlock publishes Pyth Lazer updates as `PriceUpdateV2` accounts. The
/// caller never provides a price: address, program owner, Pyth feed identity,
/// verification level and five-second freshness are all checked on-chain.
fn read_oracle(market: &PaperMarket, oracle: &AccountInfo) -> Result<OracleObservation> {
    require_keys_eq!(*oracle.owner, market.oracle_program, ResultRegistryError::InvalidPaperOracleAccount);
    require_keys_eq!(oracle.key(), market.oracle_price_account, ResultRegistryError::InvalidPaperOracleAccount);
    let data = oracle.try_borrow_data()?;
    let mut bytes: &[u8] = &data;
    let update = PriceUpdateV2::try_deserialize(&mut bytes).map_err(|_| error!(ResultRegistryError::InvalidPaperOracleAccount))?;
    let price = update.get_price_no_older_than(&Clock::get()?, PAPER_MAX_ORACLE_AGE_SECONDS as u64, &market.oracle_feed).map_err(|_| error!(ResultRegistryError::InvalidOracleObservation))?;
    require!(price.price > 0, ResultRegistryError::InvalidOracleObservation);
    Ok(OracleObservation { price: price.price, exponent: price.exponent, published_at: price.publish_time })
}
fn active_actor(portfolio: &PaperPortfolio, actor: Pubkey) -> Result<()> {
    require!(portfolio.status == PaperPortfolio::ACTIVE, ResultRegistryError::PaperPortfolioNotActive);
    require!(actor == portfolio.authority || (actor == portfolio.session_signer && Clock::get()?.unix_timestamp <= portfolio.expires_at), ResultRegistryError::UnauthorizedPaperPortfolioActor); Ok(())
}
fn cents_from_oracle(o: OracleObservation, market: &PaperMarket) -> Result<u64> {
    // MagicBlock's Pyth Lazer publisher encodes a positive decimal scale
    // (raw / 10^exponent), while standard Pyth updates normally use a
    // negative exponent. Both forms use the absolute decimal scale here.
    let exponent = o.exponent.checked_abs().ok_or(ResultRegistryError::InvalidOracleObservation)?;
    require!(exponent <= 18, ResultRegistryError::InvalidOracleObservation);
    let scale = 10_u128.checked_pow(exponent as u32).ok_or(ResultRegistryError::InvalidOracleObservation)?;
    let cents = (o.price as u128).checked_mul(market.price_multiplier as u128).ok_or(ResultRegistryError::InvalidPaperOrder)?.checked_div(scale).ok_or(ResultRegistryError::InvalidOracleObservation)?;
    u64::try_from(cents).map_err(|_| error!(ResultRegistryError::InvalidPaperOrder))
}
fn notional_cents(price: u64, lots: u64, lot_size: u64) -> Result<u64> { u64::try_from((lots as u128).checked_mul(lot_size as u128).ok_or(ResultRegistryError::InvalidPaperOrder)?.checked_mul(price as u128).ok_or(ResultRegistryError::InvalidPaperOrder)? / 1_000).map_err(|_| error!(ResultRegistryError::InvalidPaperOrder)) }
fn execution_price(reference: u64, market: &PaperMarket, side: u8, lots: u64) -> Result<u64> { let impact_bps = lots.saturating_mul(10_000).checked_div(market.depth_lots).ok_or(error!(ResultRegistryError::InvalidPaperOrder))?; let adjustment = reference.checked_mul((market.half_spread_bps as u64).saturating_add(impact_bps)).ok_or(error!(ResultRegistryError::InvalidPaperOrder))? / 10_000; if side == PaperOrder::BUY { reference.checked_add(adjustment).ok_or(error!(ResultRegistryError::InvalidPaperOrder)) } else { reference.checked_sub(adjustment).ok_or(error!(ResultRegistryError::InvalidPaperOrder)) } }
fn apply_fill(portfolio: &mut PaperPortfolio, position: &mut PaperPosition, market: &PaperMarket, side: u8, lots: u64, price: u64) -> Result<i64> { let notional = notional_cents(price, lots, market.lot_size)?; if side == PaperOrder::BUY { require!(portfolio.available_usdc_cents >= notional, ResultRegistryError::InsufficientVirtualFunds); portfolio.available_usdc_cents -= notional; position.quantity_lots = position.quantity_lots.checked_add(lots as i64).ok_or(ResultRegistryError::InvalidPaperOrder)?; position.inventory_cost_cents = position.inventory_cost_cents.checked_add(notional).ok_or(ResultRegistryError::InvalidPaperOrder)?; Ok(0) } else { require!(position.quantity_lots >= lots as i64, ResultRegistryError::InsufficientVirtualFunds); let before = position.quantity_lots as u64; let cost = position.inventory_cost_cents.checked_mul(lots).ok_or(ResultRegistryError::InvalidPaperOrder)? / before; position.quantity_lots -= lots as i64; position.inventory_cost_cents -= cost; portfolio.available_usdc_cents = portfolio.available_usdc_cents.checked_add(notional).ok_or(ResultRegistryError::InvalidPaperOrder)?; let pnl = i64::try_from(notional as i128 - cost as i128).map_err(|_| error!(ResultRegistryError::InvalidPaperOrder))?; portfolio.realized_pnl_cents = portfolio.realized_pnl_cents.checked_add(pnl).ok_or(ResultRegistryError::InvalidPaperOrder)?; Ok(pnl) } }
fn mark_equity(portfolio: &mut PaperPortfolio, position: &mut PaperPosition, market: &PaperMarket, reference: u64) -> Result<()> { let inventory = if position.quantity_lots > 0 { notional_cents(reference, position.quantity_lots as u64, market.lot_size)? } else { 0 }; let base = portfolio.aggregate_equity_cents.checked_sub(position.marked_value_cents).ok_or(ResultRegistryError::InvalidPaperOrder)?; portfolio.aggregate_equity_cents = base.checked_add(inventory).ok_or(ResultRegistryError::InvalidPaperOrder)?; position.marked_value_cents = inventory; Ok(()) }

#[derive(Accounts)] pub struct InitializePaperMarketRegistry<'info> { #[account(mut)] pub authority: Signer<'info>, #[account(init, payer = authority, space = PaperMarketRegistry::SPACE, seeds = [PAPER_REGISTRY_SEED], bump)] pub registry: Account<'info, PaperMarketRegistry>, pub system_program: Program<'info, System> }
pub fn initialize_registry(ctx: Context<InitializePaperMarketRegistry>) -> Result<()> { ctx.accounts.registry.authority = ctx.accounts.authority.key(); ctx.accounts.registry.schema_version = PAPER_SCHEMA_VERSION; ctx.accounts.registry.bump = ctx.bumps.registry; Ok(()) }
#[derive(AnchorSerialize, AnchorDeserialize, Clone)] pub struct UpsertPaperMarketArgs { pub market_id: [u8; 16], pub oracle_feed: [u8; 32], pub oracle_price_account: Pubkey, pub oracle_program: Pubkey, pub lot_size: u64, pub price_multiplier: u32, pub half_spread_bps: u16, pub depth_lots: u64, pub enabled: bool }
#[derive(Accounts)] #[instruction(args: UpsertPaperMarketArgs)] pub struct UpsertPaperMarket<'info> { #[account(mut)] pub authority: Signer<'info>, #[account(has_one = authority @ ResultRegistryError::UnauthorizedPaperRegistryAuthority)] pub registry: Account<'info, PaperMarketRegistry>, #[account(init_if_needed, payer = authority, space = PaperMarket::SPACE, seeds = [PAPER_MARKET_SEED, registry.key().as_ref(), args.market_id.as_ref()], bump)] pub market: Account<'info, PaperMarket>, pub system_program: Program<'info, System> }
pub fn upsert_market(ctx: Context<UpsertPaperMarket>, args: UpsertPaperMarketArgs) -> Result<()> { require!(args.market_id != [0; 16] && args.oracle_feed != [0; 32] && args.oracle_price_account != Pubkey::default() && args.oracle_program != Pubkey::default() && args.lot_size > 0 && args.price_multiplier > 0 && args.depth_lots > 0, ResultRegistryError::InvalidPaperOrder); let m = &mut ctx.accounts.market; m.registry = ctx.accounts.registry.key(); m.market_id = args.market_id; m.oracle_feed = args.oracle_feed; m.oracle_price_account = args.oracle_price_account; m.oracle_program = args.oracle_program; m.lot_size = args.lot_size; m.price_multiplier = args.price_multiplier; m.half_spread_bps = args.half_spread_bps; m.depth_lots = args.depth_lots; m.enabled = args.enabled; m.bump = ctx.bumps.market; Ok(()) }

#[derive(AnchorSerialize, AnchorDeserialize, Clone)] pub struct InitializePaperPortfolioArgs { pub session_signer: Pubkey, pub expires_at: i64 }
#[derive(Accounts)] #[instruction(args: InitializePaperPortfolioArgs)] pub struct InitializePaperPortfolio<'info> { #[account(mut)] pub authority: Signer<'info>, pub registry: Account<'info, PaperMarketRegistry>, #[account(init, payer = authority, space = PaperPortfolio::SPACE, seeds = [PAPER_PORTFOLIO_SEED, authority.key().as_ref()], bump)] pub portfolio: Account<'info, PaperPortfolio>, #[account(init, payer = authority, space = PortfolioPerformance::SPACE, seeds = [PAPER_PERFORMANCE_SEED, authority.key().as_ref()], bump)] pub performance: Account<'info, PortfolioPerformance>, pub system_program: Program<'info, System> }
pub fn initialize_portfolio(ctx: Context<InitializePaperPortfolio>, args: InitializePaperPortfolioArgs) -> Result<()> { let now = Clock::get()?.unix_timestamp; require!(args.session_signer != Pubkey::default() && args.expires_at > now && args.expires_at <= now + PAPER_AUTHORIZATION_SECONDS, ResultRegistryError::UnauthorizedPaperPortfolioActor); let p = &mut ctx.accounts.portfolio; p.authority = ctx.accounts.authority.key(); p.session_signer = args.session_signer; p.registry = ctx.accounts.registry.key(); p.starting_equity_cents = PAPER_STARTING_USDC_CENTS; p.available_usdc_cents = PAPER_STARTING_USDC_CENTS; p.reserved_usdc_cents = 0; p.realized_pnl_cents = 0; p.aggregate_equity_cents = PAPER_STARTING_USDC_CENTS; p.next_order_id = 0; p.next_fill_id = 0; p.expires_at = args.expires_at; p.status = PaperPortfolio::ACTIVE; p.schema_version = PAPER_SCHEMA_VERSION; p.bump = ctx.bumps.portfolio; let perf = &mut ctx.accounts.performance; perf.authority = p.authority; perf.starting_equity_cents = PAPER_STARTING_USDC_CENTS; perf.current_equity_cents = PAPER_STARTING_USDC_CENTS; perf.return_bps = 0; perf.latest_checkpoint_at = now; perf.created_at = now; perf.schema_version = PAPER_SCHEMA_VERSION; perf.bump = ctx.bumps.performance;
    // The delegated portfolio PDA pays the ER-local permission rent. This is
    // lamports only; virtual USDC is fixed above and no real asset is moved.
    transfer(CpiContext::new(System::id(), Transfer { from: ctx.accounts.authority.to_account_info(), to: p.to_account_info() }), rent(EphemeralPermission::size_of(PAPER_PERMISSION_MEMBER_COUNT) as u32))?;
    Ok(()) }

/// Creates the ER-local privacy gate after the portfolio has been delegated.
/// This instruction must be routed to the router-selected Private ER, never
/// sent to base layer. It is idempotent so a client can safely retry after an
/// interrupted setup flow.
#[derive(Accounts)]
pub struct InitializePaperPortfolioPermission<'info> {
    pub actor: Signer<'info>,
    #[account(mut, seeds = [PAPER_PORTFOLIO_SEED, portfolio.authority.as_ref()], bump = portfolio.bump)]
    pub portfolio: Account<'info, PaperPortfolio>,
    /// CHECK: PDA and owner are checked below and by the permission program.
    #[account(mut, seeds = [PERMISSION_SEED, portfolio.key().as_ref()], bump, seeds::program = permission_program.key())]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: fixed MagicBlock access-control program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: fixed MagicBlock ephemeral rent vault.
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: fixed MagicBlock program consumed by the permission CPI.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}
pub fn initialize_portfolio_permission(ctx: Context<InitializePaperPortfolioPermission>) -> Result<()> {
    active_actor(&ctx.accounts.portfolio, ctx.accounts.actor.key())?;
    let all_visibility = AUTHORITY_FLAG | TX_LOGS_FLAG | TX_BALANCES_FLAG | TX_MESSAGE_FLAG | ACCOUNT_SIGNATURES_FLAG;
    let members = vec![
        Member { flags: all_visibility, pubkey: ctx.accounts.portfolio.authority },
        Member { flags: all_visibility, pubkey: ctx.accounts.portfolio.session_signer },
    ];
    let bump = [ctx.accounts.portfolio.bump];
    let seeds: &[&[u8]] = &[PAPER_PORTFOLIO_SEED, ctx.accounts.portfolio.authority.as_ref(), &bump];
    if ctx.accounts.permission.owner == &PERMISSION_PROGRAM_ID && !ctx.accounts.permission.data_is_empty() {
        // PER bootstrap intentionally happens in two ER transactions. The
        // permission account is first created publicly, then this update seals
        // it to the portfolio owner and short-lived session key. MagicBlock's
        // Permission Program applies the new membership atomically here.
        let args = EphemeralMembersArgs { is_private: true, members };
        UpdateEphemeralPermissionCpi {
            payer: ctx.accounts.portfolio.to_account_info(), permissioned_account: ctx.accounts.portfolio.to_account_info(), permission: ctx.accounts.permission.to_account_info(), vault: ctx.accounts.ephemeral_vault.to_account_info(), magic_program: ctx.accounts.magic_program.to_account_info(), permission_program: ctx.accounts.permission_program.to_account_info(), authority: ctx.accounts.portfolio.to_account_info(), authority_is_signer: false, args,
        }.invoke_signed(&[seeds])?;
    } else {
        // The initial permission must be public. A subsequent invocation of
        // this idempotent instruction sees the permission and performs the
        // private-member update above. Do not create a private permission in
        // the bootstrap transaction: it can prevent the TEE from admitting the
        // very client that needs to complete the setup.
        let args = EphemeralMembersArgs { is_private: false, members: vec![] };
        CreateEphemeralPermissionCpi {
            payer: ctx.accounts.portfolio.to_account_info(), permissioned_account: ctx.accounts.portfolio.to_account_info(), permission: ctx.accounts.permission.to_account_info(), vault: ctx.accounts.ephemeral_vault.to_account_info(), magic_program: ctx.accounts.magic_program.to_account_info(), permission_program: ctx.accounts.permission_program.to_account_info(), args,
        }.invoke_signed(&[seeds])?;
    }
    Ok(())
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone)] pub struct RenewPaperAuthorizationArgs { pub session_signer: Pubkey, pub expires_at: i64 }
#[derive(Accounts)] pub struct RenewPaperAuthorization<'info> { #[account(mut)] pub authority: Signer<'info>, #[account(mut, seeds = [PAPER_PORTFOLIO_SEED, authority.key().as_ref()], bump = portfolio.bump, has_one = authority)] pub portfolio: Account<'info, PaperPortfolio> }
pub fn renew_authorization(ctx: Context<RenewPaperAuthorization>, args: RenewPaperAuthorizationArgs) -> Result<()> { let now = Clock::get()?.unix_timestamp; require!(args.session_signer != Pubkey::default() && args.expires_at > now && args.expires_at <= now + PAPER_AUTHORIZATION_SECONDS, ResultRegistryError::UnauthorizedPaperPortfolioActor); ctx.accounts.portfolio.session_signer = args.session_signer; ctx.accounts.portfolio.expires_at = args.expires_at; Ok(()) }

#[derive(Accounts)] pub struct OpenPaperPosition<'info> { #[account(mut)] pub actor: Signer<'info>, #[account(mut)] pub portfolio: Account<'info, PaperPortfolio>, #[account(constraint = market.registry == portfolio.registry && market.enabled @ ResultRegistryError::PaperMarketUnavailable)] pub market: Account<'info, PaperMarket>, #[account(init, payer = actor, space = PaperPosition::SPACE, seeds = [PAPER_POSITION_SEED, portfolio.key().as_ref(), market.key().as_ref()], bump)] pub position: Account<'info, PaperPosition>, pub system_program: Program<'info, System> }
pub fn open_position(ctx: Context<OpenPaperPosition>) -> Result<()> { active_actor(&ctx.accounts.portfolio, ctx.accounts.actor.key())?; let p = &mut ctx.accounts.position; p.portfolio = ctx.accounts.portfolio.key(); p.market = ctx.accounts.market.key(); p.quantity_lots = 0; p.reserved_lots = 0; p.inventory_cost_cents = 0; p.marked_value_cents = 0; p.bump = ctx.bumps.position; Ok(()) }

#[derive(AnchorSerialize, AnchorDeserialize, Clone)] pub struct PlacePaperMarketOrderArgs { pub side: u8, pub quantity_lots: u64 }
#[derive(Accounts)] #[instruction(args: PlacePaperMarketOrderArgs)] pub struct PlacePaperMarketOrder<'info> { #[account(mut)] pub actor: Signer<'info>, #[account(mut)] pub portfolio: Account<'info, PaperPortfolio>, #[account(constraint = market.registry == portfolio.registry && market.enabled @ ResultRegistryError::PaperMarketUnavailable)] pub market: Account<'info, PaperMarket>, #[account(mut, seeds = [PAPER_POSITION_SEED, portfolio.key().as_ref(), market.key().as_ref()], bump = position.bump, constraint = position.portfolio == portfolio.key() && position.market == market.key() @ ResultRegistryError::InvalidPaperOrderAccount)] pub position: Account<'info, PaperPosition>, /// CHECK: read_oracle validates this external account.
pub oracle_price: UncheckedAccount<'info>, #[account(init, payer = actor, space = PaperFill::SPACE, seeds = [PAPER_FILL_SEED, portfolio.key().as_ref(), &portfolio.next_fill_id.to_le_bytes()], bump)] pub fill: Account<'info, PaperFill>, pub system_program: Program<'info, System> }
pub fn place_market_order(ctx: Context<PlacePaperMarketOrder>, args: PlacePaperMarketOrderArgs) -> Result<()> { active_actor(&ctx.accounts.portfolio, ctx.accounts.actor.key())?; require!((args.side == PaperOrder::BUY || args.side == PaperOrder::SELL) && args.quantity_lots > 0, ResultRegistryError::InvalidPaperOrder); let o = read_oracle(&ctx.accounts.market, &ctx.accounts.oracle_price.to_account_info())?; let reference = cents_from_oracle(o, &ctx.accounts.market)?; let lots = args.quantity_lots.min(ctx.accounts.market.depth_lots); let price = execution_price(reference, &ctx.accounts.market, args.side, lots)?; let p = &mut ctx.accounts.portfolio; let realized = apply_fill(p, &mut ctx.accounts.position, &ctx.accounts.market, args.side, lots, price)?; let fill = &mut ctx.accounts.fill; fill.portfolio = p.key(); fill.market = ctx.accounts.market.key(); fill.id = p.next_fill_id; fill.order_id = u64::MAX; fill.side = args.side; fill.quantity_lots = lots; fill.price_cents = price; fill.realized_pnl_cents = realized; fill.filled_at = o.published_at; fill.bump = ctx.bumps.fill; p.next_fill_id += 1; mark_equity(p, &mut ctx.accounts.position, &ctx.accounts.market, reference) }

#[derive(AnchorSerialize, AnchorDeserialize, Clone)] pub struct PlacePaperLimitOrderArgs { pub side: u8, pub price_cents: u64, pub quantity_lots: u64 }
#[derive(Accounts)] #[instruction(args: PlacePaperLimitOrderArgs)] pub struct PlacePaperLimitOrder<'info> { #[account(mut)] pub actor: Signer<'info>, #[account(mut)] pub portfolio: Account<'info, PaperPortfolio>, #[account(constraint = market.registry == portfolio.registry && market.enabled @ ResultRegistryError::PaperMarketUnavailable)] pub market: Account<'info, PaperMarket>, #[account(mut, seeds = [PAPER_POSITION_SEED, portfolio.key().as_ref(), market.key().as_ref()], bump = position.bump, constraint = position.portfolio == portfolio.key() && position.market == market.key() @ ResultRegistryError::InvalidPaperOrderAccount)] pub position: Account<'info, PaperPosition>, #[account(init, payer = actor, space = PaperOrder::SPACE, seeds = [PAPER_ORDER_SEED, portfolio.key().as_ref(), &portfolio.next_order_id.to_le_bytes()], bump)] pub order: Account<'info, PaperOrder>, pub system_program: Program<'info, System> }
pub fn place_limit_order(ctx: Context<PlacePaperLimitOrder>, args: PlacePaperLimitOrderArgs) -> Result<()> { active_actor(&ctx.accounts.portfolio, ctx.accounts.actor.key())?; require!((args.side == PaperOrder::BUY || args.side == PaperOrder::SELL) && args.price_cents > 0 && args.quantity_lots > 0, ResultRegistryError::InvalidPaperOrder); let reserved = notional_cents(args.price_cents, args.quantity_lots, ctx.accounts.market.lot_size)?; let p = &mut ctx.accounts.portfolio; let position = &mut ctx.accounts.position; if args.side == PaperOrder::BUY { require!(p.available_usdc_cents >= reserved, ResultRegistryError::InsufficientVirtualFunds); p.available_usdc_cents -= reserved; p.reserved_usdc_cents += reserved; } else { require!(position.quantity_lots >= 0 && (position.quantity_lots as u64).saturating_sub(position.reserved_lots) >= args.quantity_lots, ResultRegistryError::InsufficientVirtualFunds); position.reserved_lots += args.quantity_lots; } let order = &mut ctx.accounts.order; order.portfolio = p.key(); order.market = ctx.accounts.market.key(); order.id = p.next_order_id; order.side = args.side; order.price_cents = args.price_cents; order.remaining_lots = args.quantity_lots; order.reserved_cents = if args.side == PaperOrder::BUY { reserved } else { 0 }; order.created_at = Clock::get()?.unix_timestamp; order.status = PaperOrder::OPEN; order.bump = ctx.bumps.order; p.next_order_id += 1; Ok(()) }

#[derive(Accounts)] pub struct CancelPaperOrder<'info> { #[account(mut)] pub actor: Signer<'info>, #[account(mut)] pub portfolio: Account<'info, PaperPortfolio>, #[account(mut)] pub position: Account<'info, PaperPosition>, #[account(mut, seeds = [PAPER_ORDER_SEED, portfolio.key().as_ref(), &order.id.to_le_bytes()], bump = order.bump, constraint = order.portfolio == portfolio.key() && order.market == position.market @ ResultRegistryError::InvalidPaperOrderAccount)] pub order: Account<'info, PaperOrder> }
pub fn cancel_order(ctx: Context<CancelPaperOrder>) -> Result<()> { active_actor(&ctx.accounts.portfolio, ctx.accounts.actor.key())?; let order = &mut ctx.accounts.order; require!(order.status == PaperOrder::OPEN, ResultRegistryError::InvalidPaperOrderAccount); if order.side == PaperOrder::BUY { ctx.accounts.portfolio.available_usdc_cents = ctx.accounts.portfolio.available_usdc_cents.checked_add(order.reserved_cents).ok_or(ResultRegistryError::InvalidPaperOrder)?; ctx.accounts.portfolio.reserved_usdc_cents = ctx.accounts.portfolio.reserved_usdc_cents.checked_sub(order.reserved_cents).ok_or(ResultRegistryError::InvalidPaperOrder)?; } else { ctx.accounts.position.reserved_lots = ctx.accounts.position.reserved_lots.checked_sub(order.remaining_lots).ok_or(ResultRegistryError::InvalidPaperOrder)?; } order.status = PaperOrder::CANCELLED; order.remaining_lots = 0; order.reserved_cents = 0; Ok(()) }

#[derive(Accounts)] pub struct MatchPaperMarketTick<'info> { #[account(mut)] pub actor: Signer<'info>, #[account(mut)] pub portfolio: Account<'info, PaperPortfolio>, #[account(constraint = market.registry == portfolio.registry && market.enabled @ ResultRegistryError::PaperMarketUnavailable)] pub market: Account<'info, PaperMarket>, #[account(mut, seeds = [PAPER_POSITION_SEED, portfolio.key().as_ref(), market.key().as_ref()], bump = position.bump)] pub position: Account<'info, PaperPosition>, #[account(mut, seeds = [PAPER_ORDER_SEED, portfolio.key().as_ref(), &order.id.to_le_bytes()], bump = order.bump, constraint = order.portfolio == portfolio.key() && order.market == market.key() @ ResultRegistryError::InvalidPaperOrderAccount)] pub order: Account<'info, PaperOrder>, /// CHECK: read_oracle validates this external account.
pub oracle_price: UncheckedAccount<'info>, #[account(init, payer = actor, space = PaperFill::SPACE, seeds = [PAPER_FILL_SEED, portfolio.key().as_ref(), &portfolio.next_fill_id.to_le_bytes()], bump)] pub fill: Account<'info, PaperFill>, pub system_program: Program<'info, System> }
pub fn match_market_tick(ctx: Context<MatchPaperMarketTick>) -> Result<()> { active_actor(&ctx.accounts.portfolio, ctx.accounts.actor.key())?; require!(ctx.accounts.order.status == PaperOrder::OPEN, ResultRegistryError::InvalidPaperOrderAccount); let o = read_oracle(&ctx.accounts.market, &ctx.accounts.oracle_price.to_account_info())?; let reference = cents_from_oracle(o, &ctx.accounts.market)?; let side = ctx.accounts.order.side; let crosses = (side == PaperOrder::BUY && ctx.accounts.order.price_cents >= reference) || (side == PaperOrder::SELL && ctx.accounts.order.price_cents <= reference); if !crosses { return mark_equity(&mut ctx.accounts.portfolio, &mut ctx.accounts.position, &ctx.accounts.market, reference); } let lots = ctx.accounts.order.remaining_lots.min(ctx.accounts.market.depth_lots); let price = execution_price(reference, &ctx.accounts.market, side, lots)?; let p = &mut ctx.accounts.portfolio; let order = &mut ctx.accounts.order; if side == PaperOrder::BUY { let reserved = notional_cents(order.price_cents, lots, ctx.accounts.market.lot_size)?; require!(order.reserved_cents >= reserved, ResultRegistryError::InsufficientVirtualFunds); order.reserved_cents -= reserved; p.reserved_usdc_cents = p.reserved_usdc_cents.checked_sub(reserved).ok_or(ResultRegistryError::InvalidPaperOrder)?; p.available_usdc_cents = p.available_usdc_cents.checked_add(reserved).ok_or(ResultRegistryError::InvalidPaperOrder)?; } else { ctx.accounts.position.reserved_lots = ctx.accounts.position.reserved_lots.checked_sub(lots).ok_or(ResultRegistryError::InvalidPaperOrder)?; } let realized = apply_fill(p, &mut ctx.accounts.position, &ctx.accounts.market, side, lots, price)?; order.remaining_lots -= lots; if order.remaining_lots == 0 { if side == PaperOrder::BUY && order.reserved_cents > 0 { p.available_usdc_cents = p.available_usdc_cents.checked_add(order.reserved_cents).ok_or(ResultRegistryError::InvalidPaperOrder)?; p.reserved_usdc_cents = p.reserved_usdc_cents.checked_sub(order.reserved_cents).ok_or(ResultRegistryError::InvalidPaperOrder)?; order.reserved_cents = 0; } order.status = PaperOrder::FILLED; } let fill = &mut ctx.accounts.fill; fill.portfolio = p.key(); fill.market = ctx.accounts.market.key(); fill.id = p.next_fill_id; fill.order_id = order.id; fill.side = side; fill.quantity_lots = lots; fill.price_cents = price; fill.realized_pnl_cents = realized; fill.filled_at = o.published_at; fill.bump = ctx.bumps.fill; p.next_fill_id += 1; mark_equity(p, &mut ctx.accounts.position, &ctx.accounts.market, reference) }

#[derive(Accounts)] #[instruction(week_start: i64)] pub struct CheckpointPortfolioPerformance<'info> { #[account(mut)] pub actor: Signer<'info>, #[account(mut)] pub portfolio: Account<'info, PaperPortfolio>, #[account(mut, seeds = [PAPER_PERFORMANCE_SEED, portfolio.authority.as_ref()], bump = performance.bump, constraint = performance.authority == portfolio.authority @ ResultRegistryError::InvalidPaperPerformance)] pub performance: Account<'info, PortfolioPerformance>, #[account(init_if_needed, payer = actor, space = PortfolioCheckpoint::SPACE, seeds = [PAPER_CHECKPOINT_SEED, performance.key().as_ref(), &week_start.to_le_bytes()], bump)] pub checkpoint: Account<'info, PortfolioCheckpoint>, pub system_program: Program<'info, System> }
pub fn checkpoint_performance(ctx: Context<CheckpointPortfolioPerformance>, week_start: i64) -> Result<()> { active_actor(&ctx.accounts.portfolio, ctx.accounts.actor.key())?; let now = Clock::get()?.unix_timestamp; require!(week_start <= now && now - week_start < 8 * 24 * 60 * 60, ResultRegistryError::InvalidPaperPerformance); let performance = &mut ctx.accounts.performance; let equity = ctx.accounts.portfolio.aggregate_equity_cents; let return_bps = ((equity as i128 - performance.starting_equity_cents as i128) * 10_000 / performance.starting_equity_cents as i128) as i64; performance.current_equity_cents = equity; performance.return_bps = return_bps; performance.latest_checkpoint_at = now; let checkpoint = &mut ctx.accounts.checkpoint; checkpoint.performance = performance.key(); checkpoint.week_start = week_start; checkpoint.equity_cents = equity; checkpoint.return_bps = return_bps; checkpoint.checkpointed_at = now; checkpoint.bump = ctx.bumps.checkpoint; Ok(()) }
