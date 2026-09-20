import { createSimulation, runSimulation, stepSimulation } from "./engine";
import {
  type Scenario,
  type SimulationResult,
  type SimulationState,
  type StrategyConfig,
} from "./types";

export type SimulationSession = {
  scenario: Scenario;
  strategy: StrategyConfig;
};

/**
 * The UI depends only on this contract. MagicBlock can replace the local
 * implementation without changing pricing, scoring, or UI state handling.
 */
export interface SimulationRuntime {
  readonly kind: "local" | "magicblock";
  start(session: SimulationSession): Promise<SimulationState>;
  step(): Promise<SimulationState>;
  finish(): Promise<SimulationResult>;
}

export class LocalSimulationRuntime implements SimulationRuntime {
  readonly kind = "local" as const;
  private session: SimulationSession | null = null;
  private state: SimulationState | null = null;

  async start(session: SimulationSession): Promise<SimulationState> {
    this.session = session;
    this.state = createSimulation(session.scenario, session.strategy);
    return this.state;
  }

  async step(): Promise<SimulationState> {
    if (!this.session || !this.state)
      throw new Error("Simulation has not started.");
    this.state = stepSimulation(
      this.state,
      this.session.scenario,
      this.session.strategy
    );
    return this.state;
  }

  async finish(): Promise<SimulationResult> {
    if (!this.session || !this.state)
      throw new Error("Simulation has not started.");
    while (this.state.tick < this.session.scenario.durationTicks)
      await this.step();
    return runSimulation(this.session.scenario, this.session.strategy);
  }
}

/**
 * Integration seam for a future ER client. It deliberately cannot fall back
 * silently: callers should select LocalSimulationRuntime when ER setup,
 * router discovery, or delegation is unavailable.
 */
export class MagicBlockRuntime implements SimulationRuntime {
  readonly kind = "magicblock" as const;

  async start(): Promise<SimulationState> {
    throw new Error(
      "MagicBlock runtime is not configured. Use the local runtime fallback."
    );
  }

  async step(): Promise<SimulationState> {
    throw new Error(
      "MagicBlock runtime is not configured. Use the local runtime fallback."
    );
  }

  async finish(): Promise<SimulationResult> {
    throw new Error(
      "MagicBlock runtime is not configured. Use the local runtime fallback."
    );
  }
}
