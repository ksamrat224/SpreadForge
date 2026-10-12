# Forge Syndicates

## Simple explanation

Forge Syndicates is SpreadForge's simulated social-trading system. A trader creates a pool, other users back it with worthless practice fUSD, and trading performance is settled transparently according to fixed program rules.

## What is fUSD?

- fUSD is a classic SPL token on Solana devnet.
- It has six decimals.
- It has no monetary value.
- Each wallet can claim 10,000 fUSD once.
- It exists only for testing pool deposits, shares, profit, loss, and fees.

## What users can do in the current UI

- Discover syndicates
- Claim practice fUSD
- Create a named syndicate
- Deposit fUSD to back a syndicate
- View pool value, backers, sessions, and performance information

The on-chain program also supports withdrawals, trading sessions, automated expiry, and settlement. Complete end-user controls for those actions are the next UI milestone.

## How pool shares work

When a user deposits fUSD, the program gives them proportional pool shares. When the syndicate is idle, those shares can be redeemed for the member's proportional part of the vault.

## Safe architecture

The SPL token vault remains on Solana devnet. It is never delegated to MagicBlock.

Only a synthetic trading-session account moves to the Ephemeral Rollup. That session tracks virtual cash, SOL and ETH positions, prices, equity, and drawdown.

## Session rules

- Ten-minute session
- Maximum 120 trades
- Maximum 10% of equity in one trade
- Maximum 40% of equity in one asset
- Maximum 20% drawdown
- Maximum 1% requested slippage
- Pyth price no older than five seconds

## Session Keys and automated expiry

A scoped `SessionTokenV2` lets a temporary signer execute only the actions allowed by the program. It does not control the user's wallet or SPL tokens.

A MagicBlock scheduled task freezes the session after ten minutes. The state is then committed and undelegated to devnet for final settlement.

## Profit, loss, and fees

- Simulated profit mints the matching amount of practice fUSD into the vault.
- Simulated loss burns practice fUSD from the vault.
- A 10% performance fee applies only to profit above the previous high-water mark.
- Every completed session creates a settlement receipt.

## What to show in the demo

Do not wait ten minutes for a complete session during a short pitch.

1. Open Syndicates.
2. Show the deployed-program status.
3. Claim fUSD or show an existing balance.
4. Create or select a syndicate.
5. Deposit a small practice amount.
6. Use the architecture diagram to explain the session lifecycle.
7. Mention that the full lifecycle passed a live devnet smoke test.

## What to say

> The key safety decision is that pooled tokens stay in the base-layer SPL vault. MagicBlock receives only synthetic session state. This gives us fast interactions without moving custody into temporary execution state.
