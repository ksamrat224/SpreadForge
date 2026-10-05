# SpreadForge Result Registry

The Result Registry is the small Solana program that records a completed,
deterministic Challenge Lab run. It does not run the simulator or custody
assets. All P&L, balances, fills, and scores remain simulated.

## Account and PDA

Each immutable `ResultRecord` PDA uses these stable seeds:

```text
["result", authority_pubkey, scenario_hash, run_nonce_le_u64]
```

The account stores the authority, SHA-256 scenario/strategy/result hashes,
score, normalized P&L, drawdown, fill count, schema version, chain-authoritative
submission timestamp, nonce, and PDA bump. Schema version 2 has a fixed serialized
size of 164 bytes.

`submit_result` requires the authority to sign, creates (rather than mutates)
the PDA, rejects scores above 10,000, requires schema version `2`, and rejects
zeroed hashes. These checks make accounts wallet-owned and immutable, but they
do not make a frontend-provided score independently trustworthy.

## Verification boundary

The browser canonicalizes integer strategy fields and deterministic scenario
fields in an explicit order, then SHA-256 hashes them. The result hash includes
the engine version, scenario identity/version, strategy hash, final state
summary, and score. A later verifier can reproduce the deterministic simulation
from these inputs and compare its commitments.

The MVP registry is a durable commitment layer, not an on-chain replay engine.
Until an independent replay/attestation path is introduced, leaderboard clients
must label submitted values as _wallet-committed simulation results_, not as
Solana-computed scores.

## Devnet deployment checklist

No registry has been deployed by this repository yet. Before enabling the
submission button:

1. Create and securely retain the Anchor program keypair and sync its public ID.
2. Build and run the LiteSVM tests with `NO_DNA=1 npm run anchor-test`.
3. Deploy only to devnet, using the deployer's wallet as upgrade authority.
4. Confirm the deployed program ID and program data on Solana Explorer.
5. Set `NEXT_PUBLIC_RESULT_REGISTRY_PROGRAM_ID` in the frontend deployment.
6. Simulate every submission before requesting a wallet signature, then show
   transaction status, errors, retry, and an Explorer link.

The UI saves a completed run locally first. When the schema-v2 registry is
configured on devnet, it offers a separate explicit wallet-signing action to
publish the commitment. It never presents the resulting record as verified.

## Leaderboard release model

The v1 leaderboard has two layers. Completed simulations are saved locally in
the browser, while a player may explicitly sign a separate devnet transaction
to create an immutable public ResultRecord. Global rankings use the best
supported scenario result per wallet, with All-time and Monday-to-Monday UTC
Weekly views. Ties are resolved by score, P&L, lower drawdown, earlier
`submitted_at`, then PDA address.

`submitted_at` must be populated by `Clock::get()?.unix_timestamp` inside the
on-chain program and must never be accepted from the browser. The account field
is required for reliable weekly eligibility. Clients only display schema-v2
records whose scenario hashes equal the canonical built-in SpreadForge
scenarios. They must always call records **wallet-committed simulation results**,
not verified results.

## MagicBlock session account

The same program also defines a bounded, delegated `SessionState` PDA:

```text
["session", authority_pubkey, run_nonce_le_u64]
```

It holds the authority, an application-scoped session signer public key,
scenario/strategy/current-state hashes, sequential tick state, expiry, status,
schema version, nonce, and bump. The authority creates and delegates it; the
scoped signer can only advance the next tick or finalize that exact session
before expiry. Finalization requires the terminal tick and performs
commit-and-undelegate. The account neither holds assets nor authorizes result
submission.

This path is source-tested but not live yet: deployment, router discovery, ER
transactions, and terminal settlement still require an authorized devnet test.
