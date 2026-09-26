import { GET as getMarket } from "../[market]/route";

/** Backward-compatible SOL endpoint routed through the shared live-price fallback chain. */
export async function GET(request: Request) {
  return getMarket(request, { params: Promise.resolve({ market: "sol-usd" }) });
}
