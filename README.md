# SpreadForge

![SpreadForge](public/SpreadForge.png)

**Learn. Simulate. Compete.**

SpreadForge is a Solana DeFi trading playground. Users practice manually with a shared 10,000-USDC simulated portfolio against live BTC, ETH, and SOL reference prices, configure a simple liquidity strategy, run repeatable market-making challenges, and can verify compact run summaries on Solana devnet once the registry is deployed.

This is an educational simulation: balances, P&L, orders, and fills are simulated. It does not trade or custody real assets.

## Current MVP slice

- Deterministic integer-based simulation engine; no `Math.random()` in core logic
- Stable Market, Whale Sell, and Flash Crash & Recovery scenarios
- Spread, order-size, inventory-cap, and refresh-cycle strategy controls
- Live simulated price, quotes, fills, inventory, P&L, drawdown, feedback, and weighted score
- Dark terminal UI with DM Sans, JetBrains Mono, Tabler icons, responsive desktop/tablet/mobile layouts, and a persistent theme preference
- Paper Desk: BTC/USDC, ETH/USDC, and SOL/USDC markets with live Pyth references, historical replay, synthetic fallback, shared simulated USDC buying power, reserved balances, and simulated trade history. Faucet SOL is only for devnet transaction fees.
- Personal browser-backed run history plus a devnet wallet-committed leaderboard (All-time and Weekly); no score is presented as independently verified
- Challenge drawer, speed controls, radial score meter, execution feed, illustrative depth ladder, and completion dialog
- Local deterministic runtime plus a MagicBlock runtime adapter with deterministic local fallback
- Wallet Standard connection, devnet RPC configuration, canonical SHA-256 result commitments, and a typed Anchor Result Registry client are ready
- Global leaderboard reads and explicit wallet-commit UI activate only after the schema-v2 Result Registry is deployed and `NEXT_PUBLIC_RESULT_REGISTRY_PROGRAM_ID` is configured for devnet
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

### Leaderboard devnet setup

Deploy the schema-v2 Result Registry to devnet, configure `NEXT_PUBLIC_RESULT_REGISTRY_PROGRAM_ID` with that program address, and select **devnet** in the app. A wallet needs enough devnet SOL to pay the account-creation rent and transaction fee. The leaderboard reads the configured program directly through the devnet RPC and its proof links open the devnet Solana Explorer. Browser-local results work without a wallet and remain only on that browser.

## Why Solana and MagicBlock

Solana gives completed simulation runs a durable, publicly verifiable record without persisting every animation tick. MagicBlock is the low-latency execution layer intended for the repeated session mutations; the base layer remains the final settlement and recovery boundary.
