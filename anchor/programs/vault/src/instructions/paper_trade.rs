use anchor_lang::prelude::*;
use solana_sha256_hasher::hashv;

use crate::{
    constants::{
        MAX_PAPER_PRICE_AGE_MS, MAX_PAPER_PRICE_LEAD_MS, PAPER_ASSET_COUNT, PAPER_RECENT_FILLS,
        PAPER_SEED,
    },
    errors::ResultRegistryError,
    state::{PaperAccount, PaperFill, PaperPosition},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PaperTradeArgs {
    pub asset: u8,
    pub side: u8,
    pub source: u8,
    /// Wallet-supplied reference price. Stored as a wallet-committed value.
    pub price_cents: u64,
    pub size_milli: u64,
    pub price_at_ms: i64,
}

#[derive(Accounts)]
pub struct PaperTrade<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [PAPER_SEED, paper.authority.as_ref(), &paper.nonce.to_le_bytes()],
        bump = paper.bump,
        has_one = authority @ ResultRegistryError::UnauthorizedPaperTrader,
    )]
    pub paper: Account<'info, PaperAccount>,
}

pub fn handler(ctx: Context<PaperTrade>, args: PaperTradeArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(
        (args.asset as usize) < PAPER_ASSET_COUNT,
        ResultRegistryError::InvalidPaperAsset
    );
    require!(
        args.side <= PaperAccount::SELL
            && args.source <= PaperAccount::LIMIT
            && args.size_milli > 0,
        ResultRegistryError::InvalidPaperOrder
    );
    require_fresh_price(args.price_cents, args.price_at_ms, now)?;

    let paper = &mut ctx.accounts.paper;
    let index = args.asset as usize;
    let position = paper.positions[index];
    if args.side == PaperAccount::BUY {
        // Costs round up and proceeds round down, so no order is ever free.
        let cost = notional_ceil(args.price_cents, args.size_milli)?;
        require!(
            paper.usdc_cents >= cost,
            ResultRegistryError::InsufficientPaperBalance
        );
        paper.usdc_cents -= cost;
        paper.positions[index] = PaperPosition {
            quantity_milli: checked(position.quantity_milli.checked_add(args.size_milli))?,
            inventory_cost_cents: checked(position.inventory_cost_cents.checked_add(cost))?,
        };
    } else {
        require!(
            position.quantity_milli >= args.size_milli,
            ResultRegistryError::InsufficientPaperBalance
        );
        let proceeds = notional_floor(args.price_cents, args.size_milli)?;
        // Average cost of the units sold; selling the whole position clears it.
        let sold_cost = (position.inventory_cost_cents as u128 * args.size_milli as u128
            / position.quantity_milli as u128) as u64;
        paper.usdc_cents = checked(paper.usdc_cents.checked_add(proceeds))?;
        paper.positions[index] = PaperPosition {
            quantity_milli: position.quantity_milli - args.size_milli,
            inventory_cost_cents: position.inventory_cost_cents - sold_cost,
        };
        let realized = proceeds as i128 - sold_cost as i128 + paper.realized_pnl_cents as i128;
        paper.realized_pnl_cents =
            i64::try_from(realized).map_err(|_| error!(ResultRegistryError::PaperMathOverflow))?;
    }

    let fill = PaperFill {
        asset: args.asset,
        side: args.side,
        source: args.source,
        price_cents: args.price_cents,
        size_milli: args.size_milli,
        price_at_ms: args.price_at_ms,
        executed_at: now,
    };
    let slot = paper.trade_count as usize % PAPER_RECENT_FILLS;
    paper.recent_fills[slot] = fill;
    paper.trade_log_hash = hashv(&[
        &paper.trade_log_hash,
        &[fill.asset, fill.side, fill.source],
        &fill.price_cents.to_le_bytes(),
        &fill.size_milli.to_le_bytes(),
        &fill.price_at_ms.to_le_bytes(),
        &fill.executed_at.to_le_bytes(),
    ])
    .to_bytes();
    paper.trade_count = checked(paper.trade_count.checked_add(1))?;
    paper.updated_at = now;
    Ok(())
}

/// Rejects a missing price or one published too long before (or after) the
/// cluster clock, which also keeps historical replay prices off chain.
pub fn require_fresh_price(price_cents: u64, price_at_ms: i64, now: i64) -> Result<()> {
    require!(price_cents > 0, ResultRegistryError::InvalidPaperOrder);
    let now_ms = now.saturating_mul(1000);
    require!(
        now_ms.saturating_sub(price_at_ms) <= MAX_PAPER_PRICE_AGE_MS
            && price_at_ms.saturating_sub(now_ms) <= MAX_PAPER_PRICE_LEAD_MS,
        ResultRegistryError::StalePaperPrice
    );
    Ok(())
}

pub fn notional_ceil(price_cents: u64, size_milli: u64) -> Result<u64> {
    notional(price_cents, size_milli, 999)
}

pub fn notional_floor(price_cents: u64, size_milli: u64) -> Result<u64> {
    notional(price_cents, size_milli, 0)
}

pub fn notional_round(price_cents: u64, size_milli: u64) -> Result<u64> {
    notional(price_cents, size_milli, 500)
}

fn notional(price_cents: u64, size_milli: u64, bias: u128) -> Result<u64> {
    u64::try_from((price_cents as u128 * size_milli as u128 + bias) / 1000)
        .map_err(|_| error!(ResultRegistryError::PaperMathOverflow))
}

fn checked<T>(value: Option<T>) -> Result<T> {
    value.ok_or_else(|| error!(ResultRegistryError::PaperMathOverflow))
}
