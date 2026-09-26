import { describe, expect, it } from "vitest";
import { createPaperState, getPaperEquityCents, paperReducer } from "./paper";

describe("shared multi-asset paper portfolio", () => {
  it("starts with 10,000 USDC and no crypto inventory", () => {
    const state = createPaperState();
    expect(state.usdcCents).toBe(1_000_000);
    expect(state.positions).toEqual({
      BTC: { quantityMilliAsset: 0, inventoryCostCents: 0 },
      ETH: { quantityMilliAsset: 0, inventoryCostCents: 0 },
      SOL: { quantityMilliAsset: 0, inventoryCostCents: 0 },
    });
  });
  it("shares USDC across BTC and ETH purchases while retaining both positions", () => {
    let state = createPaperState();
    state = paperReducer(state, {
      type: "market",
      asset: "BTC",
      side: "buy",
      sizeMilliAsset: 10,
      at: 1,
    });
    const afterBtc = state.usdcCents;
    state = paperReducer(state, {
      type: "market",
      asset: "ETH",
      side: "buy",
      sizeMilliAsset: 100,
      at: 2,
    });
    expect(state.positions.BTC.quantityMilliAsset).toBe(10);
    expect(state.positions.ETH.quantityMilliAsset).toBe(100);
    expect(state.usdcCents).toBeLessThan(afterBtc);
  });
  it("prevents selling an asset that the shared portfolio does not own", () => {
    const state = paperReducer(createPaperState(), {
      type: "market",
      asset: "ETH",
      side: "sell",
      sizeMilliAsset: 1,
      at: 1,
    });
    expect(state.trades).toHaveLength(0);
    expect(state.error).toMatch(/ETH/);
  });
  it("keeps BTC quotes reserved while trading SOL", () => {
    let state = createPaperState();
    state = paperReducer(state, {
      type: "quote",
      asset: "BTC",
      side: "buy",
      priceCents: 1_000_000,
      sizeMilliAsset: 990,
      at: 1,
    });
    state = paperReducer(state, {
      type: "market",
      asset: "SOL",
      side: "buy",
      sizeMilliAsset: 1000,
      at: 2,
    });
    expect(state.trades).toHaveLength(0);
    expect(state.error).toMatch(/USDC/);
  });
  it("marks total portfolio equity using every current asset price", () => {
    let state = createPaperState();
    state = paperReducer(state, {
      type: "market",
      asset: "SOL",
      side: "buy",
      sizeMilliAsset: 1000,
      at: 1,
    });
    const before = getPaperEquityCents(state);
    state = paperReducer(state, {
      type: "tick",
      asset: "SOL",
      priceCents: state.markets.SOL.priceCents + 10_000,
      at: 2,
    });
    expect(getPaperEquityCents(state)).toBeGreaterThan(before);
  });
  it("cancels an asset quote and resets every asset safely", () => {
    let state = createPaperState();
    state = paperReducer(state, {
      type: "quote",
      asset: "SOL",
      side: "buy",
      priceCents: 100,
      sizeMilliAsset: 1000,
      at: 1,
    });
    state = paperReducer(state, { type: "cancel", id: state.quotes[0].id });
    expect(state.quotes).toHaveLength(0);
    state = paperReducer(state, { type: "reset", seed: 22 });
    expect(state.usdcCents).toBe(1_000_000);
    expect(state.trades).toHaveLength(0);
  });
});
