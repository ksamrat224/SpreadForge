import { MARKET_ASSETS } from "./market-assets";

const HERMES_URL = process.env.PYTH_HERMES_URL ?? "https://hermes.pyth.network";
const CACHE_MS = 15 * 60_000;

export type PythCatalogMarket = {
  id: string;
  symbol: string;
  base: string;
  quote: "USD";
  displayName: string;
  tradable: boolean;
  solana: boolean;
};

type Cache = { expiresAt: number; markets: PythCatalogMarket[] };
let cache: Cache | null = null;

function catalogUrl(path: string) {
  return new URL(
    path,
    HERMES_URL.endsWith("/") ? HERMES_URL : HERMES_URL + "/"
  );
}

function attributes(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as { id?: unknown; attributes?: Record<string, unknown> };
  const a = row.attributes ?? {};
  const rawSymbol =
    typeof a.generic_symbol === "string"
      ? a.generic_symbol
      : typeof a.display_symbol === "string"
        ? a.display_symbol
        : "";
  const base =
    typeof a.base === "string"
      ? a.base.toUpperCase()
      : rawSymbol
          .toUpperCase()
          .replace(/[\s/_-]/g, "")
          .replace(/USD$/, "");
  const quote =
    typeof a.quote_currency === "string" ? a.quote_currency.toUpperCase() : "";
  const assetType =
    typeof a.asset_type === "string" ? a.asset_type.toLowerCase() : "";
  if (
    typeof row.id !== "string" ||
    assetType !== "crypto" ||
    quote !== "USD" ||
    !base
  )
    return null;
  const symbol = `${base}/USD`;
  const displayName =
    typeof a.description === "string" ? a.description : symbol;
  const tradable = Object.values(MARKET_ASSETS).some(
    (market) => market.asset === base
  );
  return {
    id: row.id.replace(/^0x/, ""),
    symbol,
    base,
    quote: "USD" as const,
    displayName,
    tradable,
    solana: /solana|\bsol\b/i.test(`${base} ${symbol} ${displayName}`),
  };
}

export async function getPythCatalog(): Promise<PythCatalogMarket[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.markets;
  const response = await fetch(catalogUrl("v2/price_feeds"), {
    headers: process.env.PYTH_HERMES_API_KEY
      ? { Authorization: `Bearer ${process.env.PYTH_HERMES_API_KEY}` }
      : undefined,
    next: { revalidate: 900 },
  });
  if (!response.ok) throw new Error("Pyth catalog unavailable");
  const body = await response.json();
  const rows = Array.isArray(body) ? body : [];
  const markets = rows
    .map(attributes)
    .filter((item): item is PythCatalogMarket => !!item)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  if (!markets.length)
    throw new Error("Pyth catalog contains no crypto/USD markets");
  cache = { markets, expiresAt: Date.now() + CACHE_MS };
  return markets;
}

export async function getPythFeedId(asset: string) {
  const match = Object.values(MARKET_ASSETS).find(
    (market) => market.asset === asset
  );
  const known = match && "pythFeedId" in match ? match.pythFeedId : undefined;
  if (known) return known;
  return (
    (await getPythCatalog()).find((market) => market.base === asset)?.id ?? null
  );
}

export async function getCatalogMarket(id: string) {
  return (
    (await getPythCatalog()).find(
      (market) => market.id === id.replace(/^0x/, "")
    ) ?? null
  );
}
