use anchor_lang::prelude::*;

use crate::{errors::ResultRegistryError, state::SessionState};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AdvanceSessionArgs {
    pub tick: u16,
    pub state_hash: [u8; 32],
}

#[derive(Accounts)]
pub struct AdvanceSession<'info> {
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

pub fn handler(ctx: Context<AdvanceSession>, args: AdvanceSessionArgs) -> Result<()> {
    let session = &mut ctx.accounts.session;
    require!(
        session.status == SessionState::ACTIVE,
        ResultRegistryError::SessionNotActive
    );
    require!(args.state_hash != [0; 32], ResultRegistryError::InvalidHash);
    require!(
        ctx.accounts.actor.key() == session.authority
            || (ctx.accounts.actor.key() == session.session_signer
                && Clock::get()?.unix_timestamp <= session.expires_at),
        ResultRegistryError::UnauthorizedSessionActor
    );
    require!(
        args.tick == session.tick.saturating_add(1) && args.tick <= session.duration_ticks,
        ResultRegistryError::InvalidSessionTick
    );

    session.tick = args.tick;
    session.state_hash = args.state_hash;
    Ok(())
}
