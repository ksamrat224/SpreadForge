import { NextResponse } from "next/server";
import { getMarketAsset } from "../../../../lib/market-assets";
import type { BookLevel } from "../../../../lib/market-history";

const LEVELS = 100;

function levels(rows: unknown): BookLevel[] {
  return (Array.isArray(rows) ? rows : []).slice(0, LEVELS).flatMap((row) => {
    if (!Array.isArray(row)) return [];
    const priceCents = Math.round(Number(row[0]) * 100);
    const size = Number(row[1]);
    return Number.isSafeInteger(priceCents) &&
      priceCents > 0 &&
      Number.isFinite(size) &&
      size > 0
      ? [{ priceCents, size }]
      : [];
  });
}

/** Top of the live exchange order book, used for paper depth and spread views. */
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
  const providers = [
    {
      source: "kraken",
      url: `https://api.kraken.com/0/public/Depth?pair=${market.kraken}&count=${LEVELS}`,
      book: (body: unknown) => {
        const payload = body as {
          error?: string[];
          result?: Record<string, { bids?: unknown; asks?: unknown }>;
        };
        if (payload.error?.length) throw new Error("Kraken error");
        return Object.values(payload.result ?? {})[0] ?? {};
      },
    },
    {
      source: "coinbase",
      url: `https://api.exchange.coinbase.com/products/${market.coinbase}/book?level=2`,
      book: (body: unknown) => body as { bids?: unknown; asks?: unknown },
    },
    {
      source: "binance",
      url: `https://data-api.binance.vision/api/v3/depth?symbol=${market.binance}&limit=${LEVELS}`,
      book: (body: unknown) => body as { bids?: unknown; asks?: unknown },
    },
  ];
  for (const provider of providers)
    try {
      const response = await fetch(provider.url, { cache: "no-store" });
      if (!response.ok) throw new Error(provider.source + " unavailable");
      const book = provider.book(await response.json());
      const bids = levels(book.bids);
      const asks = levels(book.asks);
      // A crossed or empty book is unusable; try the next provider.
      if (
        !bids.length ||
        !asks.length ||
        bids[0].priceCents > asks[0].priceCents
      )
        throw new Error("invalid book");
      return NextResponse.json({
        source: provider.source,
        at: Date.now(),
        bids,
        asks,
      });
    } catch {
      /* try next approved provider */
    }
  return NextResponse.json(
    { error: "Order book temporarily unavailable" },
    { status: 503 }
  );
}
