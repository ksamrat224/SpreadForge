import { NextResponse } from "next/server";
import { getCatalogMarket } from "../../../../lib/pyth-catalog";

const HERMES_URL = process.env.PYTH_HERMES_URL ?? "https://hermes.pyth.network";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const market = await getCatalogMarket((await params).id);
    if (!market)
      return NextResponse.json(
        { error: "Unknown Pyth market" },
        { status: 404 }
      );
    const url = new URL(
      "v2/updates/price/latest",
      HERMES_URL.endsWith("/") ? HERMES_URL : HERMES_URL + "/"
    );
    url.searchParams.append("ids[]", market.id);
    url.searchParams.set("parsed", "true");
    const response = await fetch(url, {
      headers: process.env.PYTH_HERMES_API_KEY
        ? { Authorization: `Bearer ${process.env.PYTH_HERMES_API_KEY}` }
        : undefined,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Pyth quote unavailable");
    const body = (await response.json()) as {
      parsed?: Array<{
        price?: { price: string; expo: number; publish_time: number };
      }>;
    };
    const price = body.parsed?.[0]?.price;
    const value = Number(price?.price) * 10 ** Number(price?.expo);
    if (!price || !Number.isFinite(value) || value <= 0)
      throw new Error("Invalid Pyth quote");
    return NextResponse.json({
      id: market.id,
      price: value,
      publishedAt: price.publish_time * 1000,
    });
  } catch {
    return NextResponse.json(
      { error: "Pyth quote is temporarily unavailable" },
      { status: 503 }
    );
  }
}
