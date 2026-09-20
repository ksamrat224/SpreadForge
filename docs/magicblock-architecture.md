# SpreadForge MagicBlock architecture

## Decision

Use a public MagicBlock Ephemeral Rollup for repeated simulation-session writes; keep result records on Solana devnet; settle the session through terminal commit-and-undelegate before the user submits the final result record.

## Goals and non-goals

- Goals: 10–50 ms session updates where available, a single wallet approval to start a delegated session, deterministic replay, and durable devnet verification.
- Non-goals: real assets, private state, oracle prices, recurring cranks, and committing each tick to Solana.

## Assumptions and open questions

- ASSUMPTION: a session is public and uses only simulated balances — affects the choice of a public ER rather than PER.
- ASSUMPTION: runs have at most 60 ticks and one terminal commit — affects fee-vault requirements and avoids repeated commits.
- OPEN: choose the final session-account byte layout and program ID before deployment — owner: program implementation.
- OPEN: validate current MagicBlock SDK and Anchor compatibility before adding dependencies — owner: integration implementation.

## Product selection

| Capability | Selection | Rationale | Rejected alternative |
| --- | --- | --- | --- |
| Fast updates | Public Ephemeral Rollup | State changes occur frequently during a run | Base-only ticks add latency and transactions |
| Repeated signing | Session key | Scoped, temporary session operations avoid wallet prompts per tick | Wallet signs every tick |
| Durable proof | Base-layer result PDA | A leaderboard needs permanent, public, recoverable data | ER-only result state |
| Local reliability | `LocalSimulationRuntime` | Demo and tests stay operational without external services | MagicBlock-only UI |

## Account and authority model

| Account | Owner / derivation | Authority | Created on | Persistence | ER role | Delegation group | Commit / close policy | Privacy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Session | Result Registry PDA `['session', owner, nonce]` | owner; scoped session key after initialization | Base | base-settled while active | write | session | terminal commit-and-undelegate; close after final result | public |
| Result | Result Registry PDA `['result', owner, scenario_hash, nonce]` | owner | Base | base-settled | none | none | never delegated; immutable after submit | public |
| Session key | browser-generated signer; authorization stored in session | owner creates, key acts until expiry | Base authorization / client key material | temporary | signer only | session | revoked at finish or expiry | private key remains in wallet/browser memory |

## Transaction routing

| Flow | Actor / signers | Writable accounts | Destination | Preconditions | Settlement / confirmation | Failure path |
| --- | --- | --- | --- | --- | --- | --- |
| Create and delegate session | owner wallet | session PDA | base devnet RPC | wallet connected; session initialized | router status shows delegated and returns ER FQDN | use local runtime; retry or close base session |
| Run tick | session key | delegated session PDA | router-resolved ER FQDN | session active, key in scope and unexpired | ER transaction confirmed | pause; preserve last rendered state; switch to local only before verified session begins |
| Finalize session | session key / owner as program requires | delegated session PDA | router-resolved ER FQDN | terminal tick reached | commit-and-undelegate confirmed on base; router shows no delegation | retry idempotently; owner recovers/undelegates |
| Submit result | owner wallet | result PDA | base devnet RPC | final session state and canonical hashes available | simulate first, then user signs one transaction | surface failure; result remains unverified |

## Security and operations

- The client never stores wallet secrets. A session key is constrained by session PDA, allowed instructions, and expiry; it is revoked or allowed to expire on completion.
- Router `getDelegationStatus` determines the ER endpoint. Do not hardcode a regional endpoint.
- Base ownership, router status, ER ownership, and final commit signature are observable checkpoints.
- No Magic Action is required: the final result is a separately signed base-layer submission. This avoids action-stripping/retry ambiguity.
- If MagicBlock is unavailable before a run, use local simulation. If it fails after delegation, preserve the run as provisional and offer recovery; do not claim it is verified.

## Validation plan

| Claim | Environment | Pass signal | Not covered |
| --- | --- | --- | --- |
| Deterministic engine and runtime contract | Vitest | replay and local-runtime tests pass | live ER routing |
| Session authorization and PDA constraints | LiteSVM | valid owner/session-key paths pass; invalid signer fails | router placement |
| Delegation and router discovery | Devnet | delegated account resolves to an ER FQDN | mainnet operations |
| ER ticks and terminal undelegation | Devnet | ER transactions confirm; base account returns to program owner | production load |
| Final result submission | Devnet | simulated then signed result PDA is readable by direct RPC | leaderboard indexing |
