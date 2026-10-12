# Questions and Answers

## Is this using real money?

No. SpreadForge currently runs on Solana devnet. Paper balances and fUSD are simulations with no monetary value. Devnet SOL pays only fees and rent.

## Why put paper trading on-chain?

The goal is not to make a simulation expensive. The goal is to give users a durable, wallet-owned record and make public comparison independently verifiable.

## Why not store everything in a database?

A database would be simpler for private application state, but users and judges would have to trust the operator. Program-owned accounts provide public ownership and result proofs.

## Why use MagicBlock?

Strategy and social-trading sessions require repeated updates. MagicBlock provides a faster execution environment while allowing the final program-owned state to return to Solana.

## What stops someone from submitting a fake score?

The browser does not submit an arbitrary score. The program calculates it from the deterministic run. The leaderboard validates the settled account before displaying it.

## Are live prices trusted blindly?

No. On-chain trades verify the expected Pyth feed, freshness, and slippage. Server market routes also validate responses and use controlled provider fallbacks.

## Does momentum predict which asset will rise?

No. Momentum only labels the previous one-day price movement. The UI explicitly presents it as an observation, not financial advice or a forecast.

## Can a Syndicates session take the pooled tokens?

The delegated session does not hold or control the SPL vault. It contains synthetic cash and positions. The base-layer program applies the final simulated profit or loss during settlement.

## What can a Session Key do?

It can perform only the actions accepted by the target program and only while its authorization remains valid. It is not the user's wallet key and does not grant general SPL token spending authority.

## How are Syndicates backers treated fairly?

Deposits receive proportional shares. Withdrawals redeem the same proportion of the pool while it is idle. Performance fees apply only to new profit above the high-water mark.

## What happens if a Syndicates trader disappears?

The scheduled expiry path is permissionless and idempotent. The automated crank freezes an expired session, after which it can be committed, undelegated, and settled.

## What has been tested live?

The dedicated Syndicates program was deployed and initialized on devnet. The complete lifecycle passed a live smoke test: SessionTokenV2 creation, delegation, router-selected ER execution, crank registration, Pyth-priced trade, automatic expiry, commit-and-undelegate, and settlement.

## What is unfinished?

The program supports the full Syndicates lifecycle, but the current user interface exposes only discovery, faucet claim, creation, and deposits. Trader-session management and withdrawals need full production UI flows. The product also remains a devnet educational system rather than a mainnet financial product.

## What would come next?

- Complete Syndicates session and withdrawal UI
- Better trader profiles and performance history
- Backer risk controls and allocation limits
- Notifications for session and settlement events
- Stronger indexing and analytics
- Security review before any mainnet discussion
