import { describe, it, expect } from "vitest";
import { createPaperState, paperReducer } from "./paper";
import { runSimulation, DEFAULT_STRATEGY, SCENARIOS } from "./index";
describe("Paper funds and order reservations", () => {
  it("reserves buying power and prevents duplicate spending", () => {
    let state = createPaperState();
    state = paperReducer(state, {
      type: "quote",
      side: "buy",
      priceCents: 14000,
      sizeMilliSol: 10000,
      at: 1,
    });
    expect(state.quotes).toHaveLength(1);
    state = paperReducer(state, {
      type: "market",
      side: "buy",
      sizeMilliSol: 1000,
      at: 2,
    });
    expect(state.trades).toHaveLength(0);
    expect(state.usdcCents).toBe(150000);
    expect(state.error).toMatch(/available simulated USDC/);
  });
  it("fills simultaneous orders atomically without negative balances", () => {
    let state = createPaperState();
    state = paperReducer(state, {
      type: "quote",
      side: "buy",
      priceCents: 14000,
      sizeMilliSol: 5000,
      at: 1,
    });
    state = paperReducer(state, {
      type: "quote",
      side: "buy",
      priceCents: 14000,
      sizeMilliSol: 5000,
      at: 2,
    });
    state = paperReducer(state, { type: "tick", priceCents: 13900, at: 3 });
    expect(state.quotes).toHaveLength(0);
    expect(state.trades).toHaveLength(2);
    expect(state.usdcCents).toBe(10000);
    expect(state.solMilli).toBe(20000);
  });
  it("releases reserved inventory when an order is cancelled", () => {
    let state = createPaperState();
    state = paperReducer(state, {
      type: "quote",
      side: "sell",
      priceCents: 16000,
      sizeMilliSol: 10000,
      at: 1,
    });
    state = paperReducer(state, {
      type: "market",
      side: "sell",
      sizeMilliSol: 1000,
      at: 2,
    });
    expect(state.trades).toHaveLength(0);
    state = paperReducer(state, { type: "cancel", id: state.quotes[0].id });
    state = paperReducer(state, {
      type: "market",
      side: "sell",
      sizeMilliSol: 1000,
      at: 3,
    });
    expect(state.trades).toHaveLength(1);
    expect(state.solMilli).toBe(9000);
  });
  it("keeps the initial equity reference after price history rolls", () => {
    let state = createPaperState();
    const baseline = state.startEquityCents;
    for (let i = 0; i < 200; i++)
      state = paperReducer(state, {
        type: "tick",
        priceCents: 15000,
        at: 100000 + i,
      });
    expect(state.startEquityCents).toBe(baseline);
    expect(state.startPriceCents).toBe(14682);
  });
  it("rejects invalid quotes without changing balances", () => {
    const initial = createPaperState();
    const state = paperReducer(initial, {
      type: "quote",
      side: "buy",
      priceCents: NaN,
      sizeMilliSol: 1000,
      at: 1,
    });
    expect(state.quotes).toHaveLength(0);
    expect(state.usdcCents).toBe(initial.usdcCents);
    expect(state.error).toBeTruthy();
  });
});
describe("Flash Crash challenge", () => {
  it("replays deterministically and includes all three events", () => {
    const first = runSimulation(SCENARIOS["flash-crash"], DEFAULT_STRATEGY);
    expect(first).toEqual(
      runSimulation(SCENARIOS["flash-crash"], DEFAULT_STRATEGY)
    );
    expect(first.state.tick).toBe(60);
    expect(first.state.priceHistoryCents[20]).toBeLessThan(
      first.state.priceHistoryCents[19] * 0.9
    );
    expect(first.state.priceHistoryCents[40]).toBeGreaterThan(
      first.state.priceHistoryCents[39]
    );
  });
});
