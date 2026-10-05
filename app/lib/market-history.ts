/** One exchange OHLCV candle; `priceCents` is the close so replay can reuse it. */
export type HistoryCandle = {
  at: number;
  openCents: number;
  highCents: number;
  lowCents: number;
  priceCents: number;
  volume: number;
};

export const HISTORY_RANGE_LABELS = ["1D", "1W", "1M", "1Y"] as const;
export type HistoryRange = (typeof HISTORY_RANGE_LABELS)[number];

// Granularity per range mirrors CoinMarketCap: roughly 150–700 candles per view.
// Kraken intervals are minutes; Coinbase granularity is seconds and capped at
// 300 rows, so its longer ranges use coarser candles.
export const HISTORY_RANGES: Record<
  HistoryRange,
  {
    label: string;
    seconds: number;
    minimum: number;
    kraken: number;
    coinbase: number;
    binance: string;
    binanceSeconds: number;
  }
> = {
  "1D": {
    label: "24h",
    seconds: 86_400,
    minimum: 200,
    kraken: 5,
    coinbase: 300,
    binance: "5m",
    binanceSeconds: 300,
  },
  "1W": {
    label: "1W",
    seconds: 604_800,
    minimum: 150,
    kraken: 15,
    coinbase: 3600,
    binance: "15m",
    binanceSeconds: 900,
  },
  "1M": {
    label: "1M",
    seconds: 2_592_000,
    minimum: 100,
    kraken: 60,
    coinbase: 21_600,
    binance: "1h",
    binanceSeconds: 3600,
  },
  "1Y": {
    label: "1Y",
    seconds: 31_536_000,
    minimum: 250,
    kraken: 1440,
    coinbase: 86_400,
    binance: "1d",
    binanceSeconds: 86_400,
  },
};

/** Folds a live price into the candle it belongs to, opening a new one when due. */
export function mergeLiveTick(
  candles: HistoryCandle[],
  intervalSeconds: number,
  priceCents: number,
  at: number
): HistoryCandle[] {
  const last = candles.at(-1);
  const bucket =
    Math.floor(at / 1000 / intervalSeconds) * intervalSeconds * 1000;
  if (!last || bucket < last.at) return candles;
  if (bucket === last.at)
    return [
      ...candles.slice(0, -1),
      {
        ...last,
        highCents: Math.max(last.highCents, priceCents),
        lowCents: Math.min(last.lowCents, priceCents),
        priceCents,
      },
    ];
  return [
    ...candles,
    {
      at: bucket,
      openCents: last.priceCents,
      highCents: Math.max(last.priceCents, priceCents),
      lowCents: Math.min(last.priceCents, priceCents),
      priceCents,
      volume: 0,
    },
  ];
}

/** One aggregated order-book level from the live exchange book. */
export type BookLevel = { priceCents: number; size: number };
