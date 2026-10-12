# Live Demo Script

This is a 6–8 minute demo. Prepare a devnet wallet with SOL, an existing paper portfolio, SOL and ETH holdings, and at least one visible syndicate before presenting.

## Before the presentation

- Open the app and connect the devnet wallet.
- Confirm the correct public program IDs are configured.
- Confirm ranked runs and MagicBlock are enabled.
- Check that live prices and historical charts load.
- Keep one settled ranked run available as a fallback.
- Keep one populated paper portfolio available.
- Keep one existing syndicate available.
- Open a devnet explorer tab for proof.
- Do not depend on a new ten-minute Syndicates session during the pitch.

## 0:00–0:40 — Problem and product

Say:

> SpreadForge is a Solana trading playground where users learn, practice, compete, and explore social trading without risking real money. It combines deterministic challenges, live market context, wallet-owned paper portfolios, and verifiable results.

Show the landing page briefly, then enter the app.

## 0:40–2:20 — Strategy Lab

1. Select Whale Sell or Flash Crash.
2. Change spread and inventory settings.
3. Start a run if network conditions are healthy.
4. Point out quotes, fills, equity, and drawdown.
5. Show a completed result.

Say:

> Everyone receives the same deterministic scenario. The program calculates the result, and only the settled account can enter the leaderboard.

If a live run is slow, immediately use the prepared settled run.

## 2:20–3:50 — Paper Trading

1. Select SOL.
2. Show the feed badge and chart.
3. Choose the `$25` preset.
4. Explain derived quantity and rounding.
5. Submit the practice buy if wallet approval is convenient.
6. Show recent fills and the updated balance.

Say:

> The trade uses live market information, but the asset and cash are simulated. The wallet-owned devnet account is the balance ledger.

## 3:50–4:50 — Portfolio

1. Open Portfolio.
2. Show SOL and ETH together.
3. Explain total value, P&L, allocation, and spotlights.
4. Explain that momentum is historical context, not a prediction.
5. Click Trade on ETH.

Say:

> The portfolio turns transactions into explanations: what I own, how it is performing, and where my exposure is concentrated.

## 4:50–6:10 — Forge Syndicates

1. Open Syndicates.
2. Show discovery and an existing pool.
3. Show the fUSD faucet.
4. Open the backing dialog.
5. Explain shares and the base-layer vault.

Say:

> Backers deposit worthless practice fUSD for proportional shares. The tokens remain in the Solana vault. Only synthetic session state is delegated to MagicBlock for fast trading.

Mention the fixed risk limits, SessionTokenV2, automated expiry crank, high-water mark, and successful live devnet smoke test.

## 6:10–7:00 — Leaderboard and proof

1. Open Leaderboard.
2. Show strategy and paper views.
3. Open one explorer proof.

Say:

> The leaderboard is a verified view of program accounts, not a list of scores sent by browsers.

## 7:00–7:30 — Close

Say:

> SpreadForge makes trading education interactive, makes simulated ownership durable, and makes competition verifiable. Solana provides the proof and custody boundary; MagicBlock provides the speed needed for real-time sessions.

## Demo recovery lines

If market data is unavailable:

> The UI fails clearly instead of inventing a price. Provider fallbacks and partial portfolio states prevent one feed failure from producing misleading totals.

If a wallet transaction is slow:

> This is a live devnet transaction. I will continue with the already settled proof so the demo does not depend on network timing.

If asked why the Syndicates session is not run live:

> Sessions intentionally last ten minutes and use an automated expiry crank. The complete lifecycle has passed a live devnet smoke test; for a short demo, I am showing the user flow and settled architecture rather than waiting through the safety window.
