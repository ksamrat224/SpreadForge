import type { ScenarioId } from "./types";

/** Learner-facing labels for each challenge scenario. */
export const CHALLENGE_META = {
  "stable-market": {
    level: "Beginner",
    volatility: "LOW",
    tone: "profit",
    tip: "Keep your quotes tight and your inventory balanced in a calm market.",
    description:
      "Find your rhythm. Provide steady liquidity in a calm, two-sided market.",
  },
  "whale-sell": {
    level: "Intermediate",
    volatility: "EVENT",
    tone: "warning",
    tip: "Build inventory headroom before the whale sell at tick 32.",
    description:
      "A large sell order hits at tick 32. Can your inventory limits absorb the shock?",
  },
  "flash-crash": {
    level: "Advanced",
    volatility: "EXTREME",
    tone: "loss",
    tip: "Protect your inventory through the crash at tick 20 and the recovery that follows.",
    description:
      "Survive a sudden 12% crash, then navigate two sharp recovery waves.",
  },
} satisfies Record<
  ScenarioId,
  {
    level: string;
    volatility: string;
    tone: "profit" | "warning" | "loss";
    tip: string;
    description: string;
  }
>;
