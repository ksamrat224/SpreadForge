use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    anchor::commit,
    ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder},
};

use crate::{errors::ResultRegistryError, state::SessionState};

#[commit]
#[derive(Accounts)]
pub struct FinalizeSession<'info> {
    pub actor: Signer<'info>,
    #[account(
        mut,
        seeds = [
            crate::constants::SESSION_SEED,
            session.authority.as_ref(),
            &session.run_nonce.to_le_bytes(),
        ],
        bump = session.bump,
    )]
    pub session: Account<'info, SessionState>,
}

pub fn handler(ctx: Context<FinalizeSession>) -> Result<()> {
    let session = &mut ctx.accounts.session;
    require!(
        session.status == SessionState::ACTIVE,
        ResultRegistryError::SessionNotActive
    );
    require!(
        ctx.accounts.actor.key() == session.authority
            || (ctx.accounts.actor.key() == session.session_signer
                && Clock::get()?.unix_timestamp <= session.expires_at),
        ResultRegistryError::UnauthorizedSessionActor
    );
    require!(
        session.tick == session.duration_ticks,
        ResultRegistryError::SessionNotComplete
    );
    session.status = SessionState::SETTLED;

    MagicIntentBundleBuilder::new(
        ctx.accounts.actor.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.session.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}
