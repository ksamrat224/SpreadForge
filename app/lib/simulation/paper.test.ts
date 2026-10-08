import { describe, expect, it } from "vitest";
import {
  createPaperState,
  getPaperEquityCents,
  PAPER_ASSETS,
  paperReducer,
  WALLET_PAPER_SOL_CAP_MILLI,
} from "./paper";

describe("shared multi-asset paper portfolio", () => {
  it("starts with 10,000 USDC and no crypto inventory", () => {
    const state = createPaperState();
    expect(state.usdcCents).toBe(1_000_000);
    expect(Object.keys(state.positions)).toEqual(PAPER_ASSETS);
    expect(Object.values(state.positions)).toEqual(
      PAPER_ASSETS.map(() => ({ quantityMilliAsset: 0, inventoryCostCents: 0 }))
    );
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
  it("clears every chart on a feed restart and re-anchors change on the first live price", () => {
    let state = createPaperState();
    state = paperReducer(state, { type: "restart-feed" });
    expect(state.markets.BTC.points).toHaveLength(0);
    expect(state.markets.SOL.points).toHaveLength(0);
    state = paperReducer(state, {
      type: "tick",
      asset: "SOL",
      priceCents: 12_000,
      at: 1_800_000_000_000,
    });
    expect(state.markets.SOL.startPriceCents).toBe(12_000);
    expect(state.markets.SOL.points).toHaveLength(1);
  });
  it("caps a wallet-backed session at 10 virtual SOL and values it at the snapshot price", () => {
    const state = paperReducer(createPaperState(), {
      type: "start-wallet-session",
      seed: 22,
      solMilliAsset: 25_000,
      solPriceCents: 15_000,
    });
    expect(state.fundingSource).toBe("wallet");
    expect(state.usdcCents).toBe(0);
    expect(state.positions.SOL).toEqual({
      quantityMilliAsset: WALLET_PAPER_SOL_CAP_MILLI,
      inventoryCostCents: 150_000,
    });
    expect(state.startEquityCents).toBe(150_000);
    expect(getPaperEquityCents(state)).toBe(150_000);
  });
  it("keeps fixed practice when a wallet snapshot has no virtual SOL", () => {
    const initial = createPaperState();
    const state = paperReducer(initial, {
      type: "start-wallet-session",
      seed: 22,
      solMilliAsset: 0,
      solPriceCents: 15_000,
    });
    expect(state).toBe(initial);
    expect(state.fundingSource).toBe("fixed");
    expect(state.usdcCents).toBe(1_000_000);
  });
  it("converts virtual SOL through the simulated reducer without a wallet operation", () => {
    let state = paperReducer(createPaperState(), {
      type: "start-wallet-session",
      seed: 22,
      solMilliAsset: 2_000,
      solPriceCents: 15_000,
    });
    state = paperReducer(state, {
      type: "market",
      asset: "SOL",
      side: "sell",
      sizeMilliAsset: 2_000,
      at: 1,
    });
    expect(state.fundingSource).toBe("wallet");
    expect(state.positions.SOL.quantityMilliAsset).toBe(0);
    expect(state.usdcCents).toBe(30_000);
    expect(state.trades).toHaveLength(1);
    expect(state.trades[0]).toMatchObject({
      source: "MARKET",
      side: "sell",
      asset: "SOL",
    });
  });
  it("replaces a wallet session only when a new explicit snapshot is provided", () => {
    let state = paperReducer(createPaperState(), {
      type: "start-wallet-session",
      seed: 22,
      solMilliAsset: 1_000,
      solPriceCents: 15_000,
    });
    state = paperReducer(state, {
      type: "market",
      asset: "SOL",
      side: "sell",
      sizeMilliAsset: 1_000,
      at: 1,
    });
    state = paperReducer(state, {
      type: "start-wallet-session",
      seed: 23,
      solMilliAsset: 2_000,
      solPriceCents: 20_000,
    });
    expect(state.positions.SOL.quantityMilliAsset).toBe(2_000);
    expect(state.usdcCents).toBe(0);
    expect(state.startEquityCents).toBe(40_000);
    expect(state.trades).toHaveLength(0);
  });
});
