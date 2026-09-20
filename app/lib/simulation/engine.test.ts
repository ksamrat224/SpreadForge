import { describe, expect, it } from "vitest";
import {
  DEFAULT_STRATEGY,
  createSimulation,
  runSimulation,
  SCENARIOS,
  stepSimulation,
} from ".";
import { LocalSimulationRuntime } from "./runtime";

describe("SpreadForge deterministic simulation", () => {
  it("replays the same scenario and strategy identically", () => {
    const first = runSimulation(SCENARIOS["whale-sell"], DEFAULT_STRATEGY);
    const second = runSimulation(SCENARIOS["whale-sell"], DEFAULT_STRATEGY);

    expect(first.state).toEqual(second.state);
    expect(first.score).toEqual(second.score);
  });

  it("applies the Whale Sell event at its documented tick", () => {
    let state = createSimulation(SCENARIOS["whale-sell"], DEFAULT_STRATEGY);
    for (let tick = 0; tick < 32; tick += 1) {
      state = stepSimulation(state, SCENARIOS["whale-sell"], DEFAULT_STRATEGY);
    }

    expect(state.tick).toBe(32);
    expect(
      state.activity.some((message) => message.includes("Whale sell-off"))
    ).toBe(true);
  });

  it("never exceeds the configured maximum inventory", () => {
    const strategy = { ...DEFAULT_STRATEGY, maxInventoryMilliSol: 102_000 };
    const result = runSimulation(SCENARIOS["whale-sell"], strategy);

    expect(result.state.baseMilliSol).toBeLessThanOrEqual(
      strategy.maxInventoryMilliSol
    );
  });

  it("places symmetric orders and replaces outstanding orders on refresh", () => {
    const scenario = SCENARIOS["stable-market"];
    let state = createSimulation(scenario, DEFAULT_STRATEGY);
    expect(state.openOrders.map((order) => order.side)).toEqual([
      "buy",
      "sell",
    ]);

    state = stepSimulation(state, scenario, DEFAULT_STRATEGY);
    state = stepSimulation(state, scenario, DEFAULT_STRATEGY);
    expect(state.openOrders.every((order) => order.createdTick === 2)).toBe(
      true
    );
    expect(
      state.activity.some((message) =>
        message.includes("Cancelled and replaced")
      )
    ).toBe(true);
  });

  it("records a deterministic fill and reconciles realized plus unrealized P&L", () => {
    const result = runSimulation(SCENARIOS["whale-sell"], DEFAULT_STRATEGY);
    const pnlCents =
      result.state.equityCents - result.state.startingEquityCents;

    expect(result.state.fills.length).toBeGreaterThan(0);
    expect(
      result.state.realizedPnlCents + result.state.unrealizedPnlCents
    ).toBe(pnlCents);
  });

  it("runs through the local runtime boundary", async () => {
    const runtime = new LocalSimulationRuntime();
    await runtime.start({
      scenario: SCENARIOS["stable-market"],
      strategy: DEFAULT_STRATEGY,
    });
    const state = await runtime.step();
    const result = await runtime.finish();

    expect(runtime.kind).toBe("local");
    expect(state.tick).toBe(1);
    expect(result.state.tick).toBe(result.scenario.durationTicks);
  });
});
