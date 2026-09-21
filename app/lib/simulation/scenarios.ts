import { type Scenario, type ScenarioId } from "./types";

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  "flash-crash": {
    id: "flash-crash",
    name: "Flash Crash & Recovery",
    version: 1,
    seed: 729_413,
    durationTicks: 60,
    startingPriceCents: 15_000,
    startingBaseMilliSol: 100_000,
    startingQuoteCents: 1_500_000,
    events: [
      { tick: 20, label: "Flash crash", priceMoveBps: -1200 },
      { tick: 28, label: "Liquidity returns", priceMoveBps: 500 },
      { tick: 40, label: "Recovery", priceMoveBps: 650 },
    ],
  },
  "stable-market": {
    id: "stable-market",
    name: "Stable Market",
    version: 1,
    seed: 841_213,
    durationTicks: 60,
    startingPriceCents: 15_000,
    startingBaseMilliSol: 100_000,
    startingQuoteCents: 1_500_000,
    events: [],
  },
  "whale-sell": {
    id: "whale-sell",
    name: "Whale Sell",
    version: 1,
    seed: 119_807,
    durationTicks: 60,
    startingPriceCents: 15_000,
    startingBaseMilliSol: 100_000,
    startingQuoteCents: 1_500_000,
    events: [{ tick: 32, label: "Whale sell-off", priceMoveBps: -550 }],
  },
};
