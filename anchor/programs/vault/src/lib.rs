use anchor_lang::prelude::*;

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

#[program]
pub mod result_registry {
    use super::*;

    /// Creates one immutable, wallet-authorized summary for a completed
    /// deterministic SpreadForge challenge.
    pub fn submit_result(ctx: Context<SubmitResult>, args: SubmitResultArgs) -> Result<()> {
        instructions::submit_result::handler(ctx, args)
    }
}
