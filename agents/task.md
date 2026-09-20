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
- [ ] Add environment variable template
- [ ] Create `main` and `dev` branch workflow
- [ ] Add generated SpreadForge icon
- [ ] Create basic CI build check

**Definition of done:** clean clone installs and runs locally.

---

# Phase 1 — Simulation Core
**Target: Sep 21–24**

## Scenario Engine
- [ ] Define scenario schema
- [ ] Implement seeded PRNG
- [ ] Implement deterministic price path
- [ ] Implement Stable Market scenario
- [ ] Implement Whale Sell event
- [ ] Version scenarios

## Strategy
- [ ] Define strategy config
- [ ] Implement symmetric bid/ask quoting
- [ ] Implement spread control
- [ ] Implement order size
- [ ] Implement max inventory protection
- [ ] Implement refresh cycle

## Order Simulation
- [ ] Define simulated order model
- [ ] Define simulated fill model
- [ ] Implement placement
- [ ] Implement cancel/replace
- [ ] Implement fill conditions
- [ ] Update inventory after fills

## Accounting
- [ ] Track base balance
- [ ] Track quote balance
- [ ] Realized P&L
- [ ] Unrealized P&L
- [ ] Max drawdown

## Tests
- [ ] deterministic replay test
- [ ] order fill test
- [ ] inventory test
- [ ] P&L test

**Definition of done:** simulation can run headlessly and return deterministic final results.

---

# Phase 2 — UI Lab
**Target: Sep 24–27**

- [ ] Build app shell
- [ ] Add navigation
- [ ] Build scenario selector
- [ ] Build strategy controls
- [ ] Build start/stop/reset state
- [ ] Build price chart
- [ ] Draw user bid/ask quotes
- [ ] Mark fills
- [ ] Build live metric cards
- [ ] Build activity feed
- [ ] Add teaching feedback messages
- [ ] Build results screen
- [ ] Responsive cleanup

**Definition of done:** a non-Web3 user can complete a simulation and understand the result.

---

# Phase 3 — Scoring
**Target: Sep 27–28**

- [ ] Define canonical score formula
- [ ] Liquidity uptime component
- [ ] Spread efficiency component
- [ ] Inventory control component
- [ ] Drawdown component
- [ ] P&L component
- [ ] Normalize total to 0–10,000
- [ ] Add score breakdown UI
- [ ] Add scoring tests
- [ ] Document score formula

**Definition of done:** same run always produces same score.

---

# Phase 4 — Solana Integration
**Target: Sep 28–Oct 1**

## Client
- [ ] Install `@solana/kit`
- [ ] Wallet Standard connection
- [ ] Devnet RPC config
- [ ] Show wallet state
- [ ] Transaction status UX

## Anchor Program
- [ ] Initialize Anchor workspace
- [ ] Create Result account
- [ ] Create submit_result instruction
- [ ] PDA seed design
- [ ] Custom error codes
- [ ] Account validation
- [ ] Schema version field
- [ ] Program tests with LiteSVM
- [ ] Deploy to devnet
- [ ] Save known-good program ID

## Result Verification
- [ ] Canonicalize strategy config
- [ ] Hash strategy config
- [ ] Canonicalize final result
- [ ] Hash result
- [ ] Submit transaction
- [ ] Add explorer link
- [ ] Retry failed transaction

**Definition of done:** completed run can be verified through a devnet account/transaction.

---

# Phase 5 — MagicBlock
**Target: Oct 1–3**

- [ ] Create runtime interface
- [ ] Keep local runtime working
- [ ] Add MagicBlock devnet config
- [ ] Delegate session state where appropriate
- [ ] Implement MagicBlock runtime adapter
- [ ] Evaluate session keys
- [ ] Ensure no repeated wallet prompts during simulation
- [ ] Commit / settle final session state
- [ ] Add MagicBlock failure fallback
- [ ] End-to-end integration test

**Definition of done:** live simulation can run through MagicBlock in demo environment, with local fallback retained.

---

# Phase 6 — Leaderboard
**Target: Oct 3–4**

- [ ] Fetch verified result accounts
- [ ] Filter by scenario version
- [ ] Sort by score
- [ ] Show wallet short address
- [ ] Show verified badge
- [ ] Show score and timestamp
- [ ] Empty/error states
- [ ] Cache reads if necessary

**Definition of done:** two verified users can be compared.

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
