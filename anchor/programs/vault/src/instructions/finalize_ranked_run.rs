use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{anchor::commit, ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder}};

use crate::{errors::ResultRegistryError, state::RankedRun};

#[event]
pub struct RankedRunFinalized {
    pub authority: Pubkey,
    pub run_nonce: u64,
    pub scenario_id: u8,
    pub score: u16,
    pub equity_cents: u64,
    pub realized_pnl_cents: i64,
    pub fill_count: u16,
}

#[commit]
#[derive(Accounts)]
pub struct FinalizeRankedRun<'info> {
    pub actor: Signer<'info>,
    /// CHECK: Deserialized and PDA/owner-validated in the handler. An
    /// `Account<RankedRun>` would serialize again at Anchor exit, after the
    /// MagicBlock CPI has transferred ownership to the delegation program.
    #[account(mut)]
    pub ranked_run: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<FinalizeRankedRun>) -> Result<()> {
    let ranked_run_info = ctx.accounts.ranked_run.to_account_info();
    require_keys_eq!(*ranked_run_info.owner, crate::ID, ResultRegistryError::InvalidRankedRunAccount);
    let mut data = ranked_run_info.try_borrow_mut_data()?;
    let mut source: &[u8] = &data;
    let mut run = RankedRun::try_deserialize(&mut source)?;
    let (expected, bump) = Pubkey::find_program_address(
        &[
            crate::constants::RANKED_RUN_SEED,
            run.authority.as_ref(),
            &run.run_nonce.to_le_bytes(),
        ],
        ctx.program_id,
    );
    require_keys_eq!(ranked_run_info.key(), expected, ResultRegistryError::InvalidRankedRunAccount);
    require!(run.bump == bump, ResultRegistryError::InvalidRankedRunAccount);
    require!(run.status == RankedRun::ACTIVE, ResultRegistryError::RankedRunNotActive);
    require!(
        ctx.accounts.actor.key() == run.authority || ctx.accounts.actor.key() == run.session_signer,
        ResultRegistryError::UnauthorizedRankedRunActor
    );
    require!(run.tick == run.duration_ticks, ResultRegistryError::RankedRunNotComplete);

    run.final_score = score(&run)?;
    run.status = RankedRun::SETTLED;
    run.finalized_at = Clock::get()?.unix_timestamp;
    emit!(RankedRunFinalized {
        authority: run.authority,
        run_nonce: run.run_nonce,
        scenario_id: run.scenario_id,
        score: run.final_score,
        equity_cents: run.equity_cents,
        realized_pnl_cents: run.realized_pnl_cents,
        fill_count: run.fill_count,
    });

    // Persist final state before the CPI changes the account owner. The
    // UncheckedAccount context has no Anchor exit write-back afterward.
    run.try_serialize(&mut &mut data[..])?;
    drop(data);

    MagicIntentBundleBuilder::new(
        ctx.accounts.actor.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ranked_run_info])
    .build_and_invoke()?;
    Ok(())
}

fn score(run: &RankedRun) -> Result<u16> {
    let liquidity = u64::from(run.liquidity_ticks) * 10_000 / u64::from(run.duration_ticks);
    let spread = 10_000_i64.saturating_sub((i64::from(run.spread_bps) - 30).unsigned_abs() as i64 * 125).max(0) as u64;
    let inventory_delta = run.base_milli.abs_diff(100_000);
    let inventory = 10_000_u64.saturating_sub(
        (u128::from(inventory_delta) * 10_000 / u128::from(run.max_inventory_milli)) as u64,
    );
    let drawdown = 10_000_u64.saturating_sub(u64::from(run.max_drawdown_bps) * 10);
    let pnl_bps = ((i128::from(run.equity_cents) - i128::from(run.starting_equity_cents)) * 10_000)
        / i128::from(run.starting_equity_cents);
    let pnl = (5_000_i128 + pnl_bps * 25).clamp(0, 10_000) as u64;
    let weighted = liquidity * 3_000 + spread * 2_500 + inventory * 2_000 + drawdown * 1_500 + pnl * 1_000;
    u16::try_from((weighted + 5_000) / 10_000).map_err(|_| error!(ResultRegistryError::RankedRunMathOverflow))
}
