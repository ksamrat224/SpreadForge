import { describe, expect, it } from "vitest";
import { SCENARIOS, runSimulation } from "../simulation";
import { DEFAULT_STRATEGY } from "../simulation/engine";
import { scoreRun } from "../simulation/score";
import {
  canonicalizeStrategy,
  createResultCommitment,
  hashCanonical,
} from "./commitment";

describe("result commitments", () => {
  it("canonicalizes strategy fields in a stable order", () => {
    expect(canonicalizeStrategy(DEFAULT_STRATEGY)).toBe(
      '{"engineVersion":1,"maxInventoryMilliSol":120000,"orderSizeMilliSol":2000,"refreshTicks":2,"spreadBps":30}'
    );
  });

  it("produces repeatable SHA-256 commitments for the same completed run", async () => {
    const scenario = SCENARIOS["whale-sell"];
    const run = runSimulation(scenario, DEFAULT_STRATEGY);
    const state = run.state;
    const score = scoreRun(state, DEFAULT_STRATEGY, scenario.durationTicks);

    const [first, second] = await Promise.all([
      createResultCommitment({
        scenario,
        strategy: DEFAULT_STRATEGY,
        score,
        state,
      }),
      createResultCommitment({
        scenario,
        strategy: DEFAULT_STRATEGY,
        score,
        state,
      }),
    ]);

    expect(first).toEqual(second);
    expect(first.scenarioHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.strategyHash).toBe(
      await hashCanonical(canonicalizeStrategy(DEFAULT_STRATEGY))
    );
  });
});
