use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

#[cfg(test)]
mod tests;

// This build identity is retained only until the dedicated registry is deployed
// to devnet. The frontend never treats it as a deployed registry address.
declare_id!("8g3EVLPext6Ys4fg75ywroxsWNPBrUHTVC1svTRV2XfV");

#[ephemeral]
#[program]
pub mod result_registry {
    use super::*;

    /// Creates one immutable, wallet-authorized summary for a completed
    /// deterministic SpreadForge challenge.
    pub fn submit_result(ctx: Context<SubmitResult>, args: SubmitResultArgs) -> Result<()> {
        instructions::submit_result::handler(ctx, args)
    }

    pub fn initialize_session(
        ctx: Context<InitializeSession>,
        args: InitializeSessionArgs,
    ) -> Result<()> {
        instructions::initialize_session::handler(ctx, args)
    }

    pub fn delegate_session(ctx: Context<DelegateSession>, run_nonce: u64) -> Result<()> {
        instructions::delegate_session::handler(ctx, run_nonce)
    }

    pub fn advance_session(ctx: Context<AdvanceSession>, args: AdvanceSessionArgs) -> Result<()> {
        instructions::advance_session::handler(ctx, args)
    }

    pub fn finalize_session(ctx: Context<FinalizeSession>) -> Result<()> {
        instructions::finalize_session::handler(ctx)
    }
}
