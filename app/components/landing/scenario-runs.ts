import { DEFAULT_STRATEGY, runSimulation } from "../../lib/simulation/engine";
import { SCENARIOS } from "../../lib/simulation/scenarios";
import type { ScenarioId, SimulationResult } from "../../lib/simulation/types";

/**
 * The landing page shows real output from the deterministic engine: every
 * scenario is replayed once with the default strategy, exactly as the lab
 * would produce it for the same seed and configuration.
 */
export const SCENARIO_RUNS = Object.fromEntries(
  (Object.keys(SCENARIOS) as ScenarioId[]).map((id) => [
    id,
    runSimulation(SCENARIOS[id], DEFAULT_STRATEGY),
  ])
) as Record<ScenarioId, SimulationResult>;

/** Projects a price series onto an SVG viewBox and returns the path data. */
export function pricePath(
  prices: number[],
  width: number,
  height: number,
  padding = 8
) {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const x = (i: number) => (i / (prices.length - 1)) * width;
  const y = (price: number) =>
    padding + (1 - (price - min) / span) * (height - padding * 2);
  const line = prices
    .map(
      (price, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(price).toFixed(1)}`
    )
    .join(" ");
  return { line, area: `${line} L${width},${height} L0,${height} Z`, x, y };
}

export const usd = (cents: number, digits = 2) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
