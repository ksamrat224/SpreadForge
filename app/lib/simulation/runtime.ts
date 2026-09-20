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

export type MagicBlockSession = {
  id: string;
  erEndpoint: string;
  state: SimulationState;
};

/**
 * Program-specific transport. Its implementation is responsible for creating
 * and delegating the session on base, routing tick instructions to the ER, and
 * committing/undelegating the completed session from that ER.
 */
export interface MagicBlockSessionTransport {
  start(session: SimulationSession): Promise<MagicBlockSession>;
  step(sessionId: string): Promise<SimulationState>;
  finish(sessionId: string): Promise<SimulationResult>;
}

export type MagicBlockRuntimeStatus =
  | { mode: "starting" }
  | { mode: "active"; erEndpoint: string }
  | { mode: "settled" }
  | { mode: "local-fallback"; reason: string };

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
 * Runs the same session through an ER transport. If routing, delegation, or a
 * later ER request fails, it deterministically replays the last known tick in
 * the local runtime and marks the run as provisional/local — never verified.
 */
export class MagicBlockRuntime implements SimulationRuntime {
  readonly kind = "magicblock" as const;
  status: MagicBlockRuntimeStatus = { mode: "starting" };
  private session: SimulationSession | null = null;
  private sessionId: string | null = null;
  private state: SimulationState | null = null;
  private usingFallback = false;
  private readonly fallback: LocalSimulationRuntime;

  constructor(
    private readonly transport: MagicBlockSessionTransport,
    fallback = new LocalSimulationRuntime()
  ) {
    this.fallback = fallback;
  }

  async start(session: SimulationSession): Promise<SimulationState> {
    this.session = session;
    this.status = { mode: "starting" };
    try {
      const magicSession = await this.transport.start(session);
      this.sessionId = magicSession.id;
      this.state = magicSession.state;
      this.usingFallback = false;
      this.status = { mode: "active", erEndpoint: magicSession.erEndpoint };
      return this.state;
    } catch (error) {
      return this.startFallback(error);
    }
  }

  async step(): Promise<SimulationState> {
    if (!this.session || !this.state) {
      throw new Error("Simulation has not started.");
    }
    if (this.usingFallback) {
      this.state = await this.fallback.step();
      return this.state;
    }
    try {
      this.state = await this.transport.step(this.sessionId!);
      return this.state;
    } catch (error) {
      await this.restoreFallback(error);
      this.state = await this.fallback.step();
      return this.state;
    }
  }

  async finish(): Promise<SimulationResult> {
    if (!this.session || !this.state) {
      throw new Error("Simulation has not started.");
    }
    if (this.usingFallback) return this.fallback.finish();
    try {
      const result = await this.transport.finish(this.sessionId!);
      this.state = result.state;
      this.status = { mode: "settled" };
      return result;
    } catch (error) {
      await this.restoreFallback(error);
      return this.fallback.finish();
    }
  }

  private async startFallback(error: unknown): Promise<SimulationState> {
    if (!this.session) throw new Error("Simulation has not started.");
    this.usingFallback = true;
    this.sessionId = null;
    this.state = await this.fallback.start(this.session);
    this.status = { mode: "local-fallback", reason: errorMessage(error) };
    return this.state;
  }

  private async restoreFallback(error: unknown) {
    if (!this.session || !this.state)
      throw new Error("Simulation has not started.");
    const completedTicks = this.state.tick;
    await this.startFallback(error);
    while (this.state!.tick < completedTicks)
      this.state = await this.fallback.step();
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "MagicBlock runtime unavailable.";
}
