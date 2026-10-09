pub const RESULT_SEED: &[u8] = b"result";
pub const RESULT_SCHEMA_VERSION: u8 = 2;
pub const MAX_SCORE: u16 = 10_000;

pub const SESSION_SEED: &[u8] = b"session";
pub const MAX_SESSION_TICKS: u16 = 60;
pub const SESSION_SCHEMA_VERSION: u8 = 1;

pub const PAPER_SEED: &[u8] = b"paper";
pub const PAPER_SCHEMA_VERSION: u8 = 1;
/// Markets in frontend `PAPER_ASSETS` order; an asset's index is its id.
pub const PAPER_ASSET_COUNT: usize = 20;
pub const PAPER_SOL_INDEX: usize = 2;
pub const PAPER_RECENT_FILLS: usize = 16;
pub const PAPER_FIXED_USDC_CENTS: u64 = 1_000_000;
pub const WALLET_PAPER_SOL_CAP_MILLI: u64 = 10_000;
/// Allows a few seconds of feed latency plus the time to approve in a wallet.
pub const MAX_PAPER_PRICE_AGE_MS: i64 = 120_000;
pub const MAX_PAPER_PRICE_LEAD_MS: i64 = 30_000;
