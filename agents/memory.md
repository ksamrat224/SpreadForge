# SpreadForge — Project Memory

This file is the source of truth for recurring project decisions. Update it whenever a major decision changes.

## Current Product

**Name:** SpreadForge  
**Tagline:** Learn. Simulate. Compete.

SpreadForge is a Solana DeFi trading playground where users practice with simulated funds against live market data, learn liquidity concepts, configure strategies, run deterministic challenges, compare performance, and record verifiable challenge summaries on Solana.

## Product Category

Primary:

- DeFi

Secondary:

- Developer Tools
- Education

## Core Positioning

Do say:

> SpreadForge is a Solana DeFi trading playground for practicing with live market data and competing in verifiable market-making challenges.

Do not say:

- real trading platform,
- investment app,
- HFT profit bot,
- guaranteed-profit strategy tool.

## Core Differentiator

The important loop is:

```text
Learn
→ Practice live
→ Configure
→ Simulate deterministically
→ Understand
→ Compete
→ Verify
```

The product is not differentiated by paper trading alone: Live Paper Desk teaches active practice, while Challenge Lab provides fair competition and verification.

## Target User

First:

- students,
- Solana developers,
- hackathon builders,
- beginner quant developers.

Initial community:

- Nepal / university / Solana builder ecosystem.

Long-term:

- global DeFi learners and developer communities.

## Hackathon Timeline

Hackathon deadline:
**October 13, 2026**

Internal feature-complete target:
**October 7–9, 2026**

Use Oct 10–13 only as buffer, demo, and submission refinement.

## MVP

MVP must include:

- wallet connect
- guest simulation
- SOL/USDC simulated market
- Live Paper Desk with a real SOL/USD reference price, candles, and simulated manual trading
- at least one deterministic scenario
- simple market-making strategy
- spread control
- order-size control
- max-inventory control
- simulated fills
- inventory
- P&L
- risk / liquidity scoring
- result screen
- Solana devnet result verification
- simple leaderboard
- MagicBlock integration with fallback

## Scenario Priority

1. Stable Market
2. Whale Sell

Optional after core is done: 3. Volatility Spike 4. Liquidity Drain

## Technology Decisions

### Frontend

- TypeScript
- React
- Next.js or Vite
- Tailwind CSS

### Solana

- `@solana/kit` v7
- Wallet Standard
- `@solana/kit-plugin-wallet`
- `@solana/react`
- Anchor 1.1.x
- devnet
- PDA result registry

### Testing

- Vitest
- LiteSVM
- Surfpool when needed

### Real-Time Execution

- MagicBlock Ephemeral Rollups
- local deterministic runtime must remain available as fallback

### Live Market Data

- Live Paper Desk uses a real SOL/USD reference price only; all balances and execution remain simulated.
- Live market data must show freshness and a stale/unavailable state.
- Provider API keys must remain server-side.
- The live-practice adapter must have a demo-safe fallback.

## Architecture Decision

Simulation actions are not all stored directly on Solana.

MagicBlock / local runtime:

- frequent simulation updates,
- temporary state,
- low-latency actions.

Solana:

- durable final result verification.

Principle:

> Fast state can be ephemeral. Final proof must be durable.

## On-Chain Data

Store a compact final result:

- owner wallet
- scenario ID/hash
- strategy hash
- result hash
- score
- normalized P&L
- timestamp
- schema version

Do not store the entire tick log on-chain for MVP.

## Fairness Decision

Runs should be deterministic.

Same:

- scenario version,
- seed,
- strategy config,
- engine version

must produce the same output.

This enables fair leaderboard comparisons.

Live Paper Desk sessions are not leaderboard eligible because market conditions differ between users and times.

## Scoring Direction

Score should reward market-making quality, not only P&L.

Initial weighting:

- 30% liquidity uptime
- 25% spread efficiency
- 20% inventory control
- 15% drawdown control
- 10% simulated P&L

Final formula may be tuned, but must remain deterministic and documented.

## Brand

Logo:

- abstract "S"
- bid/ask arrows
- center execution spark
- Solana-inspired green/purple visual direction.

Tone:

- technical
- modern
- competitive
- educational
- not casino-like.

## Demo Story

Best demo:

1. Explain market making in one sentence.
2. Select Whale Sell challenge.
3. Configure strategy.
4. Start simulation.
5. Show bids/asks and fills.
6. Whale sell occurs.
7. Inventory risk rises.
8. Strategy limit reacts.
9. Show final score.
10. Verify result on Solana.
11. Show leaderboard.

## Hard Constraints

- no real-money trading in hackathon MVP
- no mainnet requirement
- no secret-key storage
- no decorative blockchain features as priority
- no large new features after feature freeze
- demo reliability is more important than feature count

## Open Decisions

Resolve soon:

- Next.js vs Vite
- exact scoring formula
- exact MagicBlock state delegation shape
- whether leaderboard uses direct RPC only or a small indexer
- chart library
- exact result-account schema size

## Official Technical Reference

The project follows the current Solana development defaults from the Solana Foundation development skill:

- modern `@solana/kit` client stack,
- Wallet Standard,
- Anchor as default program framework,
- structured instruction/state modules,
- explicit errors,
- robust failure-path testing,
- LiteSVM / Surfpool-oriented testing.
