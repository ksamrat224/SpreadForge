import { GET as getHistory } from "../../[market]/history/route";

/** Backward-compatible SOL endpoint routed through the shared history fallback chain. */
export async function GET(request: Request) {
  return getHistory(request, {
    params: Promise.resolve({ market: "sol-usd" }),
  });
}
