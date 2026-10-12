use anchor_lang::prelude::*;

use crate::{
    constants::{
        RANKED_RUN_SCHEMA_VERSION, RANKED_RUN_SEED, RANKED_RUN_STARTING_BASE_MILLI,
        RANKED_RUN_STARTING_PRICE_CENTS, RANKED_RUN_STARTING_QUOTE_CENTS, RANKED_RUN_TICKS,
        RANKED_RUN_TTL_SECONDS,
    },
    errors::ResultRegistryError,
    state::RankedRun,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StartRankedRunArgs {
    pub scenario_id: u8,
    pub spread_bps: u16,
    pub order_size_milli: u64,
    pub max_inventory_milli: u64,
    pub refresh_ticks: u16,
    pub session_signer: Pubkey,
    pub run_nonce: u64,
    pub schema_version: u8,
}

#[derive(Accounts)]
#[instruction(args: StartRankedRunArgs)]
pub struct StartRankedRun<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = RankedRun::SPACE,
        seeds = [RANKED_RUN_SEED, authority.key().as_ref(), &args.run_nonce.to_le_bytes()],
        bump,
    )]
    pub ranked_run: Account<'info, RankedRun>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<StartRankedRun>, args: StartRankedRunArgs) -> Result<()> {
    require!(args.scenario_id <= 2, ResultRegistryError::InvalidRankedRunScenario);
    require!(
        args.schema_version == RANKED_RUN_SCHEMA_VERSION,
        ResultRegistryError::UnsupportedRankedRunSchemaVersion
    );
    require!(
        args.session_signer != Pubkey::default()
            && args.spread_bps >= 2
            && args.spread_bps <= 1_000
            && args.order_size_milli > 0
            && args.order_size_milli <= args.max_inventory_milli
            && args.max_inventory_milli <= 1_000_000
            && args.refresh_ticks > 0
            && args.refresh_ticks <= RANKED_RUN_TICKS,
        ResultRegistryError::InvalidRankedRunStrategy
    );

    let now = Clock::get()?.unix_timestamp;
    let run = &mut ctx.accounts.ranked_run;
    let starting_equity = equity(
        RANKED_RUN_STARTING_BASE_MILLI,
        RANKED_RUN_STARTING_QUOTE_CENTS,
        RANKED_RUN_STARTING_PRICE_CENTS,
    )?;
    let (bid_cents, ask_cents) = quotes(RANKED_RUN_STARTING_PRICE_CENTS, args.spread_bps)?;

    run.authority = ctx.accounts.authority.key();
    run.session_signer = args.session_signer;
    run.run_nonce = args.run_nonce;
    run.expires_at = now.checked_add(RANKED_RUN_TTL_SECONDS).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
    run.started_at = now;
    run.finalized_at = 0;
    run.scenario_id = args.scenario_id;
    run.schema_version = args.schema_version;
    run.status = RankedRun::ACTIVE;
    run.bump = ctx.bumps.ranked_run;
    run.tick = 0;
    run.duration_ticks = RANKED_RUN_TICKS;
    run.spread_bps = args.spread_bps;
    run.refresh_ticks = args.refresh_ticks;
    run.order_size_milli = args.order_size_milli;
    run.max_inventory_milli = args.max_inventory_milli;
    run.reference_price_cents = RANKED_RUN_STARTING_PRICE_CENTS;
    run.bid_cents = bid_cents;
    run.ask_cents = ask_cents;
    run.base_milli = RANKED_RUN_STARTING_BASE_MILLI;
    run.quote_cents = RANKED_RUN_STARTING_QUOTE_CENTS;
    run.inventory_cost_cents = value(RANKED_RUN_STARTING_BASE_MILLI, RANKED_RUN_STARTING_PRICE_CENTS)?;
    run.realized_pnl_cents = 0;
    run.equity_cents = starting_equity;
    run.starting_equity_cents = starting_equity;
    run.peak_equity_cents = starting_equity;
    run.max_drawdown_bps = 0;
    run.fill_count = 0;
    run.liquidity_ticks = 0;
    run.has_buy_order = RANKED_RUN_STARTING_BASE_MILLI.checked_add(args.order_size_milli).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))? <= args.max_inventory_milli
        && run.quote_cents >= value(args.order_size_milli, bid_cents)?;
    run.has_sell_order = RANKED_RUN_STARTING_BASE_MILLI >= args.order_size_milli;
    run.final_score = 0;
    Ok(())
}

pub(crate) fn value(quantity_milli: u64, price_cents: u64) -> Result<u64> {
    let product = (quantity_milli as u128)
        .checked_mul(price_cents as u128)
        .ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
    u64::try_from(product.checked_add(500).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))? / 1_000)
        .map_err(|_| error!(ResultRegistryError::RankedRunMathOverflow))
}

pub(crate) fn equity(base_milli: u64, quote_cents: u64, price_cents: u64) -> Result<u64> {
    quote_cents.checked_add(value(base_milli, price_cents)?)
        .ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))
}

pub(crate) fn quotes(reference_price_cents: u64, spread_bps: u16) -> Result<(u64, u64)> {
    let half_spread = u64::from(spread_bps).div_ceil(2).max(1);
    let bid = (reference_price_cents as u128)
        .checked_mul(10_000_u128.checked_sub(half_spread as u128).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?)
        .ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))? / 10_000;
    let ask_product = (reference_price_cents as u128)
        .checked_mul(10_000_u128.checked_add(half_spread as u128).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?)
        .ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
    let ask = ask_product.checked_add(9_999).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))? / 10_000;
    Ok((
        u64::try_from(bid).map_err(|_| error!(ResultRegistryError::RankedRunMathOverflow))?,
        u64::try_from(ask).map_err(|_| error!(ResultRegistryError::RankedRunMathOverflow))?,
    ))
}
