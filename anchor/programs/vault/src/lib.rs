use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

#[cfg(test)]
mod tests;

// This is the deterministic keypair-derived address reserved for the dedicated
// devnet registry deployment. The frontend reads it from environment config.
declare_id!("2EXN7tmfAekEn2Noq8j8AkVx9bTi96zuakHUKSsW4u9w");

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

    pub fn initialize_paper_exchange(ctx: Context<InitializePaperExchange>) -> Result<()> {
        instructions::initialize_paper_exchange::handler(ctx)
    }

    pub fn configure_paper_market(
        ctx: Context<ConfigurePaperMarket>,
        args: ConfigurePaperMarketArgs,
    ) -> Result<()> {
        instructions::configure_paper_market::handler(ctx, args)
    }

    /// Opens the caller's one durable devnet paper portfolio with 10,000 USDC.
    pub fn open_portfolio(ctx: Context<OpenPortfolio>) -> Result<()> {
        instructions::open_portfolio::handler(ctx)
    }

    /// Executes a wallet-approved market order at a verified Pyth price.
    pub fn trade_portfolio(
        ctx: Context<TradePortfolio>,
        args: TradePortfolioArgs,
    ) -> Result<()> {
        instructions::trade_portfolio::handler(ctx, args)
    }
}
