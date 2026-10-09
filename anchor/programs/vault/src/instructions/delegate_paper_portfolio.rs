use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{anchor::delegate, cpi::DelegateConfig};

use crate::{constants::PAPER_PORTFOLIO_SEED, errors::ResultRegistryError, state::PaperPortfolio};

/// Routes the portfolio account to the selected MagicBlock ER. Positions,
/// orders and fills are created by ER instructions and are therefore private
/// to that routed execution environment.
#[delegate]
#[derive(Accounts)]
pub struct DelegatePaperPortfolio<'info> {
    pub authority: Signer<'info>,
    /// CHECK: validated by deserializing it before delegation.
    #[account(mut, del, seeds = [PAPER_PORTFOLIO_SEED, authority.key().as_ref()], bump)]
    pub portfolio: UncheckedAccount<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DelegatePaperPortfolioArgs {
    /// MagicBlock-provisioned TEE validator identity. It is explicit so the
    /// router never silently selects a public ER for private portfolio state.
    pub validator: Pubkey,
}

pub fn handler(ctx: Context<DelegatePaperPortfolio>, args: DelegatePaperPortfolioArgs) -> Result<()> {
    require!(args.validator != Pubkey::default(), ResultRegistryError::InvalidPrivateErValidator);
    let data = ctx.accounts.portfolio.try_borrow_data()?;
    let mut bytes: &[u8] = &data;
    let portfolio = PaperPortfolio::try_deserialize(&mut bytes)?;
    require_keys_eq!(portfolio.authority, ctx.accounts.authority.key(), ResultRegistryError::UnauthorizedPaperPortfolioActor);
    require!(portfolio.status == PaperPortfolio::ACTIVE, ResultRegistryError::PaperPortfolioNotActive);
    drop(data);

    ctx.accounts.delegate_portfolio(
        &ctx.accounts.authority,
        &[PAPER_PORTFOLIO_SEED, ctx.accounts.authority.key().as_ref()],
        DelegateConfig { validator: Some(args.validator), ..DelegateConfig::default() },
    )?;
    Ok(())
}
