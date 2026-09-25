import { NextResponse } from "next/server";
import { getMarketAsset } from "../../../lib/market-assets";
const HERMES_URL = process.env.PYTH_HERMES_URL ?? "https://hermes.pyth.network";
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
  try {
    const url = new URL("/v2/updates/price/latest", HERMES_URL);
    url.searchParams.append("ids[]", market.pythFeedId);
    url.searchParams.set("parsed", "true");
    const response = await fetch(url, {
      headers: process.env.PYTH_HERMES_API_KEY
        ? { Authorization: "Bearer " + process.env.PYTH_HERMES_API_KEY }
        : undefined,
      next: { revalidate: 0 },
    });
    if (!response.ok) throw new Error("Hermes unavailable");
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
    return NextResponse.json({
      asset: market.asset,
      priceCents,
      publishedAt: price.publish_time * 1000,
      source: "pyth",
    });
  } catch {
    return NextResponse.json(
      { error: "Live price temporarily unavailable" },
      { status: 503 }
    );
  }
}
