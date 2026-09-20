use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{anchor::delegate, cpi::DelegateConfig};

use crate::{constants::SESSION_SEED, errors::ResultRegistryError, state::SessionState};

#[delegate]
#[derive(Accounts)]
#[instruction(run_nonce: u64)]
pub struct DelegateSession<'info> {
    pub authority: Signer<'info>,
    /// CHECK: This PDA is deserialized and authorized before delegation.
    #[account(
        mut,
        del,
        seeds = [SESSION_SEED, authority.key().as_ref(), &run_nonce.to_le_bytes()],
        bump,
    )]
    pub session: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<DelegateSession>, run_nonce: u64) -> Result<()> {
    let data = ctx.accounts.session.try_borrow_data()?;
    let mut data_slice: &[u8] = &data;
    let session = SessionState::try_deserialize(&mut data_slice)?;
    require_keys_eq!(
        session.authority,
        ctx.accounts.authority.key(),
        ResultRegistryError::UnauthorizedSessionActor
    );
    require!(
        session.run_nonce == run_nonce && session.status == SessionState::ACTIVE,
        ResultRegistryError::SessionNotActive
    );
    require!(
        Clock::get()?.unix_timestamp <= session.expires_at,
        ResultRegistryError::SessionExpired
    );
    drop(data);

    ctx.accounts.delegate_session(
        &ctx.accounts.authority,
        &[
            SESSION_SEED,
            ctx.accounts.authority.key().as_ref(),
            &run_nonce.to_le_bytes(),
        ],
        DelegateConfig::default(),
    )?;
    Ok(())
}
