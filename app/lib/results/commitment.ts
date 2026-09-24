import type {
  Scenario,
  ScoreBreakdown,
  SimulationState,
  StrategyConfig,
} from "../simulation/types";

// Schema v2 is required by the leaderboard registry, which records an
// on-chain submission timestamp alongside this browser-created commitment.
export const RESULT_SCHEMA_VERSION = 2;
export const SIMULATION_ENGINE_VERSION = 1;

export type ResultCommitment = {
  scenarioHash: string;
  strategyHash: string;
  resultHash: string;
  totalScore: number;
  pnlBps: number;
  maxDrawdownBps: number;
  fills: number;
  schemaVersion: number;
};

/**
 * Uses an explicit field order so the commitment is stable across browsers and
 * independent of object insertion order.
 */
export function canonicalizeStrategy(strategy: StrategyConfig): string {
  return JSON.stringify({
    engineVersion: SIMULATION_ENGINE_VERSION,
    maxInventoryMilliSol: strategy.maxInventoryMilliSol,
    orderSizeMilliSol: strategy.orderSizeMilliSol,
    refreshTicks: strategy.refreshTicks,
    spreadBps: strategy.spreadBps,
  });
}

export function canonicalizeScenario(scenario: Scenario): string {
  return JSON.stringify({
    durationTicks: scenario.durationTicks,
    events: scenario.events.map((event) => ({
      label: event.label,
      priceMoveBps: event.priceMoveBps,
      tick: event.tick,
    })),
    id: scenario.id,
    seed: scenario.seed,
    startingBaseMilliSol: scenario.startingBaseMilliSol,
    startingPriceCents: scenario.startingPriceCents,
    startingQuoteCents: scenario.startingQuoteCents,
    version: scenario.version,
  });
}

export function canonicalizeFinalResult({
  scenario,
  strategyHash,
  score,
  state,
}: {
  scenario: Scenario;
  strategyHash: string;
  score: ScoreBreakdown;
  state: SimulationState;
}): string {
  const pnlBps = getPnlBps(state);
  return JSON.stringify({
    engineVersion: SIMULATION_ENGINE_VERSION,
    finalEquityCents: state.equityCents,
    fills: state.fills.length,
    maxDrawdownBps: state.maxDrawdownBps,
    pnlBps,
    scenario: { id: scenario.id, version: scenario.version },
    score: score.total,
    strategyHash,
    tick: state.tick,
  });
}

export async function createResultCommitment({
  scenario,
  strategy,
  score,
  state,
}: {
  scenario: Scenario;
  strategy: StrategyConfig;
  score: ScoreBreakdown;
  state: SimulationState;
}): Promise<ResultCommitment> {
  const strategyHash = await hashCanonical(canonicalizeStrategy(strategy));
  const [scenarioHash, resultHash] = await Promise.all([
    hashCanonical(canonicalizeScenario(scenario)),
    hashCanonical(
      canonicalizeFinalResult({ scenario, strategyHash, score, state })
    ),
  ]);

  return {
    scenarioHash,
    strategyHash,
    resultHash,
    totalScore: score.total,
    pnlBps: getPnlBps(state),
    maxDrawdownBps: state.maxDrawdownBps,
    fills: state.fills.length,
    schemaVersion: RESULT_SCHEMA_VERSION,
  };
}

export async function hashCanonical(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Web Crypto is unavailable; result verification cannot be prepared."
    );
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return bytesToHex(new Uint8Array(digest));
}

export function getPnlBps(state: SimulationState): number {
  if (state.startingEquityCents <= 0) return 0;
  return Math.round(
    ((state.equityCents - state.startingEquityCents) /
      state.startingEquityCents) *
      10_000
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}
