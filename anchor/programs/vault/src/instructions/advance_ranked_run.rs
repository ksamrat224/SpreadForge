use anchor_lang::prelude::*;

use crate::{
    errors::ResultRegistryError,
    state::RankedRun,
};

use super::start_ranked_run::{equity, quotes, value};

#[derive(Accounts)]
pub struct AdvanceRankedRun<'info> {
    pub actor: Signer<'info>,
    #[account(
        mut,
        seeds = [
            crate::constants::RANKED_RUN_SEED,
            ranked_run.authority.as_ref(),
            &ranked_run.run_nonce.to_le_bytes(),
        ],
        bump = ranked_run.bump,
    )]
    pub ranked_run: Account<'info, RankedRun>,
}

pub fn handler(ctx: Context<AdvanceRankedRun>) -> Result<()> {
    let run = &mut ctx.accounts.ranked_run;
    require!(run.status == RankedRun::ACTIVE, ResultRegistryError::RankedRunNotActive);
    require!(
        ctx.accounts.actor.key() == run.authority || ctx.accounts.actor.key() == run.session_signer,
        ResultRegistryError::UnauthorizedRankedRunActor
    );
    // Session authority expires, but the wallet owner can still rescue a run.
    if ctx.accounts.actor.key() != run.authority {
        require!(Clock::get()?.unix_timestamp <= run.expires_at, ResultRegistryError::RankedRunExpired);
    }
    require!(run.tick < run.duration_ticks, ResultRegistryError::RankedRunNotComplete);

    let tick = run.tick.checked_add(1).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
    let (noise, fill_roll) = random_at(scenario_seed(run.scenario_id)?, tick);
    let event_move = scenario_event_move(run.scenario_id, tick)?;
    let noise_move = noise_move_bps(noise);
    let move_bps = noise_move.checked_add(event_move).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
    let multiplier = 10_000_i64.checked_add(move_bps).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
    require!(multiplier > 0, ResultRegistryError::RankedRunMathOverflow);
    let reference = ((run.reference_price_cents as u128)
        .checked_mul(multiplier as u128)
        .ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?
        .checked_add(5_000).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))? / 10_000)
        .max(100);
    let reference_price_cents = u64::try_from(reference).map_err(|_| error!(ResultRegistryError::RankedRunMathOverflow))?;
    let (bid_cents, ask_cents) = quotes(reference_price_cents, run.spread_bps)?;
    let is_refresh = tick % run.refresh_ticks == 0;

    if is_refresh {
        run.bid_cents = bid_cents;
        run.ask_cents = ask_cents;
        run.has_buy_order = run.base_milli.checked_add(run.order_size_milli).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))? <= run.max_inventory_milli
            && run.quote_cents >= value(run.order_size_milli, run.bid_cents)?;
        run.has_sell_order = run.base_milli >= run.order_size_milli;
    }

    // A quote remains at its last refresh price until filled or replaced.
    // Count a tick as liquid when at least one order was available to takers.
    let quoted_this_tick = run.has_buy_order || run.has_sell_order;

    let deviation = i128::from(reference_price_cents) - i128::from(run.reference_price_cents);
    let aggressive_flow = event_move.unsigned_abs() >= 200;
    let fills = fill_roll < 3_221_225_472;
    if run.has_buy_order && deviation < 0 && (fills || aggressive_flow) {
        let cost = value(run.order_size_milli, run.bid_cents)?;
        run.base_milli = run.base_milli.checked_add(run.order_size_milli).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
        run.quote_cents = run.quote_cents.checked_sub(cost).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
        run.inventory_cost_cents = run.inventory_cost_cents.checked_add(cost).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
        run.has_buy_order = false;
        run.fill_count = run.fill_count.checked_add(1).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
    } else if run.has_sell_order && deviation > 0 && (fills || aggressive_flow) {
        let inventory_cost_sold = ((run.inventory_cost_cents as u128)
            .checked_mul(run.order_size_milli as u128)
            .ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?
            .checked_add((run.base_milli / 2) as u128).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?
            / run.base_milli as u128) as u64;
        let proceeds = value(run.order_size_milli, run.ask_cents)?;
        run.base_milli = run.base_milli.checked_sub(run.order_size_milli).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
        run.quote_cents = run.quote_cents.checked_add(proceeds).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
        run.inventory_cost_cents = run.inventory_cost_cents.checked_sub(inventory_cost_sold).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
        run.realized_pnl_cents = run.realized_pnl_cents.checked_add(i64::try_from(proceeds).map_err(|_| error!(ResultRegistryError::RankedRunMathOverflow))? - i64::try_from(inventory_cost_sold).map_err(|_| error!(ResultRegistryError::RankedRunMathOverflow))?).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
        run.has_sell_order = false;
        run.fill_count = run.fill_count.checked_add(1).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
    }

    run.tick = tick;
    run.reference_price_cents = reference_price_cents;
    if quoted_this_tick {
        run.liquidity_ticks = run.liquidity_ticks.checked_add(1).ok_or_else(|| error!(ResultRegistryError::RankedRunMathOverflow))?;
    }
    run.equity_cents = equity(run.base_milli, run.quote_cents, reference_price_cents)?;
    run.peak_equity_cents = run.peak_equity_cents.max(run.equity_cents);
    let drawdown = ((u128::from(run.peak_equity_cents - run.equity_cents) * 10_000) + u128::from(run.peak_equity_cents / 2)) / u128::from(run.peak_equity_cents);
    run.max_drawdown_bps = run.max_drawdown_bps.max(u16::try_from(drawdown).map_err(|_| error!(ResultRegistryError::RankedRunMathOverflow))?);
    Ok(())
}

fn scenario_seed(scenario_id: u8) -> Result<u32> {
    match scenario_id {
        0 => Ok(841_213),
        1 => Ok(119_807),
        2 => Ok(729_413),
        _ => err!(ResultRegistryError::InvalidRankedRunScenario),
    }
}

fn scenario_event_move(scenario_id: u8, tick: u16) -> Result<i64> {
    let move_bps = match (scenario_id, tick) {
        (1, 32) => -550,
        (2, 20) => -1_200,
        (2, 28) => 500,
        (2, 40) => 650,
        (0..=2, _) => 0,
        _ => return err!(ResultRegistryError::InvalidRankedRunScenario),
    };
    Ok(move_bps)
}

fn random_at(seed: u32, tick: u16) -> (u32, u32) {
    let mut value = seed;
    for _ in 0..=u32::from(tick) * 2 {
        next_random(&mut value);
    }
    (next_random(&mut value), next_random(&mut value))
}

fn next_random(value: &mut u32) -> u32 {
    *value = value.wrapping_add(0x6D2B_79F5);
    let mut next = *value;
    next = (next ^ (next >> 15)).wrapping_mul(next | 1);
    next ^= next.wrapping_add((next ^ (next >> 7)).wrapping_mul(next | 61));
    next ^ (next >> 14)
}

fn noise_move_bps(noise: u32) -> i64 {
    const DENOMINATOR: u64 = 4_294_967_296;
    let scaled = u64::from(noise) * 42;
    let whole = scaled / DENOMINATOR;
    let rounded = whole + u64::from(scaled % DENOMINATOR >= DENOMINATOR / 2);
    rounded as i64 - 21
}
