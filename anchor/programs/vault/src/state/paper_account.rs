use anchor_lang::prelude::*;

/// Position in one paper market. Quantities are thousandths of the asset.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace)]
pub struct PaperPosition {
    pub quantity_milli: u64,
    pub inventory_cost_cents: u64,
}

/// One executed paper trade, kept in a fixed ring of the most recent fills.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace)]
pub struct PaperFill {
    pub asset: u8,
    pub side: u8,
    pub source: u8,
    pub price_cents: u64,
    pub size_milli: u64,
    /// Publish time of the wallet-supplied reference price, in milliseconds.
    pub price_at_ms: i64,
    /// Cluster clock when the trade executed, in seconds.
    pub executed_at: i64,
}

/// A wallet-owned paper portfolio. Balances are simulated, but every change
/// is authorized by the wallet and executed by this program, typically on a
/// MagicBlock Ephemeral Rollup between delegation and settlement.
///
/// Array lengths must match `PAPER_ASSET_COUNT` and `PAPER_RECENT_FILLS`; they
/// are literals so the IDL records concrete sizes.
#[account]
#[derive(InitSpace)]
pub struct PaperAccount {
    pub authority: Pubkey,
    pub nonce: u64,
    pub funding_source: u8,
    pub schema_version: u8,
    pub bump: u8,
    pub created_at: i64,
    pub updated_at: i64,
    pub usdc_cents: u64,
    pub start_equity_cents: u64,
    pub realized_pnl_cents: i64,
    pub trade_count: u32,
    /// SHA-256 chain over every fill: hash(previous || encoded fill).
    pub trade_log_hash: [u8; 32],
    pub positions: [PaperPosition; 20],
    pub recent_fills: [PaperFill; 16],
}

impl PaperAccount {
    pub const FIXED_FUNDING: u8 = 0;
    pub const WALLET_FUNDING: u8 = 1;
    pub const BUY: u8 = 0;
    pub const SELL: u8 = 1;
    pub const MARKET: u8 = 0;
    pub const LIMIT: u8 = 1;
    pub const SPACE: usize = 8 + Self::INIT_SPACE;
}
