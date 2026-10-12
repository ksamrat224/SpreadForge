# Leaderboard

## Simple explanation

The Leaderboard makes performance public and comparable. It does not accept a score simply because the browser reports it.

## Strategy leaderboard

The strategy board reads settled `RankedRun` accounts from the Result Registry program.

Before displaying a run, SpreadForge verifies:

- Program ownership
- Exact account size and discriminator
- Correct PDA derivation
- Supported schema version
- Completed 60-tick state
- Settled status and valid timestamps
- Score inside the allowed range

Users can switch between weekly and all-time results. Only the best eligible run per wallet is ranked.

## Ranking order

1. Higher score
2. Higher P&L
3. Lower drawdown
4. Earlier completion
5. Account address as a deterministic final tie-breaker

## Paper leaderboard

The paper board reads wallet-owned paper portfolios and values them with configured Pyth price accounts.

It rejects prices that are:

- Stale
- Future-dated
- Owned by the wrong program
- Connected to the wrong feed

## Proof links

Leaderboard entries link to their public devnet accounts so judges and users can inspect the proof independently.

## What to show in the demo

1. Open the strategy board.
2. Switch between weekly and all-time.
3. Open a result proof link.
4. Switch to the paper board.
5. Explain how live prices value portfolios.

## What to say

> Our leaderboard is not a database of claims. It is a filtered view of program-owned accounts. The client verifies the account structure and settlement state before a result is allowed to compete.
