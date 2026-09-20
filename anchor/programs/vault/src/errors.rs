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
}
