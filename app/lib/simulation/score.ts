import {
  type ScoreBreakdown,
  type SimulationState,
  type StrategyConfig,
} from "./types";

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

export function scoreRun(
  state: SimulationState,
  strategy: StrategyConfig,
  durationTicks: number
): ScoreBreakdown {
  const liquidity = clamp((state.liquidityTicks / durationTicks) * 100);
  const spreadEfficiency = clamp(
    100 - Math.abs(strategy.spreadBps - 30) * 1.25
  );
  const inventoryRatio =
    Math.abs(state.baseMilliSol - 100_000) / strategy.maxInventoryMilliSol;
  const inventoryControl = clamp(100 - inventoryRatio * 100);
  const drawdownControl = clamp(100 - state.maxDrawdownBps / 10);
  const pnlBps =
    ((state.equityCents - state.startingEquityCents) /
      state.startingEquityCents) *
    10_000;
  const pnl = clamp(50 + pnlBps / 4);
  const total = Math.round(
    (liquidity * 0.3 +
      spreadEfficiency * 0.25 +
      inventoryControl * 0.2 +
      drawdownControl * 0.15 +
      pnl * 0.1) *
      100
  );
  return {
    total,
    liquidity,
    spreadEfficiency,
    inventoryControl,
    drawdownControl,
    pnl,
  };
}
