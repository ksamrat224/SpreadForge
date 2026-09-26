export const MARKET_ASSETS = {
  "btc-usd": {
    asset: "BTC",
    pythFeedId:
      "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    kraken: "XBTUSD",
    coinbase: "BTC-USD",
    binance: "BTCUSDT",
  },
  "eth-usd": {
    asset: "ETH",
    pythFeedId:
      "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    kraken: "ETHUSD",
    coinbase: "ETH-USD",
    binance: "ETHUSDT",
  },
  "sol-usd": {
    asset: "SOL",
    pythFeedId:
      "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    kraken: "SOLUSD",
    coinbase: "SOL-USD",
    binance: "SOLUSDT",
  },
} as const;
export type MarketId = keyof typeof MARKET_ASSETS;
export function getMarketAsset(value: string) {
  return Object.prototype.hasOwnProperty.call(MARKET_ASSETS, value)
    ? MARKET_ASSETS[value as MarketId]
    : null;
}
