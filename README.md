# SpreadForge

![SpreadForge](public/SpreadForge.png)

**Learn. Simulate. Compete.**

SpreadForge is a Solana DeFi trading playground with devnet paper trading and deterministic market-making challenges.

This is an educational simulation: balances, P&L, orders, and fills are simulated. It does not trade or custody real assets.

## Current MVP slice

- Program-calculated, deterministic 60-tick ranked-run engine deployed on devnet
- Stable Market, Whale Sell, and Flash Crash & Recovery scenarios
- Spread, order-size, inventory-cap, and refresh-cycle strategy controls
- Settled on-chain strategy score, equity, fills, and drawdown
- Dark terminal UI with DM Sans, JetBrains Mono, Tabler icons, responsive desktop/tablet/mobile layouts, and a persistent theme preference
- Paper Desk: on-chain virtual portfolios and oracle-priced devnet trades; devnet SOL pays transaction fees only.
- Strategy leaderboard ranks only program-calculated `RankedRun` accounts settled back on devnet; the paper board ranks live oracle-valued portfolios.
- Wallet Standard connection, MagicBlock router-discovered ER routing, scoped in-memory signer, and terminal commit-and-undelegate client transport.
- Ranked runs are separately gated by `NEXT_PUBLIC_RANKED_RUNS_ENABLED`; the local devnet configuration enables them after a successful live ER smoke test.

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
Wallet connection uses real detected browser wallets. Strategy Lab uses only
the on-chain run flow; if ranked runs are disabled, it cannot start a run.
Restart or rebuild the app after changing a public flag.

## Architecture

The wallet approves creation and delegation of a `RankedRun` PDA on devnet. A scoped, temporary signer advances its deterministic state on the router-selected MagicBlock Ephemeral Rollup, then commits and undelegates it. The UI and strategy leaderboard accept only the settled program account on base-layer devnet. No browser-computed score can enter these rankings.

The detailed product, architecture, engineering rules, and plan live in [`agents/`](agents/).
The legacy Result Registry commitments are documented in [`docs/result-registry.md`](docs/result-registry.md). The new release and smoke-test checklist is in [`docs/ranked-runs.md`](docs/ranked-runs.md).

### Leaderboard devnet setup

The Result Registry devnet upgrade and [ranked-run smoke test](docs/ranked-runs.md) are complete. Set `NEXT_PUBLIC_RANKED_RUNS_ENABLED=true` in each frontend deployment, rebuild, and select **devnet**. A wallet needs devnet SOL for account rent and fees. The strategy board scans the configured program directly through devnet RPC and excludes every old self-reported `ResultRecord`.

## Why Solana and MagicBlock

Solana gives each run a durable, publicly verifiable final account. MagicBlock handles the repeated state transitions; base-layer devnet is the final ranking and recovery boundary.
