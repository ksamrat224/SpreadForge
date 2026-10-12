use anchor_lang::prelude::*;

#[account]
pub struct RankedRun {
    pub authority: Pubkey,
    pub session_signer: Pubkey,
    pub run_nonce: u64,
    pub expires_at: i64,
    pub started_at: i64,
    pub finalized_at: i64,
    pub scenario_id: u8,
    pub schema_version: u8,
    pub status: u8,
    pub bump: u8,
    pub tick: u16,
    pub duration_ticks: u16,
    pub spread_bps: u16,
    pub refresh_ticks: u16,
    pub order_size_milli: u64,
    pub max_inventory_milli: u64,
    pub reference_price_cents: u64,
    pub bid_cents: u64,
    pub ask_cents: u64,
    pub base_milli: u64,
    pub quote_cents: u64,
    pub inventory_cost_cents: u64,
    pub realized_pnl_cents: i64,
    pub equity_cents: u64,
    pub starting_equity_cents: u64,
    pub peak_equity_cents: u64,
    pub max_drawdown_bps: u16,
    pub fill_count: u16,
    pub liquidity_ticks: u16,
    pub has_buy_order: bool,
    pub has_sell_order: bool,
    pub final_score: u16,
}

impl RankedRun {
    pub const ACTIVE: u8 = 1;
    pub const SETTLED: u8 = 2;
    pub const EXPIRED: u8 = 3;
    /// Eight discriminator bytes plus every serialized field above. Keep this
    /// explicit: Anchor does not insert Rust struct padding into account data.
    pub const SPACE: usize = 8 + 214;
}
