import { NextResponse } from "next/server";
import { getLiveMarkets } from "../../lib/live-markets";

export async function GET() {
  try {
    const { markets, asOf } = await getLiveMarkets();
    return NextResponse.json(
      { markets, asOf },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Live market prices are temporarily unavailable" },
      { status: 503 }
    );
  }
}
