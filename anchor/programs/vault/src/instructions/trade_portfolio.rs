use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use solana_sha256_hasher::hashv;

use crate::{
    constants::{
        BPS_DENOMINATOR, PAPER_ASSET_COUNT, PAPER_CONFIG_SEED, PAPER_MARKET_SEED,
        PAPER_ORACLE_MAX_AGE_SECONDS, PAPER_RECENT_FILLS, PAPER_SEED,
    },
    errors::ResultRegistryError,
    state::{PaperAccount, PaperExchange, PaperFill, PaperMarket, PaperPosition},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TradePortfolioArgs {
    pub asset: u8,
    pub side: u8,
    pub size_milli: u64,
    /// The cents quote displayed to the trader before wallet confirmation.
    pub expected_price_cents: u64,
    pub max_slippage_bps: u16,
}

#[event]
pub struct PaperTradeExecuted {
    pub authority: Pubkey,
    pub asset: u8,
    pub side: u8,
    pub size_milli: u64,
    pub price_cents: u64,
    pub fee_cents: u64,
    pub executed_at: i64,
}

#[derive(Accounts)]
#[instruction(args: TradePortfolioArgs)]
pub struct TradePortfolio<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [PAPER_SEED, authority.key().as_ref()],
        bump = portfolio.bump,
        has_one = authority @ ResultRegistryError::UnauthorizedPaperTrader,
    )]
    pub portfolio: Account<'info, PaperAccount>,
    #[account(seeds = [PAPER_CONFIG_SEED], bump = exchange.bump)]
    pub exchange: Account<'info, PaperExchange>,
    #[account(
        seeds = [PAPER_MARKET_SEED, &[args.asset]],
        bump = market.bump,
        constraint = market.asset == args.asset @ ResultRegistryError::InvalidPaperAsset,
    )]
    pub market: Account<'info, PaperMarket>,
    /// A fully verified Pyth Receiver price update. Its owner and discriminator
    /// are checked by Anchor's Account deserialization.
    pub price_update: Account<'info, PriceUpdateV2>,
}

pub fn handler(ctx: Context<TradePortfolio>, args: TradePortfolioArgs) -> Result<()> {
    require!(
        (args.asset as usize) < PAPER_ASSET_COUNT,
        ResultRegistryError::InvalidPaperAsset
    );
    require!(
        args.side <= PaperAccount::SELL && args.size_milli > 0 && args.expected_price_cents > 0,
        ResultRegistryError::InvalidPaperOrder
    );
    let clock = Clock::get()?;
    let oracle = ctx
        .accounts
        .price_update
        .get_price_no_older_than(&clock, PAPER_ORACLE_MAX_AGE_SECONDS, &ctx.accounts.market.feed_id)
        .map_err(|_| error!(ResultRegistryError::InvalidPaperOracle))?;
    let price_cents = price_to_cents(oracle.price, oracle.exponent)?;
    require_slippage(price_cents, args.expected_price_cents, args.max_slippage_bps)?;

    let portfolio = &mut ctx.accounts.portfolio;
    let index = args.asset as usize;
    let position = portfolio.positions[index];
    let gross = notional(price_cents, args.size_milli, if args.side == PaperAccount::BUY { 999 } else { 0 })?;
    let fee = fee_cents(gross, ctx.accounts.exchange.fee_bps)?;

    if args.side == PaperAccount::BUY {
        let total = checked(gross.checked_add(fee))?;
        require!(portfolio.usdc_cents >= total, ResultRegistryError::InsufficientPaperBalance);
        portfolio.usdc_cents -= total;
        portfolio.positions[index] = PaperPosition {
            quantity_milli: checked(position.quantity_milli.checked_add(args.size_milli))?,
            inventory_cost_cents: checked(position.inventory_cost_cents.checked_add(total))?,
        };
    } else {
        require!(position.quantity_milli >= args.size_milli, ResultRegistryError::InsufficientPaperBalance);
        let sold_cost = (position.inventory_cost_cents as u128 * args.size_milli as u128
            / position.quantity_milli as u128) as u64;
        let proceeds = gross.checked_sub(fee).ok_or_else(|| error!(ResultRegistryError::PaperMathOverflow))?;
        portfolio.usdc_cents = checked(portfolio.usdc_cents.checked_add(proceeds))?;
        portfolio.positions[index] = PaperPosition {
            quantity_milli: position.quantity_milli - args.size_milli,
            inventory_cost_cents: position.inventory_cost_cents - sold_cost,
        };
        let realized = proceeds as i128 - sold_cost as i128 + portfolio.realized_pnl_cents as i128;
        portfolio.realized_pnl_cents = i64::try_from(realized)
            .map_err(|_| error!(ResultRegistryError::PaperMathOverflow))?;
    }

    let fill = PaperFill {
        asset: args.asset,
        side: args.side,
        fee_cents: fee,
        price_cents,
        size_milli: args.size_milli,
        price_at: oracle.publish_time,
        executed_at: clock.unix_timestamp,
    };
    let slot = portfolio.trade_count as usize % PAPER_RECENT_FILLS;
    portfolio.recent_fills[slot] = fill;
    portfolio.trade_log_hash = hashv(&[
        &portfolio.trade_log_hash,
        &[fill.asset, fill.side],
        &fill.fee_cents.to_le_bytes(),
        &fill.price_cents.to_le_bytes(),
        &fill.size_milli.to_le_bytes(),
        &fill.price_at.to_le_bytes(),
        &fill.executed_at.to_le_bytes(),
    ]).to_bytes();
    portfolio.trade_count = checked(portfolio.trade_count.checked_add(1))?;
    portfolio.updated_at = clock.unix_timestamp;
    emit!(PaperTradeExecuted {
        authority: ctx.accounts.authority.key(),
        asset: args.asset,
        side: args.side,
        size_milli: args.size_milli,
        price_cents,
        fee_cents: fee,
        executed_at: clock.unix_timestamp,
    });
    Ok(())
}

fn price_to_cents(price: i64, exponent: i32) -> Result<u64> {
    require!(price > 0 && (-18..=18).contains(&exponent), ResultRegistryError::InvalidPaperOracle);
    let scale = 10_u128.checked_pow(exponent.unsigned_abs()).ok_or_else(|| error!(ResultRegistryError::PaperMathOverflow))?;
    let value = if exponent >= 0 {
        (price as u128).checked_mul(scale).and_then(|v| v.checked_mul(100))
    } else {
        (price as u128).checked_mul(100).map(|v| v / scale)
    }.ok_or_else(|| error!(ResultRegistryError::PaperMathOverflow))?;
    u64::try_from(value).map_err(|_| error!(ResultRegistryError::PaperMathOverflow))
}

fn require_slippage(actual: u64, expected: u64, max_bps: u16) -> Result<()> {
    let difference = actual.abs_diff(expected) as u128;
    let lhs = difference.checked_mul(BPS_DENOMINATOR).ok_or_else(|| error!(ResultRegistryError::PaperMathOverflow))?;
    let rhs = (expected as u128).checked_mul(max_bps as u128).ok_or_else(|| error!(ResultRegistryError::PaperMathOverflow))?;
    require!(lhs <= rhs, ResultRegistryError::PaperSlippageExceeded);
    Ok(())
}

fn notional(price_cents: u64, size_milli: u64, bias: u128) -> Result<u64> {
    u64::try_from(((price_cents as u128)
        .checked_mul(size_milli as u128)
        .ok_or_else(|| error!(ResultRegistryError::PaperMathOverflow))?
        .checked_add(bias)
        .ok_or_else(|| error!(ResultRegistryError::PaperMathOverflow))?) / 1000)
    .map_err(|_| error!(ResultRegistryError::PaperMathOverflow))
}

fn fee_cents(gross: u64, bps: u16) -> Result<u64> {
    let numerator = (gross as u128)
        .checked_mul(bps as u128)
        .and_then(|v| v.checked_add(BPS_DENOMINATOR - 1))
        .ok_or_else(|| error!(ResultRegistryError::PaperMathOverflow))?;
    u64::try_from(numerator / BPS_DENOMINATOR)
        .map_err(|_| error!(ResultRegistryError::PaperMathOverflow))
}

fn checked<T>(value: Option<T>) -> Result<T> {
    value.ok_or_else(|| error!(ResultRegistryError::PaperMathOverflow))
}
