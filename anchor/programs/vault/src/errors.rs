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
    #[msg("Paper accounts are funded with fixed USDC or by mirroring wallet SOL.")]
    InvalidPaperFunding,
    #[msg("Only the wallet that owns this paper account may trade or settle it.")]
    UnauthorizedPaperTrader,
    #[msg("This paper market is not supported.")]
    InvalidPaperAsset,
    #[msg("Paper orders need a valid side, source, positive price, and positive size.")]
    InvalidPaperOrder,
    #[msg("The reference price is too old or too far in the future.")]
    StalePaperPrice,
    #[msg("Not enough simulated balance for this paper trade.")]
    InsufficientPaperBalance,
    #[msg("The paper trade overflows the account's balances.")]
    PaperMathOverflow,
}
