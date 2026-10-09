use anchor_lang::prelude::*;

#[error_code]
pub enum ResultRegistryError {
    #[msg("The result score must be between 0 and 10,000.")]
    InvalidScore,
    #[msg("This result schema version is not supported.")]
    UnsupportedSchemaVersion,
    #[msg("Scenario, strategy, and result hashes must not be all zeroes.")]
    InvalidHash,
    #[msg("A session must contain between 1 and 60 ticks.")]
    InvalidSessionDuration,
    #[msg("The session signer or expiry is invalid.")]
    InvalidSessionAuthorization,
    #[msg("The session has expired.")]
    SessionExpired,
    #[msg("Only the wallet authority or the scoped session signer may advance this session.")]
    UnauthorizedSessionActor,
    #[msg("The submitted tick does not advance the active session by exactly one.")]
    InvalidSessionTick,
    #[msg("The session is not active.")]
    SessionNotActive,
    #[msg("The session can be finalized only after all ticks are complete.")]
    SessionNotComplete,
    #[msg("The session schema version is not supported.")]
    UnsupportedSessionSchemaVersion,
    #[msg("Only the paper market registry authority may perform this action.")]
    UnauthorizedPaperRegistryAuthority,
    #[msg("The paper market is disabled or belongs to a different registry.")]
    PaperMarketUnavailable,
    #[msg("The paper portfolio is inactive.")]
    PaperPortfolioNotActive,
    #[msg("The paper portfolio actor is not authorized or the authorization has expired.")]
    UnauthorizedPaperPortfolioActor,
    #[msg("Paper orders require a positive integer quantity and price.")]
    InvalidPaperOrder,
    #[msg("The paper portfolio has insufficient unreserved virtual funds.")]
    InsufficientVirtualFunds,
    #[msg("The supplied oracle observation is stale, invalid, or non-monotonic.")]
    InvalidOracleObservation,
    #[msg("This paper order cannot be cancelled by the supplied session.")]
    InvalidPaperOrderAccount,
    #[msg("A paper portfolio already exists for this wallet.")]
    PaperPortfolioAlreadyExists,
    #[msg("The supplied oracle account does not satisfy the configured Pyth mirror interface.")]
    InvalidPaperOracleAccount,
    #[msg("The requested paper checkpoint is not due yet.")]
    PaperCheckpointNotDue,
    #[msg("Only aggregate performance can be written to this public account.")]
    InvalidPaperPerformance,
    #[msg("A Private ER validator must be explicitly configured for paper portfolios.")]
    InvalidPrivateErValidator,
}
