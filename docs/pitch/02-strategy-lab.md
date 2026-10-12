# Strategy Lab

## Simple explanation

Strategy Lab teaches market making through repeatable challenges. Every player receives the same scenario and starting conditions, chooses a strategy, and receives a program-calculated score.

## What the user controls

- Bid and ask spread
- Order size
- Maximum inventory
- Quote refresh speed

## Available scenarios

### Stable Market

A calm market that rewards consistent quoting and inventory control.

### Whale Sell

A large sell event tests whether the strategy can manage sudden downward pressure.

### Flash Crash and Recovery

A rapid fall and recovery tests risk control, liquidity, and adaptability.

## What happens during a run

1. The wallet creates a `RankedRun` account on devnet.
2. The run is delegated to a MagicBlock Ephemeral Rollup.
3. A temporary session signer advances 60 deterministic ticks.
4. The program records quotes, fills, inventory, equity, and drawdown.
5. The program calculates the final score.
6. The final account is committed back to devnet.

## Why it is fair

- The scenarios are deterministic.
- Players start with the same conditions.
- The score is calculated by the program, not trusted from the browser.
- Only settled, validated accounts enter the leaderboard.

## What to show in the demo

1. Choose a scenario.
2. Change the spread and inventory settings.
3. Start the challenge.
4. Point out live quotes, fills, inventory, and equity.
5. Open the final score breakdown.
6. Show the result on the leaderboard.

## What to say

> Strategy Lab turns market-making theory into a repeatable challenge. The important point is that the final score is program-calculated and settled on devnet, so users are competing on verifiable results.

## Main technical proof

The final `RankedRun` contains the scenario, configuration, tick count, fills, P&L, maximum drawdown, and final score. The leaderboard validates the account owner, PDA, schema, status, and completion state before accepting it.
