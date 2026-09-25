import { createPrng } from "./prng";

export const PAPER_ASSETS = ["BTC", "ETH", "SOL"] as const;
export type PaperAsset = (typeof PAPER_ASSETS)[number];
export type Side = "buy" | "sell";
export type PricePoint = { priceCents: number; at: number; sequence: number };
export const PAPER_MARKETS: Record<
  PaperAsset,
  { label: string; initialPriceCents: number; icon: string }
> = {
  BTC: { label: "BTC / USDC", initialPriceCents: 6_500_000, icon: "₿" },
  ETH: { label: "ETH / USDC", initialPriceCents: 350_000, icon: "Ξ" },
  SOL: { label: "SOL / USDC", initialPriceCents: 14_682, icon: "S" },
};
type Position = { quantityMilliAsset: number; inventoryCostCents: number };
type Market = {
  priceCents: number;
  startPriceCents: number;
  points: PricePoint[];
};
type Quote = {
  id: number;
  asset: PaperAsset;
  side: Side;
  priceCents: number;
  sizeMilliAsset: number;
  at: number;
};
export type Trade = Quote & { source: "MARKET" | "LIMIT" };
export type PaperState = {
  marketSeed: number;
  activeAsset: PaperAsset;
  markets: Record<PaperAsset, Market>;
  positions: Record<PaperAsset, Position>;
  usdcCents: number;
  startEquityCents: number;
  realizedPnlCents: number;
  quotes: Quote[];
  trades: Trade[];
  error: string;
  nextId: number;
};
export type PaperAction =
  | { type: "reset"; seed: number }
  | { type: "select-asset"; asset: PaperAsset }
  | { type: "load-history"; asset: PaperAsset; points: PricePoint[] }
  | {
      type: "tick";
      asset: PaperAsset;
      delta?: number;
      priceCents?: number;
      at: number;
    }
  | {
      type: "market";
      asset: PaperAsset;
      side: Side;
      sizeMilliAsset: number;
      at: number;
    }
  | {
      type: "quote";
      asset: PaperAsset;
      side: Side;
      priceCents: number;
      sizeMilliAsset: number;
      at: number;
    }
  | { type: "cancel"; id: number };

export function createPaperSessionSeed() {
  const v = new Uint32Array(1);
  globalThis.crypto.getRandomValues(v);
  return v[0];
}
function points(asset: PaperAsset, seed: number) {
  const random = createPrng(seed);
  let price = PAPER_MARKETS[asset].initialPriceCents;
  const items = Array.from({ length: 150 }, (_, i) => {
    price = Math.max(
      100,
      price + Math.round((random() - 0.5) * Math.max(2, price * 0.0015))
    );
    return { priceCents: price, at: (i - 149) * 400, sequence: i };
  });
  const offset =
    PAPER_MARKETS[asset].initialPriceCents - items.at(-1)!.priceCents;
  return items.map((point) => ({
    ...point,
    priceCents: point.priceCents + offset,
  }));
}
export function createPaperState(seed = 149): PaperState {
  const markets = Object.fromEntries(
    PAPER_ASSETS.map((asset, i) => {
      const history = points(asset, seed + i);
      return [
        asset,
        {
          priceCents: history.at(-1)!.priceCents,
          startPriceCents: history.at(-1)!.priceCents,
          points: history,
        },
      ];
    })
  ) as Record<PaperAsset, Market>;
  return {
    marketSeed: seed,
    activeAsset: "SOL",
    markets,
    positions: {
      BTC: { quantityMilliAsset: 0, inventoryCostCents: 0 },
      ETH: { quantityMilliAsset: 0, inventoryCostCents: 0 },
      SOL: { quantityMilliAsset: 0, inventoryCostCents: 0 },
    },
    usdcCents: 1_000_000,
    startEquityCents: 1_000_000,
    realizedPnlCents: 0,
    quotes: [],
    trades: [],
    error: "",
    nextId: 1,
  };
}
export function getPositionValueCents(state: PaperState, asset: PaperAsset) {
  return Math.round(
    (state.positions[asset].quantityMilliAsset *
      state.markets[asset].priceCents) /
      1000
  );
}
export function getPaperEquityCents(state: PaperState) {
  return (
    state.usdcCents +
    PAPER_ASSETS.reduce(
      (sum, asset) => sum + getPositionValueCents(state, asset),
      0
    )
  );
}
function reserves(state: PaperState) {
  return state.quotes.reduce(
    (value, quote) => ({
      cash:
        value.cash +
        (quote.side === "buy"
          ? Math.round((quote.priceCents * quote.sizeMilliAsset) / 1000)
          : 0),
      assets: {
        ...value.assets,
        [quote.asset]:
          value.assets[quote.asset] +
          (quote.side === "sell" ? quote.sizeMilliAsset : 0),
      },
    }),
    {
      cash: 0,
      assets: { BTC: 0, ETH: 0, SOL: 0 } as Record<PaperAsset, number>,
    }
  );
}
function execute(
  state: PaperState,
  order: Quote,
  source: Trade["source"]
): PaperState {
  const cost = Math.round((order.priceCents * order.sizeMilliAsset) / 1000),
    reserved = reserves(state),
    position = state.positions[order.asset];
  if (order.side === "buy" && state.usdcCents - reserved.cash < cost)
    return {
      ...state,
      error:
        "Not enough available simulated USDC. Cancel a quote to release funds.",
    };
  if (
    order.side === "sell" &&
    position.quantityMilliAsset - reserved.assets[order.asset] <
      order.sizeMilliAsset
  )
    return {
      ...state,
      error:
        "Not enough available simulated " +
        order.asset +
        ". Cancel a quote to release inventory.",
    };
  const soldCost =
    order.side === "sell" && position.quantityMilliAsset
      ? Math.round(
          (position.inventoryCostCents * order.sizeMilliAsset) /
            position.quantityMilliAsset
        )
      : 0;
  return {
    ...state,
    usdcCents: state.usdcCents + (order.side === "buy" ? -cost : cost),
    positions: {
      ...state.positions,
      [order.asset]: {
        quantityMilliAsset:
          position.quantityMilliAsset +
          (order.side === "buy" ? order.sizeMilliAsset : -order.sizeMilliAsset),
        inventoryCostCents:
          position.inventoryCostCents +
          (order.side === "buy" ? cost : -soldCost),
      },
    },
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
  if (action.type === "reset") return createPaperState(action.seed);
  if (action.type === "select-asset")
    return { ...state, activeAsset: action.asset, error: "" };
  if (action.type === "cancel")
    return {
      ...state,
      quotes: state.quotes.filter((quote) => quote.id !== action.id),
      error: "",
    };
  if (action.type === "load-history") {
    if (!action.points.length) return state;
    const history = action.points.map((point, sequence) => ({
      ...point,
      sequence,
    }));
    return {
      ...state,
      markets: {
        ...state.markets,
        [action.asset]: {
          priceCents: history.at(-1)!.priceCents,
          startPriceCents: history.at(-1)!.priceCents,
          points: history,
        },
      },
    };
  }
  if (action.type === "tick") {
    const market = state.markets[action.asset],
      priceCents =
        action.priceCents ??
        Math.max(100, market.priceCents + (action.delta ?? 0));
    if (!Number.isSafeInteger(priceCents) || priceCents <= 0) return state;
    const history = [
      ...market.points.slice(-35999),
      {
        priceCents,
        at: action.at,
        sequence: (market.points.at(-1)?.sequence ?? -1) + 1,
      },
    ];
    let next = {
      ...state,
      markets: {
        ...state.markets,
        [action.asset]: { ...market, priceCents, points: history },
      },
    };
    for (const quote of next.quotes.filter(
      (item) => item.asset === action.asset
    ))
      if (
        quote.side === "buy"
          ? priceCents <= quote.priceCents
          : priceCents >= quote.priceCents
      )
        next = execute(
          {
            ...next,
            quotes: next.quotes.filter((item) => item.id !== quote.id),
          },
          { ...quote, at: action.at },
          "LIMIT"
        );
    return next;
  }
  if (!Number.isInteger(action.sizeMilliAsset) || action.sizeMilliAsset <= 0)
    return {
      ...state,
      error: "Enter a positive size with up to three decimal places.",
    };
  const priceCents =
    action.type === "quote"
      ? action.priceCents
      : state.markets[action.asset].priceCents;
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0)
    return { ...state, error: "Enter a valid positive price and size." };
  const order: Quote = {
    id: state.nextId,
    asset: action.asset,
    side: action.side,
    priceCents,
    sizeMilliAsset: action.sizeMilliAsset,
    at: action.at,
  };
  if (action.type === "market") return execute(state, order, "MARKET");
  const reserved = reserves(state),
    position = state.positions[action.asset],
    cost = Math.round((priceCents * action.sizeMilliAsset) / 1000);
  if (
    action.side === "buy"
      ? state.usdcCents - reserved.cash < cost
      : position.quantityMilliAsset - reserved.assets[action.asset] <
        action.sizeMilliAsset
  )
    return {
      ...state,
      error: "Insufficient unreserved simulated funds for this quote.",
    };
  return action.side === "buy"
    ? state.markets[action.asset].priceCents <= priceCents
      ? execute(state, order, "LIMIT")
      : {
          ...state,
          quotes: [...state.quotes, order],
          nextId: state.nextId + 1,
          error: "",
        }
    : state.markets[action.asset].priceCents >= priceCents
      ? execute(state, order, "LIMIT")
      : {
          ...state,
          quotes: [...state.quotes, order],
          nextId: state.nextId + 1,
          error: "",
        };
}
