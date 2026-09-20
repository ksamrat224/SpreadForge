ls# SpreadForge — Architecture

## 1. Architecture Goal

SpreadForge should feel real-time while keeping the core product easy to reason about, test, and demo.

The architecture separates responsibilities:

- **Frontend:** visualization and user controls
- **Simulation Engine:** deterministic market + strategy logic
- **MagicBlock:** fast session execution / ephemeral state
- **Solana:** durable verification of final results
- **Indexer/API:** leaderboard reads and convenience queries

## 2. High-Level Architecture

```text
┌───────────────────────────────────────────┐
│               Web Client                  │
│  Next.js/React + @solana/kit + charts    │
└───────────────┬───────────────────────────┘
                │
                │ strategy config / session
                ▼
┌───────────────────────────────────────────┐
│          Simulation Controller            │
│ deterministic scenario + scoring logic   │
└───────────────┬───────────────────────────┘
                │
                │ real-time session state
                ▼
┌───────────────────────────────────────────┐
│     MagicBlock Ephemeral Rollup Layer     │
│ session state / frequent state updates    │
└───────────────┬───────────────────────────┘
                │
                │ final commitment
                ▼
┌───────────────────────────────────────────┐
│              Solana Devnet                │
│        Anchor Result Registry Program     │
└───────────────┬───────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────┐
│         Leaderboard / Read Layer          │
│ direct RPC first; indexer only if needed │
└───────────────────────────────────────────┘
```

## 3. Recommended Stack

### Frontend
- Next.js or Vite + React + TypeScript
- `@solana/kit` v7
- `@solana/kit-plugin-wallet`
- `@solana/react`
- Wallet Standard
- lightweight charting library
- Tailwind CSS

### Solana Program
- Anchor 1.1.x
- Rust
- simple PDA-based result registry
- Codama-compatible IDL/client generation approach

### Testing
- LiteSVM for fast program-level tests
- Surfpool for integration testing where useful
- Vitest for TypeScript simulation tests
- deterministic scenario fixtures

### MagicBlock
- Ephemeral Rollup for simulation/session state
- session keys if needed for repeated actions without repeated wallet prompts
- devnet-connected MagicBlock environment for hackathon demo

## 4. Why Not Put the Whole Simulator on Solana?

The simulator may process many ticks, order updates, fills, and score changes.

Persisting every simulation event directly to Solana would:
- create unnecessary transactions,
- increase complexity,
- degrade UX,
- make the demo harder to stabilize.

SpreadForge only needs Solana for **durable verification**, not every intermediate animation.

## 5. Core Data Models

### Scenario

```ts
type Scenario = {
  id: string;
  version: number;
  seed: string;
  symbol: "SOL/USDC";
  startingPrice: number;
  startingBase: number;
  startingQuote: number;
  durationTicks: number;
  events: ScenarioEvent[];
};
```

### StrategyConfig

```ts
type StrategyConfig = {
  spreadBps: number;
  orderSize: number;
  maxInventory: number;
  refreshTicks: number;
};
```

### SimulationState

```ts
type SimulationState = {
  tick: number;
  referencePrice: number;
  baseInventory: number;
  quoteInventory: number;
  openOrders: SimOrder[];
  fills: SimFill[];
  realizedPnl: number;
  unrealizedPnl: number;
  maxDrawdown: number;
};
```

### FinalResult

```ts
type FinalResult = {
  owner: string;
  scenarioId: string;
  scenarioVersion: number;
  strategyHash: string;
  resultHash: string;
  totalScore: number;
  pnlBps: number;
  maxDrawdownBps: number;
  fills: number;
  completedAt: number;
};
```

## 6. On-Chain Program

### Purpose
The Solana program is a **result registry**, not the simulation engine.

### Suggested PDA

```text
["result", owner_pubkey, scenario_id_hash, run_nonce]
```

### Stored Fields
- authority
- scenario hash
- strategy hash
- result hash
- score
- normalized P&L
- timestamp
- schema version

### Main Instruction

`submit_result`

Validation:
- signer is the result owner,
- score is in valid range,
- hashes are fixed-size,
- schema version is supported,
- result account cannot be overwritten accidentally.

Optional later:
- challenge registry,
- signed tournament authority,
- verified scenario attestation.

## 7. Deterministic Verification

For fair competitions, the scenario must be deterministic.

A run should be reproducible from:

```text
scenario version
+ scenario seed
+ strategy parameters
+ simulation engine version
```

Produce:
- `strategy_hash = hash(canonical_strategy_config)`
- `result_hash = hash(canonical_final_result_payload)`

The on-chain program stores hashes and key summary metrics.

The full event log can remain off-chain for MVP.

## 8. MagicBlock Responsibility

MagicBlock should own **ephemeral session state**, not permanent truth.

Good uses:
- frequent simulation state updates,
- low-latency strategy actions,
- temporary session state,
- smooth real-time UX,
- optionally session keys.

Avoid:
- storing critical permanent leaderboard truth only on the ephemeral layer,
- making the app impossible to run locally,
- tightly coupling scoring logic to undocumented infrastructure behavior.

## 9. Data Flow

```text
User selects scenario
        ↓
Frontend loads immutable scenario config
        ↓
User sets strategy parameters
        ↓
Canonical strategy config is hashed
        ↓
Simulation session starts
        ↓
MagicBlock/session layer processes rapid updates
        ↓
Frontend renders ticks, orders, fills, risk
        ↓
Simulation ends
        ↓
Deterministic scoring function runs
        ↓
Final result payload is hashed
        ↓
Wallet signs one Solana transaction
        ↓
Result Registry PDA is created
        ↓
Leaderboard reads verified result accounts
```

## 10. Failure Strategy

### MagicBlock unavailable
Fallback to local deterministic simulation for development/demo backup.

### RPC unavailable
Allow simulation to finish and show "Result not yet submitted."

### Wallet disconnected
Allow guest simulation but require wallet for verified submission.

### Result submission fails
Keep final result locally in browser memory and allow retry.

## 11. Repository Structure

```text
spreadforge/
├── app/ or frontend/
│   ├── components/
│   ├── features/
│   │   ├── wallet/
│   │   ├── simulation/
│   │   ├── strategy/
│   │   └── leaderboard/
│   └── lib/
│       ├── solana/
│       └── magicblock/
├── packages/
│   ├── simulation-core/
│   ├── scoring/
│   └── shared-types/
├── programs/
│   └── result-registry/
│       ├── src/
│       │   ├── lib.rs
│       │   ├── instructions/
│       │   ├── state/
│       │   └── errors.rs
│       └── tests/
├── scenarios/
├── docs/
│   ├── prd.md
│   ├── architecture.md
│   ├── rules.md
│   ├── design.md
│   ├── task.md
│   └── memory.md
└── README.md
```

## 12. Solana Development Rules Adopted

The official Solana dev skill recommends:
- `@solana/kit` for modern client work,
- Wallet Standard integration,
- Anchor as the default program framework for fast iteration,
- splitting program logic into `instructions/` and `state/`,
- explicit custom errors,
- failure-path tests,
- LiteSVM / Surfpool-oriented testing.

SpreadForge follows those defaults.

## 13. Security Boundaries

Treat all of these as untrusted:
- wallet public input,
- URL parameters,
- scenario IDs from client requests,
- leaderboard query values,
- serialized simulation output.

Never:
- accept client-provided score as authoritative without validation strategy,
- expose secret keys,
- embed private keys in frontend code,
- use mainnet for the hackathon MVP,
- let a result account overwrite someone else's result.

## 14. Architecture Principle

> Fast state can be ephemeral. Final proof must be durable.
