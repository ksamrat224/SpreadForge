use anchor_lang::prelude::*;

use crate::{
    constants::{
        PAPER_FIXED_USDC_CENTS, PAPER_SCHEMA_VERSION, PAPER_SEED, PAPER_SOL_INDEX,
        WALLET_PAPER_SOL_CAP_MILLI,
    },
    errors::ResultRegistryError,
    instructions::paper_trade::{notional_round, require_fresh_price},
    state::{PaperAccount, PaperPosition},
};

const LAMPORTS_PER_MILLI_SOL: u64 = 1_000_000;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct OpenPaperAccountArgs {
    pub nonce: u64,
    pub funding_source: u8,
    /// Wallet funding only: the SOL/USD reference that values the mirrored SOL.
    pub sol_price_cents: u64,
    pub price_at_ms: i64,
}

#[derive(Accounts)]
#[instruction(args: OpenPaperAccountArgs)]
pub struct OpenPaperAccount<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = PaperAccount::SPACE,
        seeds = [PAPER_SEED, authority.key().as_ref(), &args.nonce.to_le_bytes()],
        bump,
    )]
    pub paper: Account<'info, PaperAccount>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<OpenPaperAccount>, args: OpenPaperAccountArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    // Read after `init` has charged rent, so the mirror never exceeds what the
    // wallet still holds. No lamports move beyond that rent deposit.
    let wallet_lamports = ctx.accounts.authority.lamports();
    let paper = &mut ctx.accounts.paper;
    paper.authority = ctx.accounts.authority.key();
    paper.nonce = args.nonce;
    paper.funding_source = args.funding_source;
    paper.schema_version = PAPER_SCHEMA_VERSION;
    paper.bump = ctx.bumps.paper;
    paper.created_at = now;
    paper.updated_at = now;

    match args.funding_source {
        PaperAccount::FIXED_FUNDING => {
            paper.usdc_cents = PAPER_FIXED_USDC_CENTS;
            paper.start_equity_cents = PAPER_FIXED_USDC_CENTS;
        }
        PaperAccount::WALLET_FUNDING => {
            require_fresh_price(args.sol_price_cents, args.price_at_ms, now)?;
            let virtual_sol =
                (wallet_lamports / LAMPORTS_PER_MILLI_SOL).min(WALLET_PAPER_SOL_CAP_MILLI);
            require!(virtual_sol > 0, ResultRegistryError::InvalidPaperFunding);
            let start_equity = notional_round(args.sol_price_cents, virtual_sol)?;
            paper.positions[PAPER_SOL_INDEX] = PaperPosition {
                quantity_milli: virtual_sol,
                inventory_cost_cents: start_equity,
            };
            paper.start_equity_cents = start_equity;
        }
        _ => return err!(ResultRegistryError::InvalidPaperFunding),
    }
    Ok(())
}
