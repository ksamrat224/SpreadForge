import { NextResponse } from "next/server";

type HistoricalCandle = { at: number; priceCents: number };

function candle(at: unknown, close: unknown): HistoricalCandle | null {
  const timestamp = Number(at);
  const priceCents = Math.round(Number(close) * 100);
  if (!Number.isFinite(timestamp) || !Number.isSafeInteger(priceCents) || priceCents <= 0)
    return null;
  return {
    at: timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000,
    priceCents,
  };
}

function usable(candles: HistoricalCandle[]) {
  const unique = new Map(candles.map((item) => [item.at, item]));
  return [...unique.values()].sort((a, b) => a.at - b.at).slice(-720);
}

async function fromKraken() {
  const response = await fetch(
    "https://api.kraken.com/0/public/OHLC?pair=SOLUSD&interval=1",
    { next: { revalidate: 300 } },
  );
  if (!response.ok) throw new Error("Kraken request failed");
  const payload = (await response.json()) as {
    error?: string[];
    result?: Record<string, unknown>;
  };
  if (payload.error?.length) throw new Error("Kraken returned an error");
  const rows = Object.values(payload.result ?? {}).find(Array.isArray) as unknown[] | undefined;
  const candles = usable(
    (rows ?? []).flatMap((row) =>
      Array.isArray(row) ? [candle(row[0], row[4])].filter(Boolean) : [],
    ) as HistoricalCandle[],
  );
  if (candles.length < 240) throw new Error("Kraken returned too little history");
  return { source: "kraken", candles };
}

async function fromCoinbase() {
  const response = await fetch(
    "https://api.exchange.coinbase.com/products/SOL-USD/candles?granularity=60",
    { next: { revalidate: 300 } },
  );
  if (!response.ok) throw new Error("Coinbase request failed");
  const rows = (await response.json()) as unknown;
  const candles = usable(
    (Array.isArray(rows) ? rows : []).flatMap((row) =>
      Array.isArray(row) ? [candle(row[0], row[4])].filter(Boolean) : [],
    ) as HistoricalCandle[],
  );
  if (candles.length < 240) throw new Error("Coinbase returned too little history");
  return { source: "coinbase", candles };
}

async function fromBinance() {
  const response = await fetch(
    "https://data-api.binance.vision/api/v3/klines?symbol=SOLUSDT&interval=1m&limit=720",
    { next: { revalidate: 300 } },
  );
  if (!response.ok) throw new Error("Binance request failed");
  const rows = (await response.json()) as unknown;
  const candles = usable(
    (Array.isArray(rows) ? rows : []).flatMap((row) =>
      Array.isArray(row) ? [candle(row[0], row[4])].filter(Boolean) : [],
    ) as HistoricalCandle[],
  );
  if (candles.length < 240) throw new Error("Binance returned too little history");
  return { source: "binance", candles };
}

/**
 * Recent real market candles for unranked Paper Trade replay. A provider
 * fallback chain keeps replay usable when a public exchange API is unavailable.
 */
export async function GET() {
  for (const load of [fromKraken, fromCoinbase, fromBinance]) {
    try {
      const { candles, source } = await load();
      return NextResponse.json({ candles, source, intervalSeconds: 60 });
    } catch {
      // Try the next public provider. The final response stays provider-neutral.
    }
  }
  return NextResponse.json(
    { error: "Historical market data is temporarily unavailable" },
    { status: 503 },
  );
}
