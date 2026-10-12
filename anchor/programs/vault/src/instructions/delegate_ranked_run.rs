use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{anchor::delegate, cpi::DelegateConfig};

use crate::{constants::RANKED_RUN_SEED, errors::ResultRegistryError, state::RankedRun};

#[delegate]
#[derive(Accounts)]
#[instruction(run_nonce: u64)]
pub struct DelegateRankedRun<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: The PDA is decoded and authorized before it is delegated.
    #[account(
        mut,
        del,
        seeds = [RANKED_RUN_SEED, authority.key().as_ref(), &run_nonce.to_le_bytes()],
        bump,
    )]
    pub ranked_run: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<DelegateRankedRun>, run_nonce: u64) -> Result<()> {
    let data = ctx.accounts.ranked_run.try_borrow_data()?;
    let mut data_slice: &[u8] = &data;
    let run = RankedRun::try_deserialize(&mut data_slice)?;
    require_keys_eq!(run.authority, ctx.accounts.authority.key(), ResultRegistryError::UnauthorizedRankedRunActor);
    require!(run.run_nonce == run_nonce && run.status == RankedRun::ACTIVE, ResultRegistryError::RankedRunNotActive);
    require!(Clock::get()?.unix_timestamp <= run.expires_at, ResultRegistryError::RankedRunExpired);
    drop(data);

    ctx.accounts.delegate_ranked_run(
        &ctx.accounts.authority,
        &[RANKED_RUN_SEED, ctx.accounts.authority.key().as_ref(), &run_nonce.to_le_bytes()],
        DelegateConfig::default(),
    )?;
    Ok(())
}
