# SpreadForge — Task Plan

## Target Dates

- **Feature-complete target:** October 7–9, 2026
- **Hackathon deadline:** October 13, 2026

The goal is to finish core development early enough to leave several days for testing, demo recording, and submission work.

---

# Phase 0 — Project Setup

**Target: Sep 20**

- [ ] Create GitHub repository
- [ ] Add README
- [ ] Add `/docs` specs
- [ ] Choose Next.js or Vite
- [ ] Enable TypeScript strict mode
- [ ] Add lint + format
- [x] Add environment variable template
- [ ] Create `main` and `dev` branch workflow
- [ ] Add generated SpreadForge icon
- [ ] Create basic CI build check

**Definition of done:** clean clone installs and runs locally.

---

# Phase 1 — Simulation Core

**Target: Sep 21–24**

## Scenario Engine

- [x] Define scenario schema
- [x] Implement seeded PRNG
- [x] Implement deterministic price path
- [x] Implement Stable Market scenario
- [x] Implement Whale Sell event
- [x] Version scenarios

## Strategy

- [x] Define strategy config
- [x] Implement symmetric bid/ask quoting
- [x] Implement spread control
- [x] Implement order size
- [x] Implement max inventory protection
- [x] Implement refresh cycle

## Order Simulation

- [x] Define simulated order model
- [x] Define simulated fill model
- [x] Implement placement
- [x] Implement cancel/replace
- [x] Implement fill conditions
- [x] Update inventory after fills

## Accounting

- [x] Track base balance
- [x] Track quote balance
- [x] Realized P&L
- [x] Unrealized P&L
- [x] Max drawdown

## Tests

- [x] deterministic replay test
- [x] order fill test
- [x] inventory test
- [x] P&L test

**Definition of done:** simulation can run headlessly and return deterministic final results.

---

# Phase 2 — Challenge Lab UI

**Target: Sep 24–27**

- [x] Build app shell
- [x] Add navigation
- [x] Build scenario selector
- [x] Build strategy controls
- [x] Build start/stop/reset state
- [x] Build price chart
- [x] Draw user bid/ask quotes
- [x] Mark fills
- [x] Build live metric cards
- [x] Build activity feed
- [x] Add teaching feedback messages
- [x] Build results screen
- [x] Responsive cleanup

**Definition of done:** a non-Web3 user can complete a simulation and understand the result.

---

# Phase 2A — Live Paper Desk

**Target: Sep 27–28**

- [x] Add Lab / Live Paper Desk navigation
- [x] Add live BTC/ETH/SOL reference-price adapters
- [x] Show price update timestamp and stale/unavailable state for every supported market
- [x] Aggregate reference prices into 1-minute candles with provider fallback
- [x] Build multi-asset candle charts with simulated fills and quotes
- [x] Add a shared 10,000-USDC simulated portfolio
- [x] Add simulated BTC, ETH, and SOL manual market buy/sell actions
- [x] Add simulated bid/ask placement and cancel/replace actions
- [x] Show manual trade and fill history
- [x] Label live-practice results as simulated and unranked
- [x] Add live-price adapter fallback for demo reliability

**Definition of done:** a user can practice manually across live BTC, ETH, and SOL reference markets without real funds, while deterministic challenges remain separate and leaderboard eligible.

---

# Phase 3 — Scoring

**Target: Sep 27–28**

- [x] Define canonical score formula
- [x] Liquidity uptime component
- [x] Spread efficiency component
- [x] Inventory control component
- [x] Drawdown component
- [x] P&L component
- [x] Normalize total to 0–10,000
- [x] Add score breakdown UI
- [x] Add scoring tests
- [x] Document score formula

**Definition of done:** same run always produces same score.

---

# Phase 4 — Solana Integration

**Target: Sep 28–Oct 1**

## Client

- [x] Install `@solana/kit`
- [x] Wallet Standard connection
- [x] Devnet RPC config
- [x] Show wallet state
- [ ] Transaction status UX (enabled after registry deployment)

## Anchor Program

- [x] Initialize Anchor workspace
- [x] Create Result account
- [x] Create submit_result instruction
- [x] PDA seed design
- [x] Custom error codes
- [x] Account validation
- [x] Schema version field
- [x] Program tests with LiteSVM
- [ ] Deploy to devnet
- [ ] Save known-good program ID

## Result Verification

- [x] Canonicalize strategy config
- [x] Hash strategy config
- [x] Canonicalize final result
- [x] Hash result
- [ ] Submit transaction
- [ ] Add explorer link
- [ ] Retry failed transaction

**Definition of done:** completed run can be verified through a devnet account/transaction.

---

# Phase 5 — MagicBlock

**Target: Oct 1–3**

- [x] Create runtime interface
- [x] Keep local runtime working
- [x] Add MagicBlock devnet config
- [x] Delegate bounded session state in the registry program
- [x] Implement MagicBlock runtime adapter
- [x] Use an in-memory, application-scoped session signer
- [x] Ensure the session design avoids per-tick wallet prompts
- [x] Commit / settle final session state through terminal undelegation
- [x] Add MagicBlock failure fallback
- [ ] End-to-end integration test

**Definition of done:** live simulation can run through MagicBlock in a deployed devnet demo environment, with local fallback retained. The implementation is ready for this validation, but the registry has not yet been deployed and no devnet wallet transaction has been authorized.

---

# Phase 6 — Leaderboard

**Target: Oct 3–4**

- [x] Save completed Strategy Lab runs in browser-local history
- [x] Retain local history safely and provide clear-history confirmation
- [x] Add local-run status tracking: local, submitting, committed, and failed
- [x] Implement direct devnet RPC repository for ResultRecord accounts
- [x] Filter records by schema version and supported scenario hashes
- [x] Rank one best result per wallet for All-time and Weekly periods
- [x] Apply deterministic score, P&L, drawdown, timestamp, and PDA tie-breakers
- [x] Show shortened wallet address, score, scenario, P&L, drawdown, fills, timestamp, and explorer proof link
- [x] Add local, global, loading, empty, unavailable, and error states
- [x] Keep Friends visible as a clearly labelled coming-soon feature with no mock rankings
- [x] Add explicit, opt-in devnet result-commitment flow with retry-safe status feedback
- [x] Add leaderboard storage, ranking, formatting, and component tests

## Remaining

- [ ] Deploy the schema-v2 Result Registry program to Solana devnet
- [ ] Set `NEXT_PUBLIC_RESULT_REGISTRY_PROGRAM_ID` and the devnet RPC endpoint for the deployed registry
- [ ] Fund a test wallet with devnet SOL and complete an end-to-end result commitment
- [ ] Confirm the submitted ResultRecord PDA appears in Global All-time and Weekly rankings
- [ ] Confirm the explorer proof link opens the correct devnet account
- [ ] Evaluate RPC read caching or an indexer once devnet account volume makes direct RPC reads slow

**Definition of done:** two wallets that explicitly commit supported simulation results to the deployed devnet registry appear in the same global ranking, with their ResultRecord accounts available as public proof.

---

# Phase 7 — Product Polish

**Target: Oct 4–6**

- [ ] Landing page
- [ ] Final logo usage
- [ ] Brand typography
- [ ] Loading skeletons
- [ ] Empty states
- [ ] Error messages
- [ ] Clear "simulation only" notice
- [ ] Tooltips
- [ ] Onboarding hints
- [ ] Mobile sanity check
- [ ] Analytics if useful
- [ ] Deploy production frontend

**Definition of done:** product looks intentional, not like a raw hackathon prototype.

---

# Phase 8 — Testing & Freeze

**Target: Oct 7–9**

- [ ] Full clean-browser test
- [ ] Wallet connect test
- [ ] Guest simulation test
- [ ] Stable scenario test
- [ ] Whale scenario test
- [ ] Solana submission test
- [ ] Failed RPC behavior test
- [ ] MagicBlock failure behavior test
- [ ] Leaderboard test
- [ ] Re-run deterministic tests
- [ ] Fix critical UI bugs
- [ ] Freeze features
- [ ] Tag release candidate

---

# Phase 9 — Submission

**Target: Oct 9–12**

- [ ] Final README
- [ ] Architecture diagram
- [ ] 1-line pitch
- [ ] 2-paragraph project description
- [ ] Why Solana section
- [ ] Why MagicBlock section
- [ ] Competitive differentiation
- [ ] Record 2–3 minute demo
- [ ] Capture screenshots
- [ ] Prepare pitch deck if needed
- [ ] Submission form draft
- [ ] Verify all links
- [ ] Verify deployed app
- [ ] Submit before deadline

---

# Daily Priority Rule

Every day, ask:

1. Does the core simulation work?
2. Can the user understand what happened?
3. Can the result be verified?
4. Can we demo it reliably?

If the answer to any is "no", do not add a new feature.
