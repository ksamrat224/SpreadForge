import { NextResponse } from "next/server";
import { getMarketAsset } from "../../../lib/market-assets";
import { getPythFeedId } from "../../../lib/pyth-catalog";

const HERMES_URL = process.env.PYTH_HERMES_URL ?? "https://hermes.pyth.network";
type LivePrice = {
  priceCents: number;
  publishedAt: number;
  source: "pyth" | "coinbase" | "kraken";
};

async function fromPyth(
  feedId: string,
  priceMultiplier = 1
): Promise<LivePrice> {
  // Keep any path in the configured base URL. The upgraded Pyth endpoint is
  // https://pyth.dourolabs.app/hermes, so a leading slash here would otherwise
  // drop `/hermes` and request a non-existent `/v2/...` route.
  const url = new URL(
    "v2/updates/price/latest",
    HERMES_URL.endsWith("/") ? HERMES_URL : HERMES_URL + "/"
  );
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
    Number(price?.price) * 10 ** Number(price?.expo) * 100 * priceMultiplier
  );
  if (!price || !Number.isSafeInteger(priceCents) || priceCents <= 0)
    throw new Error("Invalid Pyth price");
  return { priceCents, publishedAt: price.publish_time * 1000, source: "pyth" };
}

async function fromCoinbase(
  product: string,
  priceMultiplier = 1
): Promise<LivePrice> {
  const response = await fetch(
    "https://api.exchange.coinbase.com/products/" + product + "/ticker",
    { cache: "no-store" }
  );
  if (!response.ok) throw new Error("Coinbase unavailable");
  const payload = (await response.json()) as { price?: string; time?: string };
  const priceCents = Math.round(Number(payload.price) * 100 * priceMultiplier),
    publishedAt = Date.parse(payload.time ?? "");
  if (
    !Number.isSafeInteger(priceCents) ||
    priceCents <= 0 ||
    !Number.isFinite(publishedAt)
  )
    throw new Error("Invalid Coinbase price");
  return { priceCents, publishedAt, source: "coinbase" };
}

async function fromKraken(
  pair: string,
  priceMultiplier = 1
): Promise<LivePrice> {
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
  const priceCents = Math.round(Number(ticker?.c?.[0]) * 100 * priceMultiplier);
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
    async () => {
      const feedId = await getPythFeedId(market.asset);
      if (!feedId) throw new Error("Pyth feed unavailable");
      return fromPyth(
        feedId,
        "priceMultiplier" in market ? market.priceMultiplier : 1
      );
    },
    () =>
      fromCoinbase(
        market.coinbase,
        "priceMultiplier" in market ? market.priceMultiplier : 1
      ),
    () =>
      fromKraken(
        market.kraken,
        "priceMultiplier" in market ? market.priceMultiplier : 1
      ),
  ]) {
    try {
      const price = await load();
      // The client rejects prices older than 60s, so a stale provider must fall through.
      if (Date.now() - price.publishedAt > 60_000) continue;
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
