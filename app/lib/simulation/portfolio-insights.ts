import type { HistoryCandle } from "../market-history";
import type { PaperAsset, PaperChainSnapshot, Position } from "./paper";

export type Momentum = "strong-up" | "up" | "neutral" | "down" | "strong-down";
export type Volatility = "low" | "moderate" | "high";

export type PortfolioMarketData = Partial<
  Record<
    PaperAsset,
    {
      priceCents: number | null;
      candles: HistoryCandle[] | null;
    }
  >
>;

export type HoldingAnalysis = {
  asset: PaperAsset;
  quantityMilliAsset: number;
  inventoryCostCents: number;
  averageCostCents: number | null;
  priceCents: number | null;
  marketValueCents: number | null;
  allocationPercent: number | null;
  unrealizedPnlCents: number | null;
  unrealizedPercent: number | null;
  dayChangePercent: number | null;
  momentum: Momentum | null;
  volatilityPercent: number | null;
  volatility: Volatility | null;
};

export function averageCostCents(position: Position) {
  return position.quantityMilliAsset > 0
    ? Math.round(
        (position.inventoryCostCents * 1000) / position.quantityMilliAsset
      )
    : null;
}

export function marketValueCents(
  position: Position,
  priceCents: number | null
) {
  return priceCents === null
    ? null
    : Math.round((position.quantityMilliAsset * priceCents) / 1000);
}

export function classifyMomentum(change: number): Momentum {
  if (change > 3) return "strong-up";
  if (change >= 1) return "up";
  if (change >= -1) return "neutral";
  if (change >= -3) return "down";
  return "strong-down";
}

export function calculateVolatility(candles: HistoryCandle[]) {
  const valid = candles.filter(
    (candle) => candle.highCents > 0 && candle.lowCents > 0
  );
  const base = valid[0]?.openCents;
  if (!base) return null;
  const high = Math.max(...valid.map((candle) => candle.highCents));
  const low = Math.min(...valid.map((candle) => candle.lowCents));
  return ((high - low) / base) * 100;
}

export function classifyVolatility(range: number): Volatility {
  if (range < 2) return "low";
  if (range <= 5) return "moderate";
  return "high";
}

export function analyzePortfolio(
  snapshot: PaperChainSnapshot,
  market: PortfolioMarketData
) {
  const owned = Object.entries(snapshot.positions).filter(
    ([, position]) => position.quantityMilliAsset > 0
  ) as Array<[PaperAsset, Position]>;
  const knownTotal = owned.reduce(
    (sum, [asset, position]) =>
      sum +
      (marketValueCents(position, market[asset]?.priceCents ?? null) ?? 0),
    0
  );
  return owned.map(([asset, position]): HoldingAnalysis => {
    const priceCents = market[asset]?.priceCents ?? null;
    const marketValue = marketValueCents(position, priceCents);
    const cost = position.inventoryCostCents;
    const pnl = marketValue === null ? null : marketValue - cost;
    const candles = market[asset]?.candles ?? null;
    const first = candles?.[0]?.openCents;
    const dayChange =
      priceCents !== null && first ? (priceCents / first - 1) * 100 : null;
    const range = candles ? calculateVolatility(candles) : null;
    return {
      asset,
      quantityMilliAsset: position.quantityMilliAsset,
      inventoryCostCents: cost,
      averageCostCents: averageCostCents(position),
      priceCents,
      marketValueCents: marketValue,
      allocationPercent:
        marketValue !== null && knownTotal > 0
          ? (marketValue / knownTotal) * 100
          : null,
      unrealizedPnlCents: pnl,
      unrealizedPercent: pnl !== null && cost > 0 ? (pnl / cost) * 100 : null,
      dayChangePercent: dayChange,
      momentum: dayChange === null ? null : classifyMomentum(dayChange),
      volatilityPercent: range,
      volatility: range === null ? null : classifyVolatility(range),
    };
  });
}

export function selectSpotlights(rows: HoldingAnalysis[]) {
  const returns = rows.filter((row) => row.unrealizedPercent !== null);
  const momentum = rows.filter((row) => row.dayChangePercent !== null);
  return {
    best: returns.reduce<HoldingAnalysis | null>(
      (best, row) =>
        !best || row.unrealizedPercent! > best.unrealizedPercent! ? row : best,
      null
    ),
    needsAttention: returns
      .filter((row) => row.unrealizedPercent! < 0)
      .reduce<HoldingAnalysis | null>(
        (worst, row) =>
          !worst || row.unrealizedPercent! < worst.unrealizedPercent!
            ? row
            : worst,
        null
      ),
    momentum: momentum.reduce<HoldingAnalysis | null>(
      (best, row) =>
        !best || row.dayChangePercent! > best.dayChangePercent! ? row : best,
      null
    ),
  };
}
