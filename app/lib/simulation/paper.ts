export const PAPER_ASSETS = [
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "ADA",
  "DOGE",
  "AVAX",
  "LINK",
  "DOT",
  "LTC",
  "BCH",
  "UNI",
  "AAVE",
  "SUI",
  "ATOM",
  "NEAR",
  "ETC",
  "XLM",
  "HBAR",
  "SHIB",
] as const;
export type PaperAsset = (typeof PAPER_ASSETS)[number];
export type Side = "buy" | "sell";
/** The maximum real devnet balance that can be mirrored into practice. */
export const WALLET_PAPER_SOL_CAP_MILLI = 10_000;
export type PricePoint = { priceCents: number; at: number; sequence: number };
export const PAPER_MARKETS: Record<
  PaperAsset,
  { label: string; initialPriceCents: number }
> = {
  BTC: { label: "BTC / USDC", initialPriceCents: 6_500_000 },
  ETH: { label: "ETH / USDC", initialPriceCents: 350_000 },
  SOL: { label: "SOL / USDC", initialPriceCents: 14_682 },
  XRP: { label: "XRP / USDC", initialPriceCents: 250 },
  ADA: { label: "ADA / USDC", initialPriceCents: 70 },
  DOGE: { label: "DOGE / USDC", initialPriceCents: 20 },
  AVAX: { label: "AVAX / USDC", initialPriceCents: 2_500 },
  LINK: { label: "LINK / USDC", initialPriceCents: 1_500 },
  DOT: { label: "DOT / USDC", initialPriceCents: 500 },
  LTC: { label: "LTC / USDC", initialPriceCents: 9_000 },
  BCH: { label: "BCH / USDC", initialPriceCents: 35_000 },
  UNI: { label: "UNI / USDC", initialPriceCents: 700 },
  AAVE: { label: "AAVE / USDC", initialPriceCents: 18_000 },
  SUI: { label: "SUI / USDC", initialPriceCents: 300 },
  ATOM: { label: "ATOM / USDC", initialPriceCents: 500 },
  NEAR: { label: "NEAR / USDC", initialPriceCents: 400 },
  ETC: { label: "ETC / USDC", initialPriceCents: 2_500 },
  XLM: { label: "XLM / USDC", initialPriceCents: 30 },
  HBAR: { label: "HBAR / USDC", initialPriceCents: 20 },
  SHIB: { label: "1K SHIB / USDC", initialPriceCents: 2 },
};
export type Position = {
  quantityMilliAsset: number;
  inventoryCostCents: number;
};
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
/** Balances and recent fills read back from a wallet-owned on-chain paper account. */
export type PaperChainSnapshot = {
  fundingSource: PaperState["fundingSource"];
  usdcCents: number;
  startEquityCents: number;
  realizedPnlCents: number;
  positions: Record<PaperAsset, Position>;
  trades: Trade[];
};
export type PaperState = {
  marketSeed: number;
  fundingSource: "fixed" | "wallet";
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
  | {
      type: "start-wallet-session";
      seed: number;
      solMilliAsset: number;
      solPriceCents: number;
    }
  | { type: "select-asset"; asset: PaperAsset }
  | { type: "load-history"; asset: PaperAsset; points: PricePoint[] }
  /** Drops chart history for every market when the price feed changes. */
  | { type: "restart-feed" }
  | {
      type: "tick";
      asset: PaperAsset;
      delta?: number;
      priceCents?: number;
      at: number;
      /** False when quote fills must be signed on chain instead of applied locally. */
      fillQuotes?: boolean;
    }
  /** Replaces balances and fills with the on-chain account; quotes stay local. */
  | { type: "sync-chain"; snapshot: PaperChainSnapshot }
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
export function createPaperState(seed = 149): PaperState {
  const markets = Object.fromEntries(
    PAPER_ASSETS.map((asset) => {
      const priceCents = PAPER_MARKETS[asset].initialPriceCents;
      return [asset, { priceCents, startPriceCents: priceCents, points: [] }];
    })
  ) as unknown as Record<PaperAsset, Market>;
  return {
    marketSeed: seed,
    fundingSource: "fixed",
    activeAsset: "SOL",
    markets,
    positions: Object.fromEntries(
      PAPER_ASSETS.map((asset) => [
        asset,
        { quantityMilliAsset: 0, inventoryCostCents: 0 },
      ])
    ) as Record<PaperAsset, Position>,
    usdcCents: 1_000_000,
    startEquityCents: 1_000_000,
    realizedPnlCents: 0,
    quotes: [],
    trades: [],
    error: "",
    nextId: 1,
  };
}

/**
 * Starts a read-only wallet-linked practice session. The caller supplies only
 * a rounded virtual SOL amount and a public market reference; this reducer
 * never receives a wallet, signer, RPC client, or private key.
 */
function startWalletSession(
  state: PaperState,
  seed: number,
  solMilliAsset: number,
  solPriceCents: number
): PaperState {
  const virtualSol = Math.min(WALLET_PAPER_SOL_CAP_MILLI, solMilliAsset);
  if (
    !Number.isInteger(virtualSol) ||
    virtualSol <= 0 ||
    !Number.isSafeInteger(solPriceCents) ||
    solPriceCents <= 0
  )
    return state;
  const startingEquityCents = Math.round((virtualSol * solPriceCents) / 1000);
  const fixed = createPaperState(seed);
  return {
    ...fixed,
    fundingSource: "wallet",
    activeAsset: "SOL",
    markets: {
      ...state.markets,
      SOL: {
        ...state.markets.SOL,
        priceCents: solPriceCents,
        startPriceCents: solPriceCents,
      },
    },
    positions: {
      ...fixed.positions,
      SOL: {
        quantityMilliAsset: virtualSol,
        inventoryCostCents: startingEquityCents,
      },
    },
    usdcCents: 0,
    startEquityCents: startingEquityCents,
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
      assets: Object.fromEntries(
        PAPER_ASSETS.map((asset) => [asset, 0])
      ) as Record<PaperAsset, number>,
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
  if (action.type === "start-wallet-session")
    return startWalletSession(
      state,
      action.seed,
      action.solMilliAsset,
      action.solPriceCents
    );
  if (action.type === "select-asset")
    return { ...state, activeAsset: action.asset, error: "" };
  if (action.type === "sync-chain")
    return {
      ...state,
      ...action.snapshot,
      nextId: Math.max(
        state.nextId,
        ...action.snapshot.trades.map((trade) => trade.id + 1)
      ),
      error: "",
    };
  if (action.type === "cancel")
    return {
      ...state,
      quotes: state.quotes.filter((quote) => quote.id !== action.id),
      error: "",
    };
  if (action.type === "restart-feed")
    return {
      ...state,
      markets: Object.fromEntries(
        PAPER_ASSETS.map((asset) => {
          const { priceCents } = state.markets[asset];
          return [
            asset,
            {
              priceCents,
              startPriceCents: priceCents,
              points: [],
            },
          ];
        })
      ) as unknown as Record<PaperAsset, Market>,
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
        [action.asset]: {
          priceCents,
          // A cleared chart re-anchors the change badge on its first price.
          startPriceCents: market.points.length
            ? market.startPriceCents
            : priceCents,
          points: history,
        },
      },
    };
    if (action.fillQuotes === false) return next;
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
