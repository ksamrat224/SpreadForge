import { NextResponse } from "next/server";
import { getMarketAsset } from "../../../lib/market-assets";

const HERMES_URL = process.env.PYTH_HERMES_URL ?? "https://hermes.pyth.network";
type LivePrice = {
  priceCents: number;
  publishedAt: number;
  source: "pyth" | "coinbase" | "kraken";
};

async function fromPyth(feedId: string): Promise<LivePrice> {
  const url = new URL("/v2/updates/price/latest", HERMES_URL);
  url.searchParams.append("ids[]", feedId);
  url.searchParams.set("parsed", "true");
  const response = await fetch(url, {
    headers: process.env.PYTH_HERMES_API_KEY
      ? { Authorization: "Bearer " + process.env.PYTH_HERMES_API_KEY }
      : undefined,
    next: { revalidate: 0 },
  });
  if (!response.ok) throw new Error("Pyth unavailable");
  const payload = (await response.json()) as {
    parsed?: Array<{
      price?: { price: string; expo: number; publish_time: number };
    }>;
  };
  const price = payload.parsed?.[0]?.price;
  const priceCents = Math.round(
    Number(price?.price) * 10 ** Number(price?.expo) * 100
  );
  if (!price || !Number.isSafeInteger(priceCents) || priceCents <= 0)
    throw new Error("Invalid Pyth price");
  return { priceCents, publishedAt: price.publish_time * 1000, source: "pyth" };
}

async function fromCoinbase(product: string): Promise<LivePrice> {
  const response = await fetch(
    "https://api.exchange.coinbase.com/products/" + product + "/ticker",
    { cache: "no-store" }
  );
  if (!response.ok) throw new Error("Coinbase unavailable");
  const payload = (await response.json()) as { price?: string; time?: string };
  const priceCents = Math.round(Number(payload.price) * 100),
    publishedAt = Date.parse(payload.time ?? "");
  if (
    !Number.isSafeInteger(priceCents) ||
    priceCents <= 0 ||
    !Number.isFinite(publishedAt)
  )
    throw new Error("Invalid Coinbase price");
  return { priceCents, publishedAt, source: "coinbase" };
}

async function fromKraken(pair: string): Promise<LivePrice> {
  const response = await fetch(
    "https://api.kraken.com/0/public/Ticker?pair=" + pair,
    { cache: "no-store" }
  );
  if (!response.ok) throw new Error("Kraken unavailable");
  const payload = (await response.json()) as {
    error?: string[];
    result?: Record<string, { c?: [string] }>;
  };
  const ticker = Object.values(payload.result ?? {})[0];
  const priceCents = Math.round(Number(ticker?.c?.[0]) * 100);
  if (
    payload.error?.length ||
    !Number.isSafeInteger(priceCents) ||
    priceCents <= 0
  )
    throw new Error("Invalid Kraken price");
  return { priceCents, publishedAt: Date.now(), source: "kraken" };
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
  for (const load of [
    () => fromPyth(market.pythFeedId),
    () => fromCoinbase(market.coinbase),
    () => fromKraken(market.kraken),
  ]) {
    try {
      const price = await load();
      return NextResponse.json({ asset: market.asset, ...price });
    } catch {
      /* continue to an approved fallback */
    }
  }
  return NextResponse.json(
    { error: "Live price temporarily unavailable" },
    { status: 503 }
  );
}
