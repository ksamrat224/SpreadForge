use anchor_lang::prelude::*;

#[error_code]
pub enum ResultRegistryError {
    #[msg("The result score must be between 0 and 10,000.")]
    InvalidScore,
    #[msg("This result schema version is not supported.")]
    UnsupportedSchemaVersion,
    #[msg("Scenario, strategy, and result hashes must not be all zeroes.")]
    InvalidHash,
}
