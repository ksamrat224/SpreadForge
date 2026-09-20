use anchor_lang::prelude::*;

use crate::{
    constants::{MAX_SESSION_TICKS, SESSION_SCHEMA_VERSION, SESSION_SEED},
    errors::ResultRegistryError,
    state::SessionState,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeSessionArgs {
    pub scenario_hash: [u8; 32],
    pub strategy_hash: [u8; 32],
    pub initial_state_hash: [u8; 32],
    pub session_signer: Pubkey,
    pub duration_ticks: u16,
    pub expires_at: i64,
    pub schema_version: u8,
    pub run_nonce: u64,
}

#[derive(Accounts)]
#[instruction(args: InitializeSessionArgs)]
pub struct InitializeSession<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = SessionState::SPACE,
        seeds = [SESSION_SEED, authority.key().as_ref(), &args.run_nonce.to_le_bytes()],
        bump,
    )]
    pub session: Account<'info, SessionState>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeSession>, args: InitializeSessionArgs) -> Result<()> {
    require!(
        args.duration_ticks > 0 && args.duration_ticks <= MAX_SESSION_TICKS,
        ResultRegistryError::InvalidSessionDuration
    );
    require!(
        args.schema_version == SESSION_SCHEMA_VERSION,
        ResultRegistryError::UnsupportedSessionSchemaVersion
    );
    require!(
        args.scenario_hash != [0; 32]
            && args.strategy_hash != [0; 32]
            && args.initial_state_hash != [0; 32],
        ResultRegistryError::InvalidHash
    );
    require!(
        args.session_signer != Pubkey::default() && args.expires_at > Clock::get()?.unix_timestamp,
        ResultRegistryError::InvalidSessionAuthorization
    );

    let session = &mut ctx.accounts.session;
    session.authority = ctx.accounts.authority.key();
    session.session_signer = args.session_signer;
    session.scenario_hash = args.scenario_hash;
    session.strategy_hash = args.strategy_hash;
    session.state_hash = args.initial_state_hash;
    session.run_nonce = args.run_nonce;
    session.tick = 0;
    session.duration_ticks = args.duration_ticks;
    session.expires_at = args.expires_at;
    session.status = SessionState::ACTIVE;
    session.schema_version = args.schema_version;
    session.bump = ctx.bumps.session;
    Ok(())
}
