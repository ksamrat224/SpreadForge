import { NextResponse } from "next/server";
import { getPythCatalog } from "../../lib/pyth-catalog";

export async function GET() {
  try {
    return NextResponse.json({ markets: await getPythCatalog() });
  } catch {
    return NextResponse.json(
      { error: "Pyth market catalog is temporarily unavailable" },
      { status: 503 }
    );
  }
}
