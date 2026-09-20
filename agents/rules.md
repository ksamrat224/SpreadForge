# SpreadForge — Engineering Rules

This file contains non-negotiable project rules for contributors and coding agents.

## 1. Product Rules

1. SpreadForge is a **simulation and education product**.
2. Do not implement real-money trading for the hackathon MVP.
3. Always label simulated balances and P&L clearly.
4. The product must be understandable without prior market-making knowledge.
5. Every feature must strengthen at least one of:
   - learning,
   - simulation,
   - competition,
   - verifiability.
6. Do not add blockchain features only for decoration.

## 2. Scope Rules

The October MVP must prioritize:
1. deterministic simulation,
2. clear visual feedback,
3. one working strategy,
4. one or two scenarios,
5. one Solana result submission flow,
6. one leaderboard.

Defer everything else.

## 3. Solana Rules

1. Use Solana **devnet** for MVP.
2. Prefer `@solana/kit` v7 for client code.
3. Use Wallet Standard-compatible wallet integration.
4. Use Anchor 1.1.x for the result registry unless a concrete reason requires otherwise.
5. Keep on-chain state compact.
6. Use PDAs with stable, documented seeds.
7. Every instruction must validate signer authority.
8. Use custom program errors for distinct failure paths.
9. Never trust values simply because they came from the frontend.
10. Add tests for happy paths and failure paths.

## 4. Program Structure Rules

Do not put all Rust code in `lib.rs`.

Use:

```text
src/
├── lib.rs
├── instructions/
├── state/
├── errors.rs
└── constants.rs
```

Prefer:
- small instructions,
- explicit account validation,
- stable account schemas,
- versioned data.

## 5. Simulation Rules

1. Simulation logic must be deterministic.
2. Given the same:
   - scenario version,
   - seed,
   - strategy config,
   - engine version,
   the result must be reproducible.
3. Never use `Math.random()` directly in core simulation logic.
4. Use a seeded PRNG if randomness is needed.
5. Store prices internally using integers / fixed-point representation where possible.
6. Avoid floating-point equality checks.
7. Scoring rules must be explicit and documented.
8. Strategy configuration must be canonicalized before hashing.

## 6. MagicBlock Rules

1. Use MagicBlock for fast session execution, not permanent truth.
2. Do not make local development impossible without MagicBlock.
3. Build a fallback simulation adapter.
4. Keep MagicBlock-specific code behind an interface.
5. Commit only final/important state to Solana.
6. Do not require repeated wallet approvals for every simulation action.
7. Never store wallet secrets in session infrastructure.

Suggested abstraction:

```ts
interface SimulationRuntime {
  start(config): Promise<Session>;
  step(action): Promise<State>;
  finish(): Promise<FinalResult>;
}
```

Implementations:
- `LocalRuntime`
- `MagicBlockRuntime`

## 7. Frontend Rules

1. The main screen must answer:
   - What market am I simulating?
   - What is my strategy?
   - Am I winning or losing?
   - Why?
2. Avoid overwhelming users with professional trading-terminal density.
3. Use progressive disclosure:
   - beginner controls first,
   - advanced metrics second.
4. Wallet connection must never block users from understanding the product.
5. Guest simulation is allowed.
6. On-chain verification requires wallet connection.
7. Every transaction needs:
   - loading state,
   - success state,
   - error state,
   - explorer link if available.

## 8. Code Quality Rules

1. TypeScript strict mode.
2. No `any` unless documented.
3. Keep simulation-core framework-independent.
4. Pure functions for:
   - pricing,
   - fills,
   - P&L,
   - scoring,
   - hashing inputs.
5. UI components should not contain financial calculation logic.
6. Do not duplicate shared types.
7. Validate external data at boundaries.
8. Keep files focused; split large modules.

## 9. Testing Rules

Minimum automated test coverage for:
- deterministic scenario output,
- fill calculation,
- inventory updates,
- P&L calculation,
- score calculation,
- strategy canonicalization/hash,
- Anchor submit-result happy path,
- unauthorized submission failure,
- invalid score/schema failure.

Use:
- Vitest for TS logic,
- LiteSVM for program tests,
- Surfpool when integration behavior requires a realistic Solana environment.

## 10. Git Rules

Recommended branches:
- `main` — demo-stable
- `dev` — integration
- `feature/<name>` — isolated work

Commit style:
- `feat:`
- `fix:`
- `test:`
- `docs:`
- `refactor:`
- `chore:`

Do not merge broken demo flows into `main`.

## 11. Hackathon Rules

1. Feature freeze by October 7–9.
2. Reliability beats extra features.
3. A 3-minute demo must work from a clean browser session.
4. Keep backup demo data.
5. Keep at least one known-good deployed frontend.
6. Keep one known-good devnet program ID documented.
7. Record a backup demo before final submission.
8. README must explain why Solana and MagicBlock are necessary.

## 12. Decision Rule

When choosing between two implementations:

> Pick the simpler option that preserves the core demo and leaves a clean upgrade path.
