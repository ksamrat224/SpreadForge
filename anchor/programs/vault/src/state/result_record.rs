use anchor_lang::prelude::*;

#[account]
pub struct ResultRecord {
    pub authority: Pubkey,
    pub scenario_hash: [u8; 32],
    pub strategy_hash: [u8; 32],
    pub result_hash: [u8; 32],
    pub total_score: u16,
    pub pnl_bps: i32,
    pub max_drawdown_bps: u16,
    pub fills: u16,
    pub schema_version: u8,
    pub submitted_at: i64,
    pub run_nonce: u64,
    pub bump: u8,
}

impl ResultRecord {
    pub const SPACE: usize = 8 + 32 + (32 * 3) + 2 + 4 + 2 + 2 + 1 + 8 + 8 + 1;
}
