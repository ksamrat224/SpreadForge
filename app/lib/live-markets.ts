const JUPITER_API_URL =
  process.env.JUPITER_API_URL ?? "https://lite-api.jup.ag";
const CACHE_MS = 8_000;
/** Tokenized stocks below this pool depth are too thin to quote reliably. */
const MIN_STOCK_LIQUIDITY_USD = 50_000;

export type MarketCategory = "stocks" | "crypto" | "memecoins";

export type LiveMarket = {
  /** Solana mint address of the quoted token. */
  id: string;
  symbol: string;
  name: string;
  icon: string | null;
  category: MarketCategory;
  priceUsd: number;
  change24hPercent: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
};

export type LiveMarketsSnapshot = {
  markets: LiveMarket[];
  /** When the snapshot was read from the price source, in milliseconds. */
  asOf: number;
};

/** Hand-picked for now; anything that is not a stock or listed here is crypto. */
export const MEMECOIN_SYMBOLS = [
  "BONK",
  "WIF",
  "POPCAT",
  "FARTCOIN",
  "PENGU",
  "TRUMP",
  "MEW",
  "PNUT",
  "MOODENG",
  "GIGA",
  "BOME",
  "USELESS",
];

// Verified mints for the non-stock markets, priced from their on-chain pools.
const POOL_PRICED_MINTS = [
  "So11111111111111111111111111111111111111112", // SOL
  "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij", // cbBTC
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", // ETH (Portal)
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // JitoSOL
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", // JUP
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", // RAY
  "METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL", // MET
  "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn", // PUMP
  "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", // JLP
  "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS", // KMNO
  "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", // JTO
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", // PYTH
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", // ORCA
  "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", // RENDER
  "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux", // HNT
  "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ", // W
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", // POPCAT
  "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", // FARTCOIN
  "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", // PENGU
  "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", // TRUMP
  "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", // MEW
  "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump", // PNUT
  "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY", // MOODENG
  "63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9", // GIGA
  "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82", // BOME
  "Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk", // USELESS
];

/** xStock tickers are the stock ticker followed by a lowercase "x", e.g. SPYx. */
const XSTOCK_SYMBOL = /^[A-Z0-9.]+x$/;

/**
 * Categories are name-based for now: xStock tickers are stocks, a short
 * hand-picked list is memecoins, and everything else is crypto.
 */
export function categorizeMarket(symbol: string): MarketCategory {
  if (XSTOCK_SYMBOL.test(symbol)) return "stocks";
  if (MEMECOIN_SYMBOLS.includes(symbol.toUpperCase())) return "memecoins";
  return "crypto";
}

const finite = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Maps one Jupiter token record to a market, or null when it has no usable price. */
export function toLiveMarket(value: unknown): LiveMarket | null {
  if (!value || typeof value !== "object") return null;
  const token = value as Record<string, unknown>;
  const priceUsd = finite(token.usdPrice);
  if (
    typeof token.id !== "string" ||
    typeof token.symbol !== "string" ||
    priceUsd === null ||
    priceUsd <= 0
  )
    return null;
  // Some tickers are published with a leading "$", e.g. $WIF.
  const symbol = token.symbol.replace(/^\$/, "");
  if (!symbol) return null;
  const stats =
    token.stats24h && typeof token.stats24h === "object"
      ? (token.stats24h as Record<string, unknown>)
      : null;
  const buyVolume = finite(stats?.buyVolume);
  const sellVolume = finite(stats?.sellVolume);
  return {
    id: token.id,
    symbol,
    name: typeof token.name === "string" && token.name ? token.name : symbol,
    icon: typeof token.icon === "string" && token.icon ? token.icon : null,
    category: categorizeMarket(symbol),
    priceUsd,
    change24hPercent: finite(stats?.priceChange),
    volume24hUsd:
      buyVolume === null && sellVolume === null
        ? null
        : (buyVolume ?? 0) + (sellVolume ?? 0),
    liquidityUsd: finite(token.liquidity),
    marketCapUsd: finite(token.mcap),
  };
}

function isListedXStock(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const token = value as Record<string, unknown>;
  return (
    token.isVerified === true &&
    Array.isArray(token.tags) &&
    token.tags.includes("xstocks") &&
    (finite(token.liquidity) ?? 0) >= MIN_STOCK_LIQUIDITY_USD
  );
}

async function searchTokens(query: string, limit: number): Promise<unknown[]> {
  const url = new URL("/tokens/v2/search", JUPITER_API_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Jupiter responded ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Unexpected Jupiter response");
  return data;
}

let cache: (LiveMarketsSnapshot & { expiresAt: number }) | null = null;
let pending: Promise<LiveMarketsSnapshot> | null = null;

async function loadLiveMarkets(): Promise<LiveMarketsSnapshot> {
  // Stocks are discovered by tag so newly listed xStocks appear on their own;
  // the pool-priced markets are a fixed list of verified mints.
  const [stocks, poolPriced] = await Promise.allSettled([
    searchTokens("xStock", 100),
    searchTokens(POOL_PRICED_MINTS.join(","), POOL_PRICED_MINTS.length),
  ]);
  if (stocks.status === "rejected" && poolPriced.status === "rejected")
    throw new Error("Live market prices are unavailable");
  const listed = new Set(POOL_PRICED_MINTS);
  const markets = new Map<string, LiveMarket>();
  const add = (token: unknown) => {
    const market = toLiveMarket(token);
    if (market) markets.set(market.id, market);
  };
  if (stocks.status === "fulfilled")
    stocks.value.filter(isListedXStock).forEach(add);
  if (poolPriced.status === "fulfilled")
    poolPriced.value
      .filter(
        (token) =>
          !!token &&
          typeof token === "object" &&
          listed.has(String((token as { id?: unknown }).id))
      )
      .forEach(add);
  if (!markets.size) throw new Error("Live market prices are unavailable");
  return { markets: [...markets.values()], asOf: Date.now() };
}

/** Live prices for every listed market, shared across requests for a few seconds. */
export async function getLiveMarkets(): Promise<LiveMarketsSnapshot> {
  if (cache && cache.expiresAt > Date.now()) return cache;
  pending ??= loadLiveMarkets()
    .then((snapshot) => {
      cache = { ...snapshot, expiresAt: Date.now() + CACHE_MS };
      return snapshot;
    })
    .finally(() => {
      pending = null;
    });
  try {
    return await pending;
  } catch (error) {
    // A brief upstream failure serves the last good snapshot with its own
    // timestamp, so the page can show how old the prices are.
    if (cache) return cache;
    throw error;
  }
}
