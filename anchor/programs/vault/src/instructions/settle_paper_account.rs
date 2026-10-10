use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    anchor::commit,
    ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder},
};

use crate::{constants::PAPER_SEED, errors::ResultRegistryError, state::PaperAccount};

#[commit]
#[derive(Accounts)]
pub struct SettlePaperAccount<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [PAPER_SEED, paper.authority.as_ref(), &paper.nonce.to_le_bytes()],
        bump = paper.bump,
        has_one = authority @ ResultRegistryError::UnauthorizedPaperTrader,
    )]
    pub paper: Account<'info, PaperAccount>,
}

/// Commits the latest balances to Solana and returns the account to this
/// program. Trading can resume by delegating it again.
pub fn handler(ctx: Context<SettlePaperAccount>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.authority.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.paper.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}
