use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    anchor::commit,
    ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder},
};

use crate::{constants::PAPER_PORTFOLIO_SEED, errors::ResultRegistryError, state::PaperPortfolio};

/// Commits and undelegates an unused or wrongly-routed portfolio. This runs
/// on its current ER; after completion the client may delegate it only to the
/// explicitly configured Private ER validator.
#[commit]
#[derive(Accounts)]
pub struct RecoverPaperPortfolio<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [PAPER_PORTFOLIO_SEED, authority.key().as_ref()],
        bump = portfolio.bump,
        has_one = authority,
    )]
    pub portfolio: Account<'info, PaperPortfolio>,
}

pub fn handler(ctx: Context<RecoverPaperPortfolio>) -> Result<()> {
    require!(ctx.accounts.portfolio.status == PaperPortfolio::ACTIVE, ResultRegistryError::PaperPortfolioNotActive);
    MagicIntentBundleBuilder::new(
        ctx.accounts.authority.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.portfolio.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}
