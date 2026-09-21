import { createPrng } from "./prng";
export type PricePoint = { priceCents: number; at: number };
type Side = "buy" | "sell";
type Quote = {
  id: number;
  side: Side;
  priceCents: number;
  sizeMilliSol: number;
  at: number;
};
type Trade = Quote & { source: "MARKET" | "LIMIT" };
export type PaperState = {
  priceCents: number;
  startPriceCents: number;
  startEquityCents: number;
  points: PricePoint[];
  solMilli: number;
  usdcCents: number;
  inventoryCostCents: number;
  realizedPnlCents: number;
  quotes: Quote[];
  trades: Trade[];
  error: string;
  nextId: number;
};
export type PaperAction =
  | { type: "tick"; delta?: number; priceCents?: number; at: number }
  | { type: "market"; side: Side; sizeMilliSol: number; at: number }
  | {
      type: "quote";
      side: Side;
      priceCents: number;
      sizeMilliSol: number;
      at: number;
    }
  | { type: "cancel"; id: number };
export function createPaperState(): PaperState {
  const random = createPrng(149);
  let price = 14682;
  const points = Array.from({ length: 150 }, (_, i) => {
    price = Math.max(100, price + Math.round((random() - 0.5) * 20));
    return { priceCents: price, at: (i - 149) * 400 };
  });
  const offset = 14682 - points[149].priceCents;
  points.forEach((p) => (p.priceCents += offset));
  return {
    priceCents: 14682,
    startPriceCents: 14682,
    startEquityCents: 296820,
    points,
    solMilli: 10000,
    usdcCents: 150000,
    inventoryCostCents: 146820,
    realizedPnlCents: 0,
    quotes: [],
    trades: [],
    error: "",
    nextId: 1,
  };
}
function reserves(state: PaperState) {
  return state.quotes.reduce(
    (r, q) => ({
      cash:
        r.cash +
        (q.side === "buy"
          ? Math.round((q.priceCents * q.sizeMilliSol) / 1000)
          : 0),
      sol: r.sol + (q.side === "sell" ? q.sizeMilliSol : 0),
    }),
    { cash: 0, sol: 0 }
  );
}
function execute(
  state: PaperState,
  order: Quote,
  source: Trade["source"]
): PaperState {
  const cost = Math.round((order.priceCents * order.sizeMilliSol) / 1000);
  const reserved = reserves(state);
  if (order.side === "buy" && state.usdcCents - reserved.cash < cost)
    return {
      ...state,
      error:
        "Not enough available simulated USDC. Cancel a quote to release funds.",
    };
  if (
    order.side === "sell" &&
    state.solMilli - reserved.sol < order.sizeMilliSol
  )
    return {
      ...state,
      error:
        "Not enough available simulated SOL. Cancel a quote to release inventory.",
    };
  const soldCost =
    order.side === "sell"
      ? Math.round(
          (state.inventoryCostCents * order.sizeMilliSol) / state.solMilli
        )
      : 0;
  return {
    ...state,
    solMilli:
      state.solMilli +
      (order.side === "buy" ? order.sizeMilliSol : -order.sizeMilliSol),
    usdcCents: state.usdcCents + (order.side === "buy" ? -cost : cost),
    inventoryCostCents:
      state.inventoryCostCents + (order.side === "buy" ? cost : -soldCost),
    realizedPnlCents:
      state.realizedPnlCents + (order.side === "sell" ? cost - soldCost : 0),
    trades: [{ ...order, id: state.nextId, source }, ...state.trades].slice(
      0,
      50
    ),
    nextId: state.nextId + 1,
    error: "",
  };
}
export function paperReducer(
  state: PaperState,
  action: PaperAction
): PaperState {
  if (action.type === "cancel")
    return {
      ...state,
      quotes: state.quotes.filter((q) => q.id !== action.id),
      error: "",
    };
  if (action.type === "tick") {
    const price =
      action.priceCents ??
      Math.max(100, state.priceCents + (action.delta ?? 0));
    if (!Number.isFinite(price) || price <= 0) return state;
    const existing =
      state.points[0].at <= 0
        ? state.points.map((p) => ({ ...p, at: action.at + p.at - 400 }))
        : state.points;
    let next = {
      ...state,
      priceCents: price,
      points: [...existing.slice(-35999), { priceCents: price, at: action.at }],
    };
    for (const quote of state.quotes) {
      if (
        quote.side === "buy"
          ? price <= quote.priceCents
          : price >= quote.priceCents
      ) {
        next = execute(
          { ...next, quotes: next.quotes.filter((q) => q.id !== quote.id) },
          { ...quote, at: action.at },
          "LIMIT"
        );
      }
    }
    return next;
  }
  if (!Number.isInteger(action.sizeMilliSol) || action.sizeMilliSol <= 0)
    return {
      ...state,
      error: "Enter a positive size with up to three decimal places.",
    };
  const price = action.type === "quote" ? action.priceCents : state.priceCents;
  if (
    !Number.isSafeInteger(price) ||
    price <= 0 ||
    !Number.isSafeInteger(price * action.sizeMilliSol)
  )
    return { ...state, error: "Enter a valid positive price and size." };
  const order = {
    id: state.nextId,
    side: action.side,
    priceCents: price,
    sizeMilliSol: action.sizeMilliSol,
    at: action.at,
  };
  if (action.type === "market") return execute(state, order, "MARKET");
  const reserved = reserves(state);
  if (
    order.side === "buy"
      ? state.usdcCents - reserved.cash <
        Math.round((price * order.sizeMilliSol) / 1000)
      : state.solMilli - reserved.sol < order.sizeMilliSol
  )
    return {
      ...state,
      error: "Insufficient unreserved simulated funds for this quote.",
    };
  if (
    order.side === "buy" ? state.priceCents <= price : state.priceCents >= price
  )
    return execute(state, order, "LIMIT");
  return {
    ...state,
    quotes: [...state.quotes, order],
    nextId: state.nextId + 1,
    error: "",
  };
}
