import { NextResponse } from "next/server";

type KrakenOhlcRow = [number, string, string, string, string, string, string, number];

/**
 * Recent, real SOL/USD one-minute candles used only for an unranked paper
 * trading replay. Kraken's public OHLC endpoint returns up to 720 recent bars.
 */
export async function GET() {
  try {
    const response = await fetch(
      "https://api.kraken.com/0/public/OHLC?pair=SOLUSD&interval=1",
      { next: { revalidate: 300 } },
    );
    if (!response.ok) throw new Error(`Kraken returned ${response.status}`);
    const payload = (await response.json()) as {
      error?: string[];
      result?: Record<string, KrakenOhlcRow[] | number>;
    };
    if (payload.error?.length) throw new Error(payload.error.join(", "));
    const rows = Object.values(payload.result ?? {}).find(Array.isArray) as
      | KrakenOhlcRow[]
      | undefined;
    const candles = rows?.flatMap((row) => {
      const [time, , , , close] = row;
      const priceCents = Math.round(Number(close) * 100);
      if (!Number.isFinite(time) || !Number.isSafeInteger(priceCents) || priceCents <= 0)
        return [];
      return [{ at: time * 1000, priceCents }];
    }) ?? [];
    if (candles.length < 240) throw new Error("Not enough historical candles");
    return NextResponse.json({ candles, source: "kraken", intervalSeconds: 60 });
  } catch {
    return NextResponse.json(
      { error: "Historical market data is temporarily unavailable" },
      { status: 503 },
    );
  }
}
