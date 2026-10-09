use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{anchor::delegate, cpi::DelegateConfig};

use crate::{constants::PAPER_SEED, errors::ResultRegistryError, state::PaperAccount};

#[delegate]
#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct DelegatePaperAccount<'info> {
    /// Pays the refundable delegation deposit, so it must be writable.
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: This PDA is deserialized and authorized before delegation.
    #[account(
        mut,
        del,
        seeds = [PAPER_SEED, authority.key().as_ref(), &nonce.to_le_bytes()],
        bump,
    )]
    pub paper: UncheckedAccount<'info>,
}

/// Delegates the paper account to an Ephemeral Rollup. The optional first
/// remaining account is the router-selected validator identity.
pub fn handler(ctx: Context<DelegatePaperAccount>, nonce: u64) -> Result<()> {
    let data = ctx.accounts.paper.try_borrow_data()?;
    let mut data_slice: &[u8] = &data;
    let paper = PaperAccount::try_deserialize(&mut data_slice)?;
    require_keys_eq!(
        paper.authority,
        ctx.accounts.authority.key(),
        ResultRegistryError::UnauthorizedPaperTrader
    );
    drop(data);

    ctx.accounts.delegate_paper(
        &ctx.accounts.authority,
        &[
            PAPER_SEED,
            ctx.accounts.authority.key().as_ref(),
            &nonce.to_le_bytes(),
        ],
        DelegateConfig {
            validator: ctx.remaining_accounts.first().map(|account| account.key()),
            ..DelegateConfig::default()
        },
    )?;
    Ok(())
}
