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

    pub fn initialize_paper_market_registry(ctx: Context<InitializePaperMarketRegistry>) -> Result<()> {
        instructions::paper_trading::initialize_registry(ctx)
    }

    pub fn upsert_paper_market(ctx: Context<UpsertPaperMarket>, args: UpsertPaperMarketArgs) -> Result<()> {
        instructions::paper_trading::upsert_market(ctx, args)
    }

    pub fn initialize_paper_portfolio(ctx: Context<InitializePaperPortfolio>, args: InitializePaperPortfolioArgs) -> Result<()> {
        instructions::paper_trading::initialize_portfolio(ctx, args)
    }

    pub fn delegate_paper_portfolio(ctx: Context<DelegatePaperPortfolio>, args: DelegatePaperPortfolioArgs) -> Result<()> {
        instructions::delegate_paper_portfolio::handler(ctx, args)
    }

    pub fn recover_paper_portfolio(ctx: Context<RecoverPaperPortfolio>) -> Result<()> {
        instructions::recover_paper_portfolio::handler(ctx)
    }

    pub fn initialize_paper_portfolio_permission(ctx: Context<InitializePaperPortfolioPermission>) -> Result<()> {
        instructions::paper_trading::initialize_portfolio_permission(ctx)
    }

    pub fn renew_paper_authorization(ctx: Context<RenewPaperAuthorization>, args: RenewPaperAuthorizationArgs) -> Result<()> {
        instructions::paper_trading::renew_authorization(ctx, args)
    }

    pub fn open_paper_position(ctx: Context<OpenPaperPosition>) -> Result<()> {
        instructions::paper_trading::open_position(ctx)
    }

    pub fn place_paper_limit_order(ctx: Context<PlacePaperLimitOrder>, args: PlacePaperLimitOrderArgs) -> Result<()> {
        instructions::paper_trading::place_limit_order(ctx, args)
    }

    pub fn place_paper_market_order(ctx: Context<PlacePaperMarketOrder>, args: PlacePaperMarketOrderArgs) -> Result<()> {
        instructions::paper_trading::place_market_order(ctx, args)
    }

    pub fn cancel_paper_order(ctx: Context<CancelPaperOrder>) -> Result<()> {
        instructions::paper_trading::cancel_order(ctx)
    }

    pub fn match_paper_market_tick(ctx: Context<MatchPaperMarketTick>) -> Result<()> {
        instructions::paper_trading::match_market_tick(ctx)
    }

    pub fn checkpoint_portfolio_performance(ctx: Context<CheckpointPortfolioPerformance>, week_start: i64) -> Result<()> {
        instructions::paper_trading::checkpoint_performance(ctx, week_start)
    }
}
