import { describe, expect, it } from "vitest";
import { createSimulation, runSimulation, stepSimulation } from "./engine";
import { DEFAULT_STRATEGY } from "./engine";
import { SCENARIOS } from "./scenarios";
import {
  MagicBlockRuntime,
  type MagicBlockSessionTransport,
  type SimulationSession,
} from "./runtime";

function transportThatMirrorsEngine(
  failOnStep = false
): MagicBlockSessionTransport {
  let session: SimulationSession | null = null;
  let state = createSimulation(SCENARIOS["stable-market"], DEFAULT_STRATEGY);
  return {
    async start(nextSession) {
      session = nextSession;
      state = createSimulation(session.scenario, session.strategy);
      return {
        id: "session-1",
        erEndpoint: "https://devnet-as.magicblock.app/",
        state,
      };
    },
    async step() {
      if (failOnStep) throw new Error("ER connection lost");
      if (!session) throw new Error("session missing");
      state = stepSimulation(state, session.scenario, session.strategy);
      return state;
    },
    async finish() {
      if (!session) throw new Error("session missing");
      return runSimulation(session.scenario, session.strategy);
    },
  };
}

describe("MagicBlock runtime adapter", () => {
  const session = {
    scenario: SCENARIOS["stable-market"],
    strategy: DEFAULT_STRATEGY,
  };

  it("uses the ER transport when routing and operations succeed", async () => {
    const runtime = new MagicBlockRuntime(transportThatMirrorsEngine());
    await runtime.start(session);
    const state = await runtime.step();
    const result = await runtime.finish();

    expect(state.tick).toBe(1);
    expect(runtime.status).toEqual({ mode: "settled" });
    expect(result.state.tick).toBe(session.scenario.durationTicks);
  });

  it("replays locally if an ER tick fails and never marks it settled", async () => {
    const runtime = new MagicBlockRuntime(transportThatMirrorsEngine(true));
    await runtime.start(session);
    const state = await runtime.step();

    expect(state.tick).toBe(1);
    expect(runtime.status).toEqual({
      mode: "local-fallback",
      reason: "ER connection lost",
    });
    expect((await runtime.finish()).state.tick).toBe(
      session.scenario.durationTicks
    );
  });
});
