# Paper Trading

## Simple explanation

Paper Trading gives each wallet a virtual portfolio and lets the user practice orders with live market information. The assets are simulated, but every completed trade updates a wallet-owned account on Solana devnet.

## Main features

- 20 crypto markets
- 10,000 starting virtual USDC
- Live price and feed status
- Candlestick, line, area, and depth charts
- 1-day, 1-week, 1-month, and 1-year history
- Market orders using USD amounts
- `$25`, `$50`, and `$100` shortcuts
- Custom order amount
- Buy, Sell, and Sell Max
- Advanced limit quotes
- Recent fills and current balances

## Why the order ticket is easy to use

The user chooses how many dollars to trade. SpreadForge calculates the token quantity, applies the asset's precision, and shows the actual rounded order value before wallet approval.

The interface blocks:

- Orders below the minimum size
- Buys above the virtual USDC balance
- Sells above the owned quantity
- Invalid or unavailable prices

## Market-data model

- Pyth is the preferred live-price source.
- Coinbase and Kraken provide approved fallbacks.
- Kraken, Coinbase, and Binance provide historical candles and order-book depth.
- Stale or malformed data is rejected.

## On-chain checks

Before executing a practice trade, the program verifies:

- The selected market is configured.
- The Pyth feed matches the asset.
- The oracle update is fresh.
- The price is within the allowed slippage.
- The portfolio has enough virtual cash or assets.

## What to show in the demo

1. Open or load the wallet's paper portfolio.
2. Select SOL or ETH.
3. Show the live-feed badge and chart controls.
4. Choose a `$25` preset.
5. Explain the quantity and transaction preview.
6. Complete a buy.
7. Show the new balance and fill.
8. Place a limit quote to explain the advanced surface.

## What to say

> This looks familiar to a trader, but the important difference is ownership. The browser is not the balance ledger. The wallet-owned devnet account is the canonical paper portfolio.
