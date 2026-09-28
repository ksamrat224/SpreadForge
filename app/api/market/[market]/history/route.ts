import { NextResponse } from "next/server";
import { getMarketAsset } from "../../../../lib/market-assets";
import {
  HISTORY_RANGES,
  type HistoryCandle,
  type HistoryRange,
} from "../../../../lib/market-history";

type Provider = {
  source: string;
  url: (market: NonNullable<ReturnType<typeof getMarketAsset>>) => string;
  rows: (body: unknown) => unknown[];
  // Column order differs per exchange: [time, open, high, low, close, volume].
  columns: [number, number, number, number, number, number];
  intervalSeconds: number;
};

// Replay keeps its original contract: the last 12 hours of 1-minute candles.
const REPLAY = {
  seconds: 12 * 3600,
  minimum: 240,
  kraken: 1,
  coinbase: 60,
  binance: "1m",
  binanceSeconds: 60,
};

function candle(
  row: unknown,
  columns: Provider["columns"]
): HistoryCandle | null {
  if (!Array.isArray(row)) return null;
  const [time, open, high, low, close, volume] = columns.map((index) =>
    Number(row[index])
  );
  const cents = [open, high, low, close].map((value) =>
    Math.round(value * 100)
  );
  if (
    !Number.isFinite(time) ||
    cents.some((value) => !Number.isSafeInteger(value) || value <= 0)
  )
    return null;
  return {
    at: time > 1_000_000_000_000 ? time : time * 1000,
    openCents: cents[0],
    highCents: cents[1],
    lowCents: cents[2],
    priceCents: cents[3],
    volume: Number.isFinite(volume) ? volume : 0,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ market: string }> }
) {
  const market = getMarketAsset((await params).market);
  if (!market)
    return NextResponse.json(
      { error: "Unsupported paper market" },
      { status: 404 }
    );
  const rangeParam = new URL(request.url).searchParams.get("range");
  if (rangeParam && !(rangeParam in HISTORY_RANGES))
    return NextResponse.json({ error: "Unsupported range" }, { status: 400 });
  const range = rangeParam
    ? HISTORY_RANGES[rangeParam as HistoryRange]
    : REPLAY;
  const providers: Provider[] = [
    {
      source: "kraken",
      url: (item) =>
        `https://api.kraken.com/0/public/OHLC?pair=${item.kraken}&interval=${range.kraken}`,
      rows: (body) => {
        const payload = body as {
          error?: string[];
          result?: Record<string, unknown>;
        };
        if (payload.error?.length) throw new Error("Kraken error");
        return (Object.values(payload.result ?? {}).find(Array.isArray) ??
          []) as unknown[];
      },
      columns: [0, 1, 2, 3, 4, 6],
      intervalSeconds: range.kraken * 60,
    },
    {
      source: "coinbase",
      url: (item) =>
        `https://api.exchange.coinbase.com/products/${item.coinbase}/candles?granularity=${range.coinbase}`,
      rows: (body) => (Array.isArray(body) ? body : []),
      columns: [0, 3, 2, 1, 4, 5],
      intervalSeconds: range.coinbase,
    },
    {
      source: "binance",
      url: (item) =>
        `https://data-api.binance.vision/api/v3/klines?symbol=${item.binance}&interval=${range.binance}&limit=1000`,
      rows: (body) => (Array.isArray(body) ? body : []),
      columns: [0, 1, 2, 3, 4, 5],
      intervalSeconds: range.binanceSeconds,
    },
  ];
  const since = Date.now() - range.seconds * 1000;
  for (const provider of providers)
    try {
      const response = await fetch(provider.url(market), {
        next: { revalidate: rangeParam ? 60 : 300 },
      });
      if (!response.ok) throw new Error(provider.source + " unavailable");
      const candles = [
        ...new Map(
          provider
            .rows(await response.json())
            .map((row) => candle(row, provider.columns))
            .filter((item): item is HistoryCandle => !!item && item.at >= since)
            .map((item) => [item.at, item])
        ).values(),
      ].sort((a, b) => a.at - b.at);
      if (candles.length >= range.minimum)
        return NextResponse.json({
          source: provider.source,
          candles,
          intervalSeconds: provider.intervalSeconds,
        });
    } catch {
      /* try next approved provider */
    }
  return NextResponse.json(
    { error: "Historical market data is temporarily unavailable" },
    { status: 503 }
  );
}
