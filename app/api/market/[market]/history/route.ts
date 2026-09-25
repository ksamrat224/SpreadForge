import { NextResponse } from "next/server";
import { getMarketAsset } from "../../../../lib/market-assets";
type Candle = { at: number; priceCents: number };
function candle(at: unknown, close: unknown): Candle | null {
  const timestamp = Number(at),
    priceCents = Math.round(Number(close) * 100);
  return Number.isFinite(timestamp) &&
    Number.isSafeInteger(priceCents) &&
    priceCents > 0
    ? {
        at: timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000,
        priceCents,
      }
    : null;
}
function usable(items: Candle[]) {
  return [...new Map(items.map((item) => [item.at, item])).values()]
    .sort((a, b) => a.at - b.at)
    .slice(-720);
}
export async function GET(
  _: Request,
  { params }: { params: Promise<{ market: string }> }
) {
  const market = getMarketAsset((await params).market);
  if (!market)
    return NextResponse.json(
      { error: "Unsupported paper market" },
      { status: 404 }
    );
  const sources = [
    async () => {
      const response = await fetch(
        "https://api.kraken.com/0/public/OHLC?pair=" +
          market.kraken +
          "&interval=1",
        { next: { revalidate: 300 } }
      );
      const body = (await response.json()) as {
        error?: string[];
        result?: Record<string, unknown>;
      };
      if (!response.ok || body.error?.length) throw new Error();
      const rows = Object.values(body.result ?? {}).find(Array.isArray) as
        unknown[] | undefined;
      return {
        source: "kraken",
        candles: usable(
          (rows ?? []).flatMap((row) =>
            Array.isArray(row) ? [candle(row[0], row[4])].filter(Boolean) : []
          ) as Candle[]
        ),
      };
    },
    async () => {
      const response = await fetch(
        "https://api.exchange.coinbase.com/products/" +
          market.coinbase +
          "/candles?granularity=60",
        { next: { revalidate: 300 } }
      );
      const rows = (await response.json()) as unknown;
      if (!response.ok) throw new Error();
      return {
        source: "coinbase",
        candles: usable(
          (Array.isArray(rows) ? rows : []).flatMap((row) =>
            Array.isArray(row) ? [candle(row[0], row[4])].filter(Boolean) : []
          ) as Candle[]
        ),
      };
    },
    async () => {
      const response = await fetch(
        "https://data-api.binance.vision/api/v3/klines?symbol=" +
          market.binance +
          "&interval=1m&limit=720",
        { next: { revalidate: 300 } }
      );
      const rows = (await response.json()) as unknown;
      if (!response.ok) throw new Error();
      return {
        source: "binance",
        candles: usable(
          (Array.isArray(rows) ? rows : []).flatMap((row) =>
            Array.isArray(row) ? [candle(row[0], row[4])].filter(Boolean) : []
          ) as Candle[]
        ),
      };
    },
  ];
  for (const load of sources)
    try {
      const result = await load();
      if (result.candles.length >= 240)
        return NextResponse.json({ ...result, intervalSeconds: 60 });
    } catch {
      /* try next approved provider */
    }
  return NextResponse.json(
    { error: "Historical market data is temporarily unavailable" },
    { status: 503 }
  );
}
