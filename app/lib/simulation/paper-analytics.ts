import {
  PAPER_ASSETS,
  type PaperAsset,
  type PaperState,
  type PricePoint,
} from "./paper";

export type PortfolioPoint = {
  at: number;
  inventoryMilliAsset: number;
  equityCents: number;
};

/** Latest price at or before `at`, falling back to the market's current price. */
function priceAt(state: PaperState, asset: PaperAsset, at: number) {
  const points = state.markets[asset].points;
  let low = 0;
  let high = points.length - 1;
  let found: number | null = null;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (points[mid].at <= at) {
      found = points[mid].priceCents;
      low = mid + 1;
    } else high = mid - 1;
  }
  return found ?? state.markets[asset].priceCents;
}

/**
 * Rebuilds the portfolio at each price point by undoing, newest first, every
 * trade made after it. Trades older than the retained trade log are assumed
 * to predate the chart window.
 */
export function portfolioHistory(
  state: PaperState,
  asset: PaperAsset,
  points: PricePoint[]
): PortfolioPoint[] {
  let cash = state.usdcCents;
  const quantity = Object.fromEntries(
    PAPER_ASSETS.map((item) => [item, state.positions[item].quantityMilliAsset])
  ) as Record<PaperAsset, number>;
  const trades = [...state.trades].sort((a, b) => b.at - a.at);
  let next = 0;
  const history: PortfolioPoint[] = [];
  for (let i = points.length - 1; i >= 0; i--) {
    const point = points[i];
    for (; next < trades.length && trades[next].at > point.at; next++) {
      const trade = trades[next];
      const cost = Math.round((trade.priceCents * trade.sizeMilliAsset) / 1000);
      const sign = trade.side === "buy" ? 1 : -1;
      cash += sign * cost;
      quantity[trade.asset] -= sign * trade.sizeMilliAsset;
    }
    const equityCents =
      cash +
      PAPER_ASSETS.reduce(
        (total, item) =>
          total +
          Math.round(
            (quantity[item] *
              (item === asset
                ? point.priceCents
                : priceAt(state, item, point.at))) /
              1000
          ),
        0
      );
    history.push({
      at: point.at,
      inventoryMilliAsset: quantity[asset],
      equityCents,
    });
  }
  return history.reverse();
}

/** Percentage below the running peak of portfolio value (0 at a new high). */
export function drawdownPercent(equity: number[]) {
  let peak = -Infinity;
  return equity.map((value) => {
    peak = Math.max(peak, value);
    return peak > 0 ? ((value - peak) / peak) * 100 : 0;
  });
}
