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
score, normalized P&L, drawdown, fill count, schema version, timestamp, nonce,
and PDA bump. Its fixed serialized size is 164 bytes.

`submit_result` requires the authority to sign, creates (rather than mutates)
the PDA, rejects scores above 10,000, requires schema version `1`, and rejects
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

The UI currently prepares the exact commitments without requesting a wallet
signature or sending a transaction. This prevents a result from being presented
as verified before a real devnet program exists.
