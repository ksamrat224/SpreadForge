import { describe, expect, it } from "vitest";
import { createPaperState, paperReducer, type PaperState } from "./paper";
import { drawdownPercent, portfolioHistory } from "./paper-analytics";

function tick(state: PaperState, priceCents: number, at: number) {
  return paperReducer(state, { type: "tick", asset: "SOL", priceCents, at });
}

describe("paper portfolio history", () => {
  it("shows inventory and equity only from the moment a trade happened", () => {
    let state = paperReducer(createPaperState(), { type: "restart-feed" });
    state = tick(state, 10_000, 1_000);
    state = tick(state, 10_000, 2_000);
    state = paperReducer(state, {
      type: "market",
      asset: "SOL",
      side: "buy",
      sizeMilliAsset: 2000,
      at: 2_000,
    });
    state = tick(state, 11_000, 3_000);
    const history = portfolioHistory(state, "SOL", state.markets.SOL.points);
    expect(history.map((point) => point.inventoryMilliAsset)).toEqual([
      0, 2000, 2000,
    ]);
    // Flat before and at the fill; +$20 once SOL rises $10 on 2 SOL.
    expect(history.map((point) => point.equityCents - 1_000_000)).toEqual([
      0, 0, 2_000,
    ]);
  });
  it("measures drawdown from the running equity peak", () => {
    expect(drawdownPercent([100, 110, 99, 120])).toEqual([0, 0, -10, 0]);
  });
});
