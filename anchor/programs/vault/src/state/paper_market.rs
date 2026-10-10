use anchor_lang::prelude::*;

/// One immutable mapping from a displayed asset id to a Pyth feed id. The
/// exchange admin configures these before the public UI is enabled.
#[account]
#[derive(InitSpace)]
pub struct PaperMarket {
    pub asset: u8,
    pub feed_id: [u8; 32],
    pub bump: u8,
}

impl PaperMarket {
    pub const SPACE: usize = 8 + Self::INIT_SPACE;
}

/// Global exchange policy. It is created during deployment, before public
/// portfolio opening is enabled, and gives configuration authority to admin.
#[account]
#[derive(InitSpace)]
pub struct PaperExchange {
    pub admin: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}

impl PaperExchange {
    pub const SPACE: usize = 8 + Self::INIT_SPACE;
}
