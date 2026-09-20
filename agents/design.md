# SpreadForge — Product & UI Design

## 1. Brand

**Name:** SpreadForge  
**Tagline:** Learn. Simulate. Compete.

### Brand Personality
- technical but approachable
- fast
- experimental
- competitive
- trustworthy
- not casino-like

### Visual Direction
Use a dark, modern trading-lab aesthetic without copying exchange UIs.

Suggested feel:
- charcoal / near-black surfaces
- Solana-inspired green/purple accents
- crisp cards
- subtle glow
- strong numerical typography
- minimal animations

Avoid:
- excessive neon,
- gambling imagery,
- red/green overload,
- dense Bloomberg-terminal styling.

## 2. Logo Concept

Use the generated SpreadForge icon:
- opposing bid/ask-style arrows,
- forming an abstract "S",
- small center spark representing execution / price discovery.

Use:
- icon-only for favicon/avatar,
- icon + SpreadForge wordmark for header,
- monochrome variant for docs.

## 3. UX Principle

The product should teach by showing cause and effect.

When a parameter changes, the user should understand:
- what changed,
- what the market did,
- how their orders reacted,
- why their score changed.

## 4. Main Navigation

For MVP:

```text
SpreadForge
├── Lab
├── Challenges
├── Leaderboard
└── About
```

Default route: **Lab**

## 5. Landing Screen

### Hero
**Headline:** Master market making without risking real money.

**Subtext:**  
Build a strategy, run it against live-feeling DeFi scenarios, and verify your result on Solana.

Primary CTA:
**Start Simulation**

Secondary CTA:
**View Leaderboard**

### Three Value Cards
1. Learn liquidity
2. Test strategies
3. Prove results

## 6. Lab Screen

Desktop layout:

```text
┌─────────────────────────────────────────────────────────────┐
│ SpreadForge                     Wallet: 7x...9A             │
├───────────────┬───────────────────────────┬─────────────────┤
│ Strategy      │       Market Chart        │ Session         │
│ Controls      │                           │ Metrics         │
│               │                           │                 │
│ Spread        │                           │ P&L             │
│ Order Size    │                           │ Inventory       │
│ Max Inventory │                           │ Risk            │
│               │                           │ Score           │
│ [Start]       │                           │                 │
├───────────────┴───────────────────────────┴─────────────────┤
│                 Order / Fill Activity                       │
└─────────────────────────────────────────────────────────────┘
```

## 7. Strategy Controls

Keep beginner controls simple:

### Spread
Slider + numeric input

Example:
`0.20%`

Helper:
"Wider spreads earn more per fill but may trade less often."

### Order Size
Example:
`2 SOL`

Helper:
"Larger orders increase exposure and inventory risk."

### Max Inventory
Example:
`120 SOL`

Helper:
"The strategy slows or stops buying when inventory gets too high."

## 8. Market Visualization

Show:
- reference price line,
- current bid,
- current ask,
- user's buy quote,
- user's sell quote,
- fill markers,
- major scenario event markers.

Do not show 20 indicators.

## 9. Live Metrics

Always visible:
- current price
- spread
- base inventory
- quote inventory
- net P&L
- total fills
- current score

Advanced expandable section:
- realized P&L
- unrealized P&L
- max drawdown
- inventory deviation
- liquidity uptime

## 10. Teaching Feedback

Use short event explanations.

Examples:

> Your spread was too wide, so your orders stopped filling.

> A sudden sell-off increased your SOL inventory.

> Your inventory limit reduced additional buy exposure.

> You captured spread successfully while keeping inventory balanced.

This is one of the product's most important differentiators.

## 11. Challenge Screen

Cards:

### Stable Market
Difficulty: Beginner  
Goal: Maintain balanced liquidity.

### Whale Sell
Difficulty: Intermediate  
Goal: Survive a sudden sell-off without accumulating excessive inventory.

### Volatility Spike
Difficulty: Intermediate  
Goal: Adapt to rapid price movement.

For MVP, only Stable Market and Whale Sell need to work.

## 12. Results Screen

Show a clear summary:

```text
Simulation Complete

Total Score           8,740
Net Simulated P&L     +$18.20
Fills                  34
Max Drawdown           1.8%
Liquidity Uptime       92%
Inventory Control      84/100

[Verify on Solana]
[Run Again]
```

After verification:

```text
✓ Result verified on Solana Devnet
View transaction
```

## 13. Leaderboard

Filters:
- scenario
- engine version

Columns:
- rank
- wallet
- score
- P&L
- inventory score
- timestamp
- verified indicator

Do not rank different scenarios together.

## 14. Responsive Behavior

### Desktop
Full three-column lab.

### Tablet
Controls left, chart/metrics stacked right.

### Mobile
Not a primary hackathon target.
Still support:
- scenario selection,
- basic strategy controls,
- result viewing.

## 15. Accessibility

- do not rely only on red/green,
- label all chart legends,
- keyboard-accessible controls,
- sufficient contrast,
- descriptive transaction states,
- numbers formatted consistently.

## 16. Demo Mode

Add a deterministic "Demo Scenario" with:
- fixed seed,
- known volatility event,
- known duration,
- reproducible output.

This ensures the pitch always has an interesting moment.

## 17. Design Priority

If time is limited, prioritize:

1. clear chart
2. clear strategy controls
3. live P&L/inventory
4. teaching feedback
5. polished results
6. leaderboard
7. decorative animations
