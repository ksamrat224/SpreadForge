# SpreadForge score (v1)

Every deterministic Challenge Lab run receives a score from **0 to 10,000**. The score rewards healthy market making, rather than raw simulated profit alone.

| Component         | Weight | How it is measured                                                                                         |
| ----------------- | -----: | ---------------------------------------------------------------------------------------------------------- |
| Liquidity uptime  |    30% | Percentage of scenario ticks during which the strategy is active.                                          |
| Spread efficiency |    25% | How close the configured spread is to the 30 bps learning baseline.                                        |
| Inventory control |    20% | How close ending inventory remains to the starting 100 SOL position, relative to the chosen inventory cap. |
| Drawdown control  |    15% | Penalty for peak-to-trough simulated equity drawdown.                                                      |
| Simulated P&L     |    10% | Normalized change in simulated account equity.                                                             |

## Formula

Each component is first clamped to a 0–100 quality score. The final score is:

```text
round((liquidity × 0.30
     + spread efficiency × 0.25
     + inventory control × 0.20
     + drawdown control × 0.15
     + P&L × 0.10) × 100)
```

The formula, its weights, and scoring version are part of the deterministic engine. Given the same scenario version, seed, strategy configuration, and engine version, the same score must result.
