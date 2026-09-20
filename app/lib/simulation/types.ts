export type ScenarioId = "stable-market" | "whale-sell";

export type Scenario = {
  id: ScenarioId;
  name: string;
  version: number;
  seed: number;
  durationTicks: number;
  startingPriceCents: number;
  startingBaseMilliSol: number;
  startingQuoteCents: number;
  events: Array<{ tick: number; label: string; priceMoveBps: number }>;
};

export type StrategyConfig = {
  spreadBps: number;
  orderSizeMilliSol: number;
  maxInventoryMilliSol: number;
  refreshTicks: number;
};

export type Fill = {
  tick: number;
  side: "buy" | "sell";
  sizeMilliSol: number;
  priceCents: number;
  reason: string;
};

export type SimOrder = {
  id: string;
  side: "buy" | "sell";
  sizeMilliSol: number;
  priceCents: number;
  createdTick: number;
};

export type SimulationState = {
  tick: number;
  referencePriceCents: number;
  priceHistoryCents: number[];
  bidCents: number;
  askCents: number;
  baseMilliSol: number;
  quoteCents: number;
  openOrders: SimOrder[];
  fills: Fill[];
  inventoryCostCents: number;
  realizedPnlCents: number;
  unrealizedPnlCents: number;
  liquidityTicks: number;
  startingEquityCents: number;
  equityCents: number;
  peakEquityCents: number;
  maxDrawdownBps: number;
  activity: string[];
};

export type ScoreBreakdown = {
  total: number;
  liquidity: number;
  spreadEfficiency: number;
  inventoryControl: number;
  drawdownControl: number;
  pnl: number;
};

export type SimulationResult = {
  scenario: Scenario;
  strategy: StrategyConfig;
  state: SimulationState;
  score: ScoreBreakdown;
};
