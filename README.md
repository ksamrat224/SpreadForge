# SpreadForge

![SpreadForge](app/SpreadForge.png)

**Learn. Simulate. Compete.**

SpreadForge is a Solana DeFi market-making laboratory. Users configure a simple liquidity strategy, run it against repeatable SOL/USDC scenarios, understand the effects of spread and inventory risk, and will verify compact run summaries on Solana devnet.

This is an educational simulation: balances, P&L, orders, and fills are simulated. It does not trade or custody real assets.

## Current MVP slice

- Deterministic integer-based simulation engine; no `Math.random()` in core logic
- Stable Market and Whale Sell scenarios
- Spread, order-size, inventory-cap, and refresh-cycle strategy controls
- Live simulated price, quotes, fills, inventory, P&L, drawdown, feedback, and weighted score
- Local deterministic runtime ready to sit behind the planned MagicBlock adapter
- Wallet Standard connection, devnet RPC configuration, canonical SHA-256 result commitments, and a typed Anchor Result Registry client are ready
- The registry source has LiteSVM happy-path and failure-path coverage; devnet deployment, wallet-signing UI, and leaderboard reads remain gated until a real registry program ID is deployed
- MagicBlock account, routing, settlement, recovery, and validation design documented in [`docs/magicblock-architecture.md`](docs/magicblock-architecture.md)

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm run test
npx tsc --noEmit
npm run lint
```

## Architecture

Local deterministic execution is the current implementation and the fallback for demo reliability. The intended production path will place it behind a runtime abstraction, delegate ephemeral session state to MagicBlock, then record only the final, hashed run summary in a compact Solana devnet result-registry PDA.

The detailed product, architecture, engineering rules, and plan live in [`agents/`](agents/).
The current Result Registry schema, PDA, verification boundary, and safe devnet deployment checklist are documented in [`docs/result-registry.md`](docs/result-registry.md).

## Why Solana and MagicBlock

Solana gives completed simulation runs a durable, publicly verifiable record without persisting every animation tick. MagicBlock is the low-latency execution layer intended for the repeated session mutations; the base layer remains the final settlement and recovery boundary.
