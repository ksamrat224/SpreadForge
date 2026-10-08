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
  "xrp-usd": {
    asset: "XRP",
    coinbase: "XRP-USD",
    kraken: "XRPUSD",
    binance: "XRPUSDT",
  },
  "ada-usd": {
    asset: "ADA",
    coinbase: "ADA-USD",
    kraken: "ADAUSD",
    binance: "ADAUSDT",
  },
  "doge-usd": {
    asset: "DOGE",
    coinbase: "DOGE-USD",
    kraken: "DOGEUSD",
    binance: "DOGEUSDT",
  },
  "avax-usd": {
    asset: "AVAX",
    coinbase: "AVAX-USD",
    kraken: "AVAXUSD",
    binance: "AVAXUSDT",
  },
  "link-usd": {
    asset: "LINK",
    coinbase: "LINK-USD",
    kraken: "LINKUSD",
    binance: "LINKUSDT",
  },
  "dot-usd": {
    asset: "DOT",
    coinbase: "DOT-USD",
    kraken: "DOTUSD",
    binance: "DOTUSDT",
  },
  "ltc-usd": {
    asset: "LTC",
    coinbase: "LTC-USD",
    kraken: "LTCUSD",
    binance: "LTCUSDT",
  },
  "bch-usd": {
    asset: "BCH",
    coinbase: "BCH-USD",
    kraken: "BCHUSD",
    binance: "BCHUSDT",
  },
  "uni-usd": {
    asset: "UNI",
    coinbase: "UNI-USD",
    kraken: "UNIUSD",
    binance: "UNIUSDT",
  },
  "aave-usd": {
    asset: "AAVE",
    coinbase: "AAVE-USD",
    kraken: "AAVEUSD",
    binance: "AAVEUSDT",
  },
  "sui-usd": {
    asset: "SUI",
    coinbase: "SUI-USD",
    kraken: "SUIUSD",
    binance: "SUIUSDT",
  },
  "atom-usd": {
    asset: "ATOM",
    coinbase: "ATOM-USD",
    kraken: "ATOMUSD",
    binance: "ATOMUSDT",
  },
  "near-usd": {
    asset: "NEAR",
    coinbase: "NEAR-USD",
    kraken: "NEARUSD",
    binance: "NEARUSDT",
  },
  "etc-usd": {
    asset: "ETC",
    coinbase: "ETC-USD",
    kraken: "ETCUSD",
    binance: "ETCUSDT",
  },
  "xlm-usd": {
    asset: "XLM",
    coinbase: "XLM-USD",
    kraken: "XLMUSD",
    binance: "XLMUSDT",
  },
  "hbar-usd": {
    asset: "HBAR",
    coinbase: "HBAR-USD",
    kraken: "HBARUSD",
    binance: "HBARUSDT",
  },
  // Prices are quoted per 1,000 SHIB to retain cent-accurate paper accounting.
  "shib-usd": {
    asset: "SHIB",
    coinbase: "SHIB-USD",
    kraken: "SHIBUSD",
    binance: "SHIBUSDT",
    priceMultiplier: 1000,
  },
} as const;
export type MarketId = keyof typeof MARKET_ASSETS;
export function getMarketAsset(value: string) {
  return Object.prototype.hasOwnProperty.call(MARKET_ASSETS, value)
    ? MARKET_ASSETS[value as MarketId]
    : null;
}
