# SpreadForge MagicBlock architecture

## Decision

Use a public MagicBlock Ephemeral Rollup for repeated simulation-session writes; keep result records on Solana devnet; settle the session through terminal commit-and-undelegate before the user submits the final result record.

## Goals and non-goals

- Goals: 10–50 ms session updates where available, a single wallet approval to start a delegated session, deterministic replay, and durable devnet verification.
- Non-goals: real assets, private state, oracle prices, recurring cranks, and committing each tick to Solana.

## Assumptions and deployment gate

- ASSUMPTION: a session is public and uses only simulated balances — affects the choice of a public ER rather than PER.
- ASSUMPTION: runs have at most 60 ticks and one terminal commit — affects fee-vault requirements and avoids repeated commits.
- IMPLEMENTED: `SessionState` is a 191-byte Result Registry PDA with authority, scoped signer, scenario/strategy/state hashes, nonce, tick, expiry, status, schema version, and bump.
- IMPLEMENTED: the Result Registry uses `ephemeral-rollups-sdk` `0.16.2` with Anchor `1.1.2` for delegation and terminal commit-and-undelegate.
- DEPLOYMENT GATE: the program ID is deliberately not configured in the frontend until a session-enabled registry is deployed to devnet and its integration test passes.

## Product selection

| Capability        | Selection                | Rationale                                                          | Rejected alternative                         |
| ----------------- | ------------------------ | ------------------------------------------------------------------ | -------------------------------------------- |
| Fast updates      | Public Ephemeral Rollup  | State changes occur frequently during a run                        | Base-only ticks add latency and transactions |
| Repeated signing  | Session key              | Scoped, temporary session operations avoid wallet prompts per tick | Wallet signs every tick                      |
| Durable proof     | Base-layer result PDA    | A leaderboard needs permanent, public, recoverable data            | ER-only result state                         |
| Local reliability | `LocalSimulationRuntime` | Demo and tests stay operational without external services          | MagicBlock-only UI                           |

## Account and authority model

| Account     | Owner / derivation                                                     | Authority                                                                 | Created on                          | Persistence               | ER role     | Delegation group | Commit / close policy                                    | Privacy                                 |
| ----------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------- | ------------------------- | ----------- | ---------------- | -------------------------------------------------------- | --------------------------------------- |
| Session     | Result Registry PDA `['session', owner, nonce_le_u64]`                 | owner; application-scoped session signer after initialization             | Base                                | base-settled while active | write       | session          | terminal commit-and-undelegate; close after final result | public                                  |
| Result      | Result Registry PDA `['result', owner, scenario_hash, nonce]`          | owner                                                                     | Base                                | base-settled              | none        | none             | never delegated; immutable after submit                  | public                                  |
| Session key | browser-generated non-extractable signer; public key stored in session | owner creates it; key may advance/finalize only that session until expiry | browser memory / base authorization | page-lifetime temporary   | signer only | session          | discarded on finish, reload, or expiry                   | private key never leaves browser memory |

## Transaction routing

| Flow                        | Actor / signers                         | Writable accounts     | Destination                | Preconditions                                      | Settlement / confirmation                                           | Failure path                                                                             |
| --------------------------- | --------------------------------------- | --------------------- | -------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Create and delegate session | owner wallet                            | session PDA           | MagicBlock base devnet RPC | wallet connected; session initialized              | router status shows delegated and returns ER FQDN                   | use local runtime; retry or close base session                                           |
| Run tick                    | session key                             | delegated session PDA | router-resolved ER FQDN    | session active, key in scope and unexpired         | ER transaction confirmed                                            | pause; preserve last rendered state; switch to local only before verified session begins |
| Finalize session            | session key / owner as program requires | delegated session PDA | router-resolved ER FQDN    | terminal tick reached                              | commit-and-undelegate confirmed on base; router shows no delegation | retry idempotently; owner recovers/undelegates                                           |
| Submit result               | owner wallet                            | result PDA            | base devnet RPC            | final session state and canonical hashes available | simulate first, then user signs one transaction                     | surface failure; result remains unverified                                               |

## Security and operations

- The client never stores wallet secrets. The application session key is generated as a non-extractable browser key and is not written to localStorage, cookies, IndexedDB, logs, or a server.
- The program binds that signer to exactly one session PDA, accepts it only for `advance_session` and `finalize_session`, requires an unexpired session, enforces sequential ticks, and limits a run to 60 ticks. It cannot submit a result or move assets.
- Router `getDelegationStatus` determines the ER endpoint. Do not hardcode a regional endpoint.
- Base ownership, router status, ER ownership, and final commit signature are observable checkpoints.
- No Magic Action is required: the final result is a separately signed base-layer submission. This avoids action-stripping/retry ambiguity.
- If MagicBlock is unavailable before a run, use local simulation. If it fails after delegation, deterministically replay the last acknowledged tick locally, mark the run `local-fallback`, and never claim it is settled or verified.

## Client integration boundary

`app/lib/magicblock/session.ts` builds, but does not send, the program-specific instructions in four explicit stages:

1. Wallet-authorized base initialization stores canonical scenario, strategy, and initial-state hashes plus the scoped signer public key.
2. Wallet-authorized base delegation delegates the exact session PDA; the configured deployed program ID is passed to both the instruction and owner-program account.
3. The session signer sends sequential tick hashes only to the ER FQDN returned by `getDelegationStatus`.
4. The session signer invokes terminal finalize on that same ER, which commits and undelegates the session.

The instruction builders are intentionally inert until the public program ID and transaction-status UX are enabled. Every transaction must be simulated before a user is asked to sign. A local `MagicBlockRuntime` transport failure switches to deterministic local execution rather than presenting an unconfirmed result as on-chain proof.

## Validation plan

| Claim                                     | Environment | Pass signal                                                    | Not covered          |
| ----------------------------------------- | ----------- | -------------------------------------------------------------- | -------------------- |
| Deterministic engine and runtime contract | Vitest      | replay and local-runtime tests pass                            | live ER routing      |
| Session authorization and PDA constraints | LiteSVM     | valid owner/session-key paths pass; invalid signer fails       | router placement     |
| Delegation and router discovery           | Devnet      | delegated account resolves to an ER FQDN                       | mainnet operations   |
| ER ticks and terminal undelegation        | Devnet      | ER transactions confirm; base account returns to program owner | production load      |
| Final result submission                   | Devnet      | simulated then signed result PDA is readable by direct RPC     | leaderboard indexing |

The TypeScript and LiteSVM portions of this matrix pass in the repository. The two Devnet rows remain pending because no Result Registry deployment or wallet authorization has been supplied.
