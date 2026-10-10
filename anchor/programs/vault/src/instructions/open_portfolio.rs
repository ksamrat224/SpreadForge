use anchor_lang::prelude::*;

use crate::{
    constants::{PAPER_FIXED_USDC_CENTS, PAPER_SCHEMA_VERSION, PAPER_SEED},
    state::PaperAccount,
};

#[derive(Accounts)]
pub struct OpenPortfolio<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = PaperAccount::SPACE,
        seeds = [PAPER_SEED, authority.key().as_ref()],
        bump,
    )]
    pub portfolio: Account<'info, PaperAccount>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<OpenPortfolio>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let portfolio = &mut ctx.accounts.portfolio;
    portfolio.authority = ctx.accounts.authority.key();
    portfolio.schema_version = PAPER_SCHEMA_VERSION;
    portfolio.bump = ctx.bumps.portfolio;
    portfolio.created_at = now;
    portfolio.updated_at = now;
    portfolio.usdc_cents = PAPER_FIXED_USDC_CENTS;
    portfolio.start_equity_cents = PAPER_FIXED_USDC_CENTS;
    Ok(())
}
