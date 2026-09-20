import { NextResponse } from "next/server";

const SOL_USD_FEED_ID =
  "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const HERMES_URL = process.env.PYTH_HERMES_URL ?? "https://hermes.pyth.network";

export async function GET() {
  try {
    const url = new URL("/v2/updates/price/latest", HERMES_URL);
    url.searchParams.append("ids[]", SOL_USD_FEED_ID);
    url.searchParams.set("parsed", "true");
    const response = await fetch(url, {
      headers: process.env.PYTH_HERMES_API_KEY
        ? { Authorization: `Bearer ${process.env.PYTH_HERMES_API_KEY}` }
        : undefined,
      next: { revalidate: 0 },
    });
    if (!response.ok) throw new Error(`Hermes returned ${response.status}`);
    const payload = (await response.json()) as {
      parsed?: Array<{
        price?: { price: string; expo: number; publish_time: number };
      }>;
    };
    const price = payload.parsed?.[0]?.price;
    if (!price || !Number.isFinite(Number(price.price)))
      throw new Error("Invalid Hermes price payload");
    const priceCents = Math.round(Number(price.price) * 10 ** price.expo * 100);
    if (priceCents <= 0) throw new Error("Invalid SOL/USD price");
    return NextResponse.json({
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
