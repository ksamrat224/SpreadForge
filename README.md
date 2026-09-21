# SpreadForge

![SpreadForge](public/SpreadForge.png)

**Learn. Simulate. Compete.**

SpreadForge is a Solana DeFi trading playground. Users practice manually with simulated SOL/USDC funds against a live reference price, configure a simple liquidity strategy, run repeatable market-making challenges, and can verify compact run summaries on Solana devnet once the registry is deployed.

This is an educational simulation: balances, P&L, orders, and fills are simulated. It does not trade or custody real assets.

## Current MVP slice

- Deterministic integer-based simulation engine; no `Math.random()` in core logic
- Stable Market, Whale Sell, and Flash Crash & Recovery scenarios
- Spread, order-size, inventory-cap, and refresh-cycle strategy controls
- Live simulated price, quotes, fills, inventory, P&L, drawdown, feedback, and weighted score
- Dark terminal UI with DM Sans, JetBrains Mono, Tabler icons, responsive desktop/tablet/mobile layouts, and a persistent theme preference
- Paper Desk: 400ms synthetic price feed, optional live Pyth reference, timeframe charts, variable-size limit orders, reserved balances, and simulated trade history
- Interactive demo leaderboard and MagicBlock settlement walkthrough; sample rankings and proof badges are labelled as demos
- Challenge drawer, speed controls, radial score meter, execution feed, illustrative depth ladder, and completion dialog
- Local deterministic runtime plus a MagicBlock runtime adapter with deterministic local fallback
- Wallet Standard connection, devnet RPC configuration, canonical SHA-256 result commitments, and a typed Anchor Result Registry client are ready
- The registry source has LiteSVM happy-path and failure-path coverage; devnet deployment, wallet-signing UI, and leaderboard reads remain gated until a real registry program ID is deployed
- MagicBlock session source includes bounded PDA delegation, an in-memory scoped signer, router-discovered ER routing, and terminal commit-and-undelegate; the devnet end-to-end test remains gated on deployment

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

# Browser checks against an isolated production server on port 3100:
npm run build
npm run test:e2e
```

Browser tests use Chromium at `/usr/bin/chromium` when available. Set
`CHROMIUM_PATH` for another executable, or install Playwright's browser with
`npx playwright install chromium`. Screenshots are saved under `test-results/`.

The UI follows [the design specification](docs/SpreadForge-Design-Specification.md).
Wallet connection uses real detected browser wallets. The result dialog prepares
local SHA-256 commitments; it does not claim on-chain verification or submit funds.

## Architecture

Local deterministic execution is the current demo-safe path. The deployed production path is implemented behind a runtime abstraction: it delegates only a bounded ephemeral session to MagicBlock, then records only the final, hashed run summary in a compact Solana devnet Result Registry PDA. It is disabled until the deployed program ID and end-to-end validation are available.

The detailed product, architecture, engineering rules, and plan live in [`agents/`](agents/).
The current Result Registry schema, PDA, verification boundary, and safe devnet deployment checklist are documented in [`docs/result-registry.md`](docs/result-registry.md).

## Why Solana and MagicBlock

Solana gives completed simulation runs a durable, publicly verifiable record without persisting every animation tick. MagicBlock is the low-latency execution layer intended for the repeated session mutations; the base layer remains the final settlement and recovery boundary.
