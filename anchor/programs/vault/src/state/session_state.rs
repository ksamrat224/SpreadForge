use anchor_lang::prelude::*;

#[account]
pub struct SessionState {
    pub authority: Pubkey,
    pub session_signer: Pubkey,
    pub scenario_hash: [u8; 32],
    pub strategy_hash: [u8; 32],
    pub state_hash: [u8; 32],
    pub run_nonce: u64,
    pub tick: u16,
    pub duration_ticks: u16,
    pub expires_at: i64,
    pub status: u8,
    pub schema_version: u8,
    pub bump: u8,
}

impl SessionState {
    pub const ACTIVE: u8 = 1;
    pub const SETTLED: u8 = 2;
    pub const SPACE: usize = 8 + (32 * 5) + 8 + 2 + 2 + 8 + 1 + 1 + 1;
}
