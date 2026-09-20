use anchor_lang::prelude::*;

use crate::{
    constants::{MAX_SCORE, RESULT_SCHEMA_VERSION, RESULT_SEED},
    errors::ResultRegistryError,
    state::ResultRecord,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SubmitResultArgs {
    pub scenario_hash: [u8; 32],
    pub strategy_hash: [u8; 32],
    pub result_hash: [u8; 32],
    pub total_score: u16,
    pub pnl_bps: i32,
    pub max_drawdown_bps: u16,
    pub fills: u16,
    pub schema_version: u8,
    pub run_nonce: u64,
}

#[derive(Accounts)]
#[instruction(args: SubmitResultArgs)]
pub struct SubmitResult<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = ResultRecord::SPACE,
        seeds = [
            RESULT_SEED,
            authority.key().as_ref(),
            args.scenario_hash.as_ref(),
            &args.run_nonce.to_le_bytes(),
        ],
        bump,
    )]
    pub result: Account<'info, ResultRecord>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SubmitResult>, args: SubmitResultArgs) -> Result<()> {
    require!(
        args.total_score <= MAX_SCORE,
        ResultRegistryError::InvalidScore
    );
    require!(
        args.schema_version == RESULT_SCHEMA_VERSION,
        ResultRegistryError::UnsupportedSchemaVersion
    );
    require!(
        args.scenario_hash != [0; 32]
            && args.strategy_hash != [0; 32]
            && args.result_hash != [0; 32],
        ResultRegistryError::InvalidHash
    );

    let result = &mut ctx.accounts.result;
    result.authority = ctx.accounts.authority.key();
    result.scenario_hash = args.scenario_hash;
    result.strategy_hash = args.strategy_hash;
    result.result_hash = args.result_hash;
    result.total_score = args.total_score;
    result.pnl_bps = args.pnl_bps;
    result.max_drawdown_bps = args.max_drawdown_bps;
    result.fills = args.fills;
    result.schema_version = args.schema_version;
    result.completed_at = Clock::get()?.unix_timestamp;
    result.run_nonce = args.run_nonce;
    result.bump = ctx.bumps.result;

    Ok(())
}
