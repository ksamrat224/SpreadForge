# SpreadForge — Product Requirements Document

## 1. Product Summary

**SpreadForge** is a Solana-powered DeFi market-making simulator where users learn how liquidity works, configure simple automated strategies, run them against repeatable market scenarios, compare results, and save verifiable strategy outcomes on-chain.

**Tagline:** Learn. Simulate. Compete.

SpreadForge is not a real-money trading product. The hackathon MVP is an educational and competitive simulation environment using fake balances and simulated fills.

## 2. Problem

Most beginner trading simulators teach only "buy low, sell high." They do not explain how liquidity providers and market makers actually operate.

Important concepts such as spread, order-book depth, inventory risk, volatility, fill probability, and liquidity quality are difficult to understand from theory alone.

Existing paper-trading tools also rarely provide:
- market-making-specific challenges,
- identical scenarios for fair strategy comparison,
- real-time strategy execution,
- verifiable strategy-result records.

## 3. Target Users

### Primary
- Solana developers learning DeFi
- university students and blockchain clubs
- hackathon participants
- beginner quantitative developers

### Secondary
- DeFi communities
- educators
- protocols that want market-making training environments
- developer communities running competitions

### Initial Distribution
Nepal is the first community focus through universities, Superteam-style communities, workshops, and student hackathons. The product itself is designed to scale globally.

## 4. User Promise

A user should be able to understand this sentence immediately:

> "SpreadForge lets me practice market making with fake funds, see exactly why my strategy wins or loses, and prove my result on Solana."

## 5. MVP Goals

By October 7–9, 2026, the MVP should allow a user to:

1. Open SpreadForge.
2. Connect a Solana wallet.
3. Select a predefined simulation scenario.
4. Configure a simple market-making strategy.
5. Start a simulation.
6. Watch price, orders, fills, inventory, P&L, and risk update live.
7. Finish the simulation and receive a score.
8. Commit a compact result record to Solana devnet.
9. View a leaderboard of completed runs.

## 6. Non-Goals for MVP

Do not build these before the core demo works:

- real-money trading,
- mainnet execution,
- exchange custody,
- permissionless strategy code execution,
- production-grade HFT,
- historical tick-data ingestion at scale,
- advanced AI strategy generation,
- private strategies,
- NFT certificates,
- multi-chain support,
- mobile app,
- paid subscriptions.

## 7. Core User Flow

### Step 1 — Connect
User connects a Solana-compatible wallet.

### Step 2 — Choose Challenge
Example challenges:
- Stable Market
- Volatility Spike
- Whale Sell
- Liquidity Drain

For MVP, only 1–2 scenarios need to be fully implemented.

### Step 3 — Configure Strategy
Beginner controls:
- spread %
- order size
- max inventory
- refresh interval / tick behavior
- optional risk tolerance preset

### Step 4 — Simulate
The session begins with fake balances such as:
- 100 SOL
- 15,000 USDC

The simulation updates:
- reference price,
- bid/ask,
- open simulated orders,
- fills,
- inventory,
- realized/unrealized P&L,
- score.

### Step 5 — Review
At the end, show:
- total fills,
- spread capture,
- inventory P&L,
- net P&L,
- max drawdown,
- liquidity score,
- risk score,
- final total score.

### Step 6 — Verify
User signs one transaction that records the run summary on Solana devnet.

## 8. Scoring Model

The MVP score should reward healthy market making rather than raw profit only.

Suggested weighted score:

- 30% liquidity uptime / participation
- 25% spread efficiency
- 20% inventory control
- 15% drawdown control
- 10% net simulated P&L

Keep the formula deterministic and documented.

## 9. Functional Requirements

### Wallet
- Connect/disconnect wallet.
- Show shortened public key.
- Require wallet signature only for on-chain result submission.
- Simulation should not require signing every action.

### Simulation
- Deterministic scenario seed.
- Fixed starting balances.
- Discrete simulation ticks.
- Price-path generation or replay.
- Simulated order placement/cancel/fill logic.
- Inventory tracking.
- P&L calculation.
- Result scoring.

### MagicBlock
- Use Ephemeral Rollup execution for real-time simulation state where practical.
- Session state can be delegated for fast updates.
- Final result must be committed or represented on Solana devnet.
- The app must remain demoable if MagicBlock connectivity fails; local deterministic simulation is an acceptable development fallback.

### Solana Program
Store only compact, verifiable run metadata:
- owner wallet
- scenario ID
- strategy hash
- result hash
- total score
- final P&L basis points / normalized result
- timestamp
- version

### Leaderboard
- Show recent verified runs.
- Sort by total score for a selected scenario.
- Show wallet short address, score, scenario, and timestamp.

## 10. Non-Functional Requirements

- Simulation UI should respond within ~100 ms locally for visible actions.
- No private key material may be stored by the app.
- No real funds are required beyond devnet transaction fees.
- Simulation must be deterministic for a given scenario seed + strategy config.
- UI must clearly label results as simulated.
- Critical calculations should have automated tests.
- Contract writes must validate ownership and result structure.
- MVP should run reliably during a 3–5 minute live demo.

## 11. Success Metrics for Hackathon MVP

The MVP is successful when:
- a new user can understand the app in under 30 seconds,
- a complete simulation takes under 3 minutes,
- one result can be verified on Solana devnet,
- the same scenario can be run by two users and compared,
- the demo can show why one strategy performed differently from another.

## 12. Hackathon Demo Story

1. "Market making is hard to learn from charts."
2. Start the same SOL/USDC scenario.
3. Configure spread and inventory limits.
4. Run strategy.
5. Trigger or reach a volatility event.
6. Show fills and inventory risk changing live.
7. Finish simulation.
8. Submit result to Solana.
9. Open leaderboard.
10. Show that another strategy received a different score under the same scenario.

## 13. Milestones

### Sep 20–22
- finalize specification
- repo setup
- frontend shell
- wallet connection
- simulation data model

### Sep 23–27
- deterministic simulation engine
- strategy configuration
- live dashboard
- score calculation

### Sep 28–Oct 2
- Anchor program
- devnet result submission
- MagicBlock integration
- leaderboard

### Oct 3–6
- polish
- error handling
- automated tests
- scenario balancing
- deployment

### Oct 7–9
- feature freeze
- full end-to-end testing
- demo recording
- screenshots
- README
- pitch assets

### Oct 10–13
- buffer only
- bug fixes
- submission refinement

## 14. Product Positioning

SpreadForge should be described as:

> A competitive Solana DeFi simulator for learning, testing, and verifying market-making strategies.

Avoid positioning it as:
- a trading bot,
- an investment product,
- a profit tool,
- an HFT platform for real capital.
