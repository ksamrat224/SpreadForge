import { describe, expect, it } from "vitest";
import {
  createSimulation,
  DEFAULT_STRATEGY,
  runSimulation,
  SCENARIOS,
} from ".";
import { SCORE_MAX, SCORE_WEIGHTS, scoreRun } from "./score";

describe("canonical scoring", () => {
  it("weights normalized components into the 0–10,000 range", () => {
    const state = createSimulation(
      SCENARIOS["stable-market"],
      DEFAULT_STRATEGY
    );
    const result = scoreRun(
      state,
      DEFAULT_STRATEGY,
      SCENARIOS["stable-market"].durationTicks
    );
    const expected = Math.round(
      (result.liquidity * SCORE_WEIGHTS.liquidity +
        result.spreadEfficiency * SCORE_WEIGHTS.spreadEfficiency +
        result.inventoryControl * SCORE_WEIGHTS.inventoryControl +
        result.drawdownControl * SCORE_WEIGHTS.drawdownControl +
        result.pnl * SCORE_WEIGHTS.pnl) *
        100
    );

    expect(result.total).toBe(expected);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(SCORE_MAX);
  });

  it("rewards a complete, balanced run more than an untouched session", () => {
    const untouched = scoreRun(
      createSimulation(SCENARIOS["stable-market"], DEFAULT_STRATEGY),
      DEFAULT_STRATEGY,
      SCENARIOS["stable-market"].durationTicks
    );
    const completed = runSimulation(
      SCENARIOS["stable-market"],
      DEFAULT_STRATEGY
    ).score;

    expect(completed.liquidity).toBeGreaterThan(untouched.liquidity);
    expect(completed.total).toBeGreaterThan(untouched.total);
  });
});
