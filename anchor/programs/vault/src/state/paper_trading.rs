use anchor_lang::prelude::*;

#[account]
pub struct PaperMarketRegistry {
    pub authority: Pubkey,
    pub schema_version: u8,
    pub bump: u8,
}
impl PaperMarketRegistry { pub const SPACE: usize = 8 + 32 + 1 + 1; }

#[account]
pub struct PaperMarket {
    pub registry: Pubkey,
    pub market_id: [u8; 16],
    /// Pyth / MagicBlock oracle identity. The program never accepts a client price.
    pub oracle_feed: [u8; 32],
    pub lot_size: u64,
    pub price_multiplier: u32,
    pub half_spread_bps: u16,
    pub depth_lots: u64,
    pub enabled: bool,
    pub bump: u8,
}
impl PaperMarket { pub const SPACE: usize = 8 + 32 + 16 + 32 + 8 + 4 + 2 + 8 + 1 + 1; }

#[account]
pub struct PaperSession {
    pub authority: Pubkey,
    pub session_signer: Pubkey,
    pub registry: Pubkey,
    pub available_usdc_cents: u64,
    pub reserved_usdc_cents: u64,
    pub realized_pnl_cents: i64,
    pub next_order_id: u64,
    pub expires_at: i64,
    pub status: u8,
    pub schema_version: u8,
    pub bump: u8,
}
impl PaperSession {
    pub const ACTIVE: u8 = 1;
    pub const FINALIZED: u8 = 2;
    pub const EXPIRED: u8 = 3;
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1;
}

#[account]
pub struct PaperPosition {
    pub session: Pubkey,
    pub market: Pubkey,
    pub quantity_lots: i64,
    pub reserved_lots: u64,
    pub inventory_cost_cents: u64,
    pub bump: u8,
}
impl PaperPosition { pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1; }

#[account]
pub struct PaperOrder {
    pub session: Pubkey,
    pub market: Pubkey,
    pub id: u64,
    pub side: u8,
    pub price_cents: u64,
    pub remaining_lots: u64,
    pub reserved_cents: u64,
    pub status: u8,
    pub bump: u8,
}
impl PaperOrder {
    pub const BUY: u8 = 1;
    pub const SELL: u8 = 2;
    pub const OPEN: u8 = 1;
    pub const CANCELLED: u8 = 2;
    pub const FILLED: u8 = 3;
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 1 + 8 + 8 + 8 + 1 + 1;
}
