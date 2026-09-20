import { createPrng } from "./prng";
import { scoreRun } from "./score";
import {
  type Scenario,
  type SimOrder,
  type SimulationResult,
  type SimulationState,
  type StrategyConfig,
} from "./types";

const equity = (baseMilliSol: number, quoteCents: number, priceCents: number) =>
  quoteCents + Math.round((baseMilliSol * priceCents) / 1000);

function quoteOrders(
  tick: number,
  bidCents: number,
  askCents: number,
  baseMilliSol: number,
  strategy: StrategyConfig
): SimOrder[] {
  const orders: SimOrder[] = [];
  if (
    baseMilliSol + strategy.orderSizeMilliSol <=
    strategy.maxInventoryMilliSol
  ) {
    orders.push({
      id: `${tick}-buy`,
      side: "buy",
      sizeMilliSol: strategy.orderSizeMilliSol,
      priceCents: bidCents,
      createdTick: tick,
    });
  }
  if (baseMilliSol >= strategy.orderSizeMilliSol) {
    orders.push({
      id: `${tick}-sell`,
      side: "sell",
      sizeMilliSol: strategy.orderSizeMilliSol,
      priceCents: askCents,
      createdTick: tick,
    });
  }
  return orders;
}

export const DEFAULT_STRATEGY: StrategyConfig = {
  spreadBps: 30,
  orderSizeMilliSol: 2_000,
  maxInventoryMilliSol: 120_000,
  refreshTicks: 2,
};

export function createSimulation(
  scenario: Scenario,
  strategy: StrategyConfig
): SimulationState {
  const startingEquityCents = equity(
    scenario.startingBaseMilliSol,
    scenario.startingQuoteCents,
    scenario.startingPriceCents
  );
  const halfSpread = Math.max(1, Math.round(strategy.spreadBps / 2));
  const bidCents = Math.floor(
    (scenario.startingPriceCents * (10_000 - halfSpread)) / 10_000
  );
  const askCents = Math.ceil(
    (scenario.startingPriceCents * (10_000 + halfSpread)) / 10_000
  );
  const inventoryCostCents = Math.round(
    (scenario.startingBaseMilliSol * scenario.startingPriceCents) / 1000
  );
  return {
    tick: 0,
    referencePriceCents: scenario.startingPriceCents,
    priceHistoryCents: [scenario.startingPriceCents],
    bidCents,
    askCents,
    baseMilliSol: scenario.startingBaseMilliSol,
    quoteCents: scenario.startingQuoteCents,
    openOrders: quoteOrders(
      0,
      bidCents,
      askCents,
      scenario.startingBaseMilliSol,
      strategy
    ),
    fills: [],
    inventoryCostCents,
    realizedPnlCents: 0,
    unrealizedPnlCents: 0,
    liquidityTicks: 0,
    startingEquityCents,
    equityCents: startingEquityCents,
    peakEquityCents: startingEquityCents,
    maxDrawdownBps: 0,
    activity: ["Session initialized with simulated balances."],
  };
}

function randomAt(seed: number, tick: number) {
  const random = createPrng(seed);
  for (let index = 0; index <= tick * 2; index += 1) random();
  return [random(), random()] as const;
}

export function stepSimulation(
  state: SimulationState,
  scenario: Scenario,
  strategy: StrategyConfig
): SimulationState {
  if (state.tick >= scenario.durationTicks) return state;
  const tick = state.tick + 1;
  const [noise, fillRoll] = randomAt(scenario.seed, tick);
  const event = scenario.events.find((item) => item.tick === tick);
  const moveBps = Math.round((noise - 0.5) * 42) + (event?.priceMoveBps ?? 0);
  const referencePriceCents = Math.max(
    100,
    Math.round((state.referencePriceCents * (10_000 + moveBps)) / 10_000)
  );
  const halfSpread = Math.max(1, Math.round(strategy.spreadBps / 2));
  const bidCents = Math.floor(
    (referencePriceCents * (10_000 - halfSpread)) / 10_000
  );
  const askCents = Math.ceil(
    (referencePriceCents * (10_000 + halfSpread)) / 10_000
  );
  let baseMilliSol = state.baseMilliSol;
  let quoteCents = state.quoteCents;
  let inventoryCostCents = state.inventoryCostCents;
  let realizedPnlCents = state.realizedPnlCents;
  const fills = [...state.fills];
  const activity = event
    ? [
        ...state.activity,
        `${event.label}: reference price moved ${event.priceMoveBps / 100}%.`,
      ]
    : [...state.activity];
  const isRefresh = tick % strategy.refreshTicks === 0;
  let openOrders = isRefresh
    ? quoteOrders(tick, bidCents, askCents, baseMilliSol, strategy)
    : [...state.openOrders];
  if (isRefresh && state.openOrders.length > 0) {
    activity.push(
      `Cancelled and replaced ${state.openOrders.length} quote${state.openOrders.length === 1 ? "" : "s"}.`
    );
  }
  const deviation = referencePriceCents - state.referencePriceCents;
  const buyOrder = openOrders.find((order) => order.side === "buy");
  const sellOrder = openOrders.find((order) => order.side === "sell");
  const aggressiveFlow = Math.abs(event?.priceMoveBps ?? 0) >= 200;
  const buyFill =
    Boolean(buyOrder) && deviation < 0 && (fillRoll < 0.75 || aggressiveFlow);
  const sellFill =
    Boolean(sellOrder) && deviation > 0 && (fillRoll < 0.75 || aggressiveFlow);
  if (buyFill) {
    const order = buyOrder!;
    const cost = Math.round((order.sizeMilliSol * order.priceCents) / 1000);
    baseMilliSol += order.sizeMilliSol;
    quoteCents -= cost;
    inventoryCostCents += cost;
    openOrders = openOrders.filter((item) => item.id !== order.id);
    fills.push({
      tick,
      side: "buy",
      sizeMilliSol: order.sizeMilliSol,
      priceCents: order.priceCents,
      reason: event ? "Absorbed sell-off flow" : "Bid quote filled",
    });
    activity.push(
      `Bought ${(order.sizeMilliSol / 1000).toFixed(1)} SOL at $${(order.priceCents / 100).toFixed(2)}.`
    );
  } else if (sellFill) {
    const order = sellOrder!;
    const inventoryCostSold = Math.round(
      (inventoryCostCents * order.sizeMilliSol) / baseMilliSol
    );
    const proceeds = Math.round((order.sizeMilliSol * order.priceCents) / 1000);
    baseMilliSol -= order.sizeMilliSol;
    quoteCents += proceeds;
    inventoryCostCents -= inventoryCostSold;
    realizedPnlCents += proceeds - inventoryCostSold;
    openOrders = openOrders.filter((item) => item.id !== order.id);
    fills.push({
      tick,
      side: "sell",
      sizeMilliSol: order.sizeMilliSol,
      priceCents: order.priceCents,
      reason: "Ask quote filled",
    });
    activity.push(
      `Sold ${(order.sizeMilliSol / 1000).toFixed(1)} SOL at $${(order.priceCents / 100).toFixed(2)}.`
    );
  } else if (isRefresh && !openOrders.some((order) => order.side === "buy")) {
    activity.push("Inventory guard paused additional bid exposure.");
  }
  const equityCents = equity(baseMilliSol, quoteCents, referencePriceCents);
  const unrealizedPnlCents =
    Math.round((baseMilliSol * referencePriceCents) / 1000) -
    inventoryCostCents;
  const peakEquityCents = Math.max(state.peakEquityCents, equityCents);
  const maxDrawdownBps = Math.max(
    state.maxDrawdownBps,
    Math.round(((peakEquityCents - equityCents) * 10_000) / peakEquityCents)
  );
  return {
    tick,
    referencePriceCents,
    priceHistoryCents: [...state.priceHistoryCents, referencePriceCents],
    bidCents,
    askCents,
    baseMilliSol,
    quoteCents,
    openOrders,
    fills,
    inventoryCostCents,
    realizedPnlCents,
    unrealizedPnlCents,
    liquidityTicks: state.liquidityTicks + 1,
    startingEquityCents: state.startingEquityCents,
    equityCents,
    peakEquityCents,
    maxDrawdownBps,
    activity: activity.slice(-12),
  };
}

export function runSimulation(
  scenario: Scenario,
  strategy: StrategyConfig
): SimulationResult {
  let state = createSimulation(scenario, strategy);
  while (state.tick < scenario.durationTicks)
    state = stepSimulation(state, scenario, strategy);
  return {
    scenario,
    strategy,
    state,
    score: scoreRun(state, strategy, scenario.durationTicks),
  };
}
