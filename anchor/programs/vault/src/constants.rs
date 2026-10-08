pub const RESULT_SEED: &[u8] = b"result";
pub const RESULT_SCHEMA_VERSION: u8 = 2;
pub const MAX_SCORE: u16 = 10_000;

pub const SESSION_SEED: &[u8] = b"session";
pub const MAX_SESSION_TICKS: u16 = 60;
pub const SESSION_SCHEMA_VERSION: u8 = 1;

// Paper trading state is virtual only. These are account namespaces, not token
// accounts, and no instruction in this program transfers an SPL token.
pub const PAPER_REGISTRY_SEED: &[u8] = b"paper-registry";
pub const PAPER_MARKET_SEED: &[u8] = b"paper-market";
pub const PAPER_SESSION_SEED: &[u8] = b"paper-session";
pub const PAPER_POSITION_SEED: &[u8] = b"paper-position";
pub const PAPER_ORDER_SEED: &[u8] = b"paper-order";
pub const PAPER_SCHEMA_VERSION: u8 = 1;
pub const PAPER_STARTING_USDC_CENTS: u64 = 1_000_000;
pub const PAPER_MAX_SESSION_SECONDS: i64 = 60 * 60 * 8;
pub const PAPER_MAX_ORACLE_AGE_SECONDS: i64 = 15;
