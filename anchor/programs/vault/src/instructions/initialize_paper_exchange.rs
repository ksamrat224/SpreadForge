use anchor_lang::prelude::*;

use crate::{
    constants::{PAPER_CONFIG_SEED, PAPER_FEE_BPS},
    state::PaperExchange,
};

#[derive(Accounts)]
pub struct InitializePaperExchange<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = PaperExchange::SPACE,
        seeds = [PAPER_CONFIG_SEED],
        bump,
    )]
    pub exchange: Account<'info, PaperExchange>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializePaperExchange>) -> Result<()> {
    let exchange = &mut ctx.accounts.exchange;
    exchange.admin = ctx.accounts.admin.key();
    exchange.fee_bps = PAPER_FEE_BPS;
    exchange.bump = ctx.bumps.exchange;
    Ok(())
}
