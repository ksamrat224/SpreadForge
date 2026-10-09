"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconHistory,
  IconActivity,
  IconChartLine,
  IconChartAreaLine,
  IconChartCandle,
  IconChartBar,
  IconChartHistogram,
  IconChartDots,
  IconArrowsExchange,
  IconBox,
  IconCurrencyDollar,
  IconTrendingDown,
  IconChevronUp,
  IconChevronDown,
  IconPlayerPause,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  InteractiveMarketChart,
  type ChartBar,
  type PriceView,
} from "./interactive-market-chart";
import { Metric, PanelHeading, money, signedMoney } from "./terminal-ui";
import { ChartViewPicker, type ChartViewOption } from "./chart-view-picker";
import { ThemedSelect } from "./themed-select";
import { AssetLogo } from "./crypto-logos";
import { MarketExplorer } from "./market-explorer";
import { useWallet } from "../lib/wallet/context";
import { useCluster } from "./cluster-context";
import { getMagicBlockConfig } from "../lib/magicblock/config";
import {
  authenticatePrivateEr,
  getPrivateErRpcProxyUrl,
  getPrivateErTransactionRelayUrl,
} from "../lib/magicblock/private-er-auth";
import {
  PaperTradingRuntime,
  sendPaperTransaction,
  type PaperPortfolioRuntimeState,
} from "../lib/magicblock/paper-session";
import { getResultRegistryProgramAddress } from "../lib/results/registry";
import type { IndicatorId } from "../lib/indicators";
import {
  drawdownPercent,
  portfolioHistory,
} from "../lib/simulation/paper-analytics";
import {
  HISTORY_RANGE_LABELS,
  HISTORY_RANGES,
  mergeLiveTick,
  type BookLevel,
  type HistoryCandle,
  type HistoryRange,
} from "../lib/market-history";
import {
  createPaperSessionSeed,
  createPaperState,
  getPaperEquityCents,
  getPositionValueCents,
  PAPER_ASSETS,
  PAPER_MARKETS,
  paperReducer,
  type PaperAsset,
  type PaperState,
  type PricePoint,
} from "../lib/simulation/paper";

type FeedSource = "pyth" | "replay";
type OrderBook = {
  asset: PaperAsset;
  source: string;
  bids: BookLevel[];
  asks: BookLevel[];
  spreads: Array<{ at: number; bps: number }>;
};
type PaperChartView =
  | "line"
  | "area"
  | "candles"
  | "ohlc"
  | "heikin"
  | "depth"
  | "spread"
  | "inventory"
  | "pnl"
  | "drawdown";

const PAPER_CHART_OPTIONS: ChartViewOption<PaperChartView>[] = [
  { value: "line", label: "Line", group: "Price", Icon: IconChartLine },
  { value: "area", label: "Area", group: "Price", Icon: IconChartAreaLine },
  { value: "candles", label: "Candles", group: "Price", Icon: IconChartCandle },
  { value: "ohlc", label: "OHLC bars", group: "Price", Icon: IconChartBar },
  {
    value: "heikin",
    label: "Heikin-Ashi",
    group: "Price",
    Icon: IconChartHistogram,
  },
  {
    value: "depth",
    label: "Order book depth",
    group: "Analytics",
    Icon: IconChartDots,
  },
  {
    value: "spread",
    label: "Bid / ask spread",
    group: "Analytics",
    Icon: IconArrowsExchange,
  },
  { value: "inventory", label: "Inventory", group: "Analytics", Icon: IconBox },
  {
    value: "pnl",
    label: "P&L / equity",
    group: "Analytics",
    Icon: IconCurrencyDollar,
  },
  {
    value: "drawdown",
    label: "Drawdown",
    group: "Analytics",
    Icon: IconTrendingDown,
  },
];
const PRICE_VIEWS = ["line", "area", "candles", "ohlc", "heikin"];
const QUICK_SIZE_MILLI = Object.fromEntries(
  PAPER_ASSETS.map((asset) => [
    asset,
    Math.max(1, Math.round(100_000 / PAPER_MARKETS[asset].initialPriceCents)),
  ])
) as Record<PaperAsset, number>;
const INITIAL_STATUS: Record<FeedSource, string> = {
  replay: "LOADING REPLAY",
  pyth: "CONNECTING",
};

// Event-time clock for handlers; kept out of the component body for the React compiler.
const now = () => Date.now();

function formatInterval(seconds: number) {
  return seconds >= 86_400
    ? `${seconds / 86_400}D`
    : seconds >= 3600
      ? `${seconds / 3600}H`
      : `${seconds / 60}M`;
}

function formatSize(milliAsset: number) {
  return (milliAsset / 1000).toFixed(milliAsset % 1000 ? 3 : 0);
}

// The live feed starts with an empty chart so it contains only market data.
function createInitialDesk() {
  return paperReducer(createPaperState(), { type: "restart-feed" });
}

/**
 * Legacy local-only desk retained while its visuals are migrated to the
 * private-ER runtime. It must never be rendered as a wallet-verified desk.
 */
export function LocalPaperTradingDesk({ active = true }: { active?: boolean }) {
  const [desk, dispatch] = useReducer(
    paperReducer,
    undefined,
    createInitialDesk
  );
  const [source, setSource] = useState<FeedSource>("pyth");
  const [feedStatus, setFeedStatus] = useState(INITIAL_STATUS.pyth);
  const [historicalProvider, setHistoricalProvider] = useState<string | null>(
    null
  );
  const [replayEpoch, setReplayEpoch] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(150);
  const [playbackPaused, setPlaybackPaused] = useState(false);
  const [timeframe, setTimeframe] = useState(15);
  const [range, setRange] = useState<HistoryRange>("1D");
  const [liveRefreshEpoch, setLiveRefreshEpoch] = useState(0);
  const [indicators, setIndicators] = useState<IndicatorId[]>([]);
  // Live exchange order book for the active asset, plus the spread sampled
  // at each poll so the spread view has history.
  const [book, setBook] = useState<OrderBook | null>(null);
  // Exchange OHLCV for the live chart, keyed so a stale fetch never shows
  // under a different asset or range.
  const [liveBars, setLiveBars] = useState<{
    key: string;
    status: "ready" | "failed";
    source?: string;
    intervalSeconds: number;
    candles: HistoryCandle[];
  } | null>(null);
  const [chartView, setChartView] = useState<PaperChartView>("line");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [limit, setLimit] = useState("");
  const [size, setSize] = useState(formatSize(QUICK_SIZE_MILLI.SOL));
  const [confirmReset, setConfirmReset] = useState(false);
  const replay = useRef<PricePoint[]>([]);
  const lastToast = useRef<PaperState["trades"][number] | null>(null);
  const asset = desk.activeAsset;
  const trackedAssetsKey = PAPER_ASSETS.filter(
    (item) =>
      item === asset ||
      desk.positions[item].quantityMilliAsset > 0 ||
      desk.quotes.some((quote) => quote.asset === item)
  ).join(",");
  const liveKey = `${asset}-${range}`;
  const market = desk.markets[asset];
  const position = desk.positions[asset];
  const equity = getPaperEquityCents(desk);
  const pnl = equity - desk.startEquityCents;
  const limitValue = limit || (market.priceCents / 100).toFixed(2);
  const priceCents = Math.round(Number(limitValue) * 100);
  const sizeMilliAsset = Math.round(Number(size) * 1000);
  const hasLiveFeed =
    feedStatus === "PYTH LIVE" || feedStatus === "LIVE FALLBACK";
  const currentQuoteState =
    source !== "pyth"
      ? "available"
      : hasLiveFeed
        ? "available"
        : feedStatus === "CONNECTING"
          ? "loading"
          : "unavailable";
  const tradingPaused =
    (source === "pyth" && !hasLiveFeed) ||
    (source === "replay" && feedStatus !== "HISTORICAL REPLAY");

  // Live prices update every market so the shared portfolio is marked to
  // current prices and quotes on inactive assets can still fill.
  useEffect(() => {
    if (!active || source !== "pyth" || playbackPaused) return;
    let cancelled = false;
    const controller = new AbortController();
    const load = async (item: PaperAsset) => {
      const response = await fetch(`/api/market/${item.toLowerCase()}-usd`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      if (
        !Number.isSafeInteger(data.priceCents) ||
        data.priceCents <= 0 ||
        !Number.isFinite(data.publishedAt) ||
        Date.now() - data.publishedAt > 60_000
      )
        throw new Error("stale");
      return data as {
        priceCents: number;
        publishedAt: number;
        source: string;
      };
    };
    const refresh = async () => {
      const assetsToLoad = trackedAssetsKey.split(",") as PaperAsset[];
      const results = await Promise.allSettled(assetsToLoad.map(load));
      if (cancelled) return;
      results.forEach((result, i) => {
        if (result.status === "fulfilled")
          dispatch({
            type: "tick",
            asset: assetsToLoad[i],
            priceCents: result.value.priceCents,
            at: result.value.publishedAt,
          });
      });
      const current = results[assetsToLoad.indexOf(asset)];
      if (current.status === "fulfilled")
        setLiveBars((bars) =>
          bars?.key === liveKey && bars.status === "ready"
            ? {
                ...bars,
                candles: mergeLiveTick(
                  bars.candles,
                  bars.intervalSeconds,
                  current.value.priceCents,
                  current.value.publishedAt
                ),
              }
            : bars
        );
      setFeedStatus(
        current.status === "rejected"
          ? "FEED UNAVAILABLE"
          : current.value.source === "pyth"
            ? "PYTH LIVE"
            : "LIVE FALLBACK"
      );
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [
    active,
    asset,
    liveKey,
    liveRefreshEpoch,
    playbackPaused,
    source,
    trackedAssetsKey,
  ]);
  useEffect(() => {
    if (!active || source !== "pyth") return;
    let cancelled = false;
    const controller = new AbortController();
    fetch(`/api/market/${asset.toLowerCase()}-usd/history?range=${range}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return (await response.json()) as {
          candles?: HistoryCandle[];
          intervalSeconds?: number;
          source?: string;
        };
      })
      .then((data) => {
        if (cancelled) return;
        const candles = (data.candles ?? []).filter(
          (candle) =>
            Number.isFinite(candle.at) &&
            [
              candle.openCents,
              candle.highCents,
              candle.lowCents,
              candle.priceCents,
            ].every((value) => Number.isSafeInteger(value) && value > 0)
        );
        if (!candles.length || !data.intervalSeconds) throw new Error("empty");
        setLiveBars({
          key: liveKey,
          status: "ready",
          source: data.source,
          intervalSeconds: data.intervalSeconds,
          candles,
        });
      })
      .catch(() => {
        // The chart falls back to the prices polled since the page opened.
        if (!cancelled)
          setLiveBars({
            key: liveKey,
            status: "failed",
            intervalSeconds: 0,
            candles: [],
          });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, asset, liveKey, range, source]);
  useEffect(() => {
    if (!active || source !== "pyth" || playbackPaused) return;
    let cancelled = false;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/market/${asset.toLowerCase()}-usd/book`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!response.ok) throw new Error("unavailable");
        const data = (await response.json()) as {
          source: string;
          at: number;
          bids: BookLevel[];
          asks: BookLevel[];
        };
        const bid = data.bids[0]?.priceCents;
        const ask = data.asks[0]?.priceCents;
        if (cancelled || !bid || !ask) return;
        const bps = ((ask - bid) / ((ask + bid) / 2)) * 10_000;
        setBook((previous) => ({
          asset,
          source: data.source,
          bids: data.bids,
          asks: data.asks,
          spreads: [
            ...(previous?.asset === asset ? previous.spreads : []),
            { at: data.at, bps },
          ].slice(-720),
        }));
      } catch {
        /* keep the last good book; the next poll retries */
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [active, asset, playbackPaused, source]);
  useEffect(() => {
    if (!active || source !== "replay") return;
    let cancelled = false;
    const controller = new AbortController();
    async function loadReplay() {
      try {
        const response = await fetch(
          `/api/market/${asset.toLowerCase()}-usd/history`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!response.ok) throw new Error("unavailable");
        const data = (await response.json()) as {
          candles?: Array<{ at: number; priceCents: number }>;
          source?: string;
        };
        const candles =
          data.candles?.filter(
            (candle) =>
              Number.isFinite(candle.at) &&
              Number.isSafeInteger(candle.priceCents) &&
              candle.priceCents > 0
          ) ?? [];
        const historyLength = 150;
        const remainingLength = 60;
        const starts = candles.length - historyLength - remainingLength;
        if (starts < 1) throw new Error("not enough history");
        const start = historyLength - 1 + (createPaperSessionSeed() % starts);
        if (cancelled) return;
        replay.current = candles
          .slice(start + 1)
          .map((candle, sequence) => ({ ...candle, sequence }));
        dispatch({
          type: "load-history",
          asset,
          points: candles
            .slice(start - historyLength + 1, start + 1)
            .map((candle, sequence) => ({ ...candle, sequence })),
        });
        setHistoricalProvider(data.source ?? "market data");
        setFeedStatus("HISTORICAL REPLAY");
      } catch {
        if (!cancelled) setFeedStatus("REPLAY UNAVAILABLE");
      }
    }
    void loadReplay();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, asset, replayEpoch, source]);
  useEffect(() => {
    if (
      !active ||
      source !== "replay" ||
      playbackPaused ||
      feedStatus !== "HISTORICAL REPLAY"
    )
      return;
    const timer = window.setInterval(() => {
      const next = replay.current.shift();
      if (!next) {
        window.clearInterval(timer);
        setFeedStatus("REPLAY COMPLETE");
        return;
      }
      dispatch({
        type: "tick",
        asset,
        priceCents: next.priceCents,
        at: next.at,
      });
    }, 60000 / playbackSpeed);
    return () => window.clearInterval(timer);
  }, [active, asset, feedStatus, playbackPaused, playbackSpeed, source]);
  useEffect(() => {
    const trade = desk.trades[0];
    if (!trade || trade === lastToast.current) return;
    lastToast.current = trade;
    toast.success(
      `${trade.side === "buy" ? "Bought" : "Sold"} ${trade.sizeMilliAsset / 1000} simulated ${trade.asset} at ${money(trade.priceCents)}`
    );
  }, [desk.trades]);

  function restartFeed(next: FeedSource) {
    replay.current = [];
    dispatch({ type: "restart-feed" });
    setPlaybackPaused(false);
    setFeedStatus(INITIAL_STATUS[next]);
    if (next === "replay") {
      setHistoricalProvider(null);
      setReplayEpoch((epoch) => epoch + 1);
    }
  }
  function changeSource(next: FeedSource) {
    if (next === source) return;
    setSource(next);
    setTimeframe(next === "replay" ? 240 : 15);
    restartFeed(next);
  }
  function changeAsset(next: PaperAsset) {
    if (next === asset) return;
    dispatch({ type: "select-asset", asset: next });
    setLimit("");
    setSize(formatSize(QUICK_SIZE_MILLI[next]));
    // Replay history is per asset, so the old asset's candles must not keep playing.
    if (source === "replay") restartFeed("replay");
    else if (source === "pyth") setFeedStatus(INITIAL_STATUS.pyth);
  }
  function reset() {
    if (!confirmReset) return setConfirmReset(true);
    dispatch({ type: "reset", seed: createPaperSessionSeed() });
    restartFeed(source);
    setConfirmReset(false);
    toast.success(
      "Paper portfolio reset to 10,000 simulated USDC."
    );
  }
  // Orders are stamped on the market's clock, so replayed history and live
  // polls line up with trades when analytics rebuild the portfolio.
  const marketNow = () => market.points.at(-1)?.at ?? now();
  const place = (event: React.FormEvent) => {
    event.preventDefault();
    dispatch({
      type: "quote",
      asset,
      side,
      priceCents,
      sizeMilliAsset,
      at: marketNow(),
    });
  };
  function stepLimit(direction: 1 | -1) {
    setLimit((value) =>
      Math.max(0.01, Number(value || limitValue) + direction * 0.01).toFixed(2)
    );
  }
  function stepSize(direction: 1 | -1) {
    setSize((value) =>
      Math.max(0.001, Number(value || 0) + direction * 0.001).toFixed(3)
    );
  }

  const quickSizeMilliAsset = QUICK_SIZE_MILLI[asset];
  const quickSizeLabel = formatSize(quickSizeMilliAsset);
  const distance = Number.isFinite(priceCents)
    ? (priceCents / market.priceCents - 1) * 100
    : 0;
  const notional = Number.isFinite(priceCents * sizeMilliAsset)
    ? (priceCents * sizeMilliAsset) / 1000
    : 0;
  const rangeBars =
    source === "pyth" && liveBars?.key === liveKey ? liveBars : null;
  // Loading shows an empty chart; a failed fetch falls back to polled prices.
  const chartBars =
    rangeBars?.status === "failed"
      ? undefined
      : source === "pyth"
        ? (rangeBars?.candles ?? []).map((candle) => ({
            time: Math.floor(candle.at / 1000),
            open: candle.openCents / 100,
            high: candle.highCents / 100,
            low: candle.lowCents / 100,
            close: candle.priceCents / 100,
            volume: candle.volume,
          }))
        : undefined;
  // Live mode reports change over the selected range, like public price pages.
  const changeBaseCents =
    rangeBars?.status === "ready"
      ? rangeBars.candles[0].openCents
      : market.startPriceCents;
  const change = (market.priceCents / changeBaseCents - 1) * 100;
  const cutoff = (market.points.at(-1)?.at ?? 0) - timeframe * 60000;
  const points =
    source === "pyth"
      ? market.points
      : market.points.filter((point) => point.at >= cutoff);
  const replayRange =
    source === "replay" && market.points.length
      ? `${new Date(market.points[0].at).toLocaleString()} — ${new Date(market.points.at(-1)!.at).toLocaleString()}`
      : null;
  const feedLabel =
    source === "replay"
      ? `HISTORICAL REPLAY · ${(historicalProvider ?? "LOADING").toUpperCase()}`
      : feedStatus === "PYTH LIVE"
        ? "PYTH REFERENCE"
        : feedStatus === "LIVE FALLBACK"
          ? "EXCHANGE FALLBACK REFERENCE"
          : feedStatus === "CONNECTING"
            ? "WAITING FOR LIVE QUOTE"
            : "CURRENT QUOTE UNAVAILABLE · HISTORICAL DATA ONLY";
  const playbackControls = (
    <div className="replay-playback-actions">
      <button
        type="button"
        aria-label={
          playbackPaused ? "Resume market display" : "Pause market display"
        }
        title={playbackPaused ? "Resume" : "Pause"}
        disabled={
          feedStatus === "REPLAY COMPLETE" || feedStatus === "LOADING REPLAY"
        }
        onClick={() => setPlaybackPaused((paused) => !paused)}
      >
        {playbackPaused ? (
          <IconPlayerPlay size={14} />
        ) : (
          <IconPlayerPause size={14} />
        )}
      </button>
      {source !== "pyth" && (
        <ThemedSelect
          className="replay-speed-select"
          label="Market playback speed"
          value={playbackSpeed}
          onChange={setPlaybackSpeed}
          options={[1, 5, 15, 60, 150].map((speed) => ({
            value: speed,
            label: `${speed}×`,
            icon: <IconPlayerPlay size={14} />,
          }))}
        />
      )}
    </div>
  );

  return (
    <section className="page-shell" aria-label="Paper Trading">
      <div className="workspace-top">
        <span>
          <strong>Your edge starts with practice.</strong> · Every trade here is
          simulated.
        </span>
        <span className="mono">MANUAL EXECUTION / UNRANKED</span>
      </div>

      <div className="paper-portfolio panel">
        <Metric
          label={`${asset} BALANCE`}
          value={`${(position.quantityMilliAsset / 1000).toFixed(3)} ${asset}`}
          detail={`${money(getPositionValueCents(desk, asset))} notional`}
        />
        <Metric
          label="USDC BALANCE"
          value={money(desk.usdcCents)}
          detail="Simulated buying power"
        />
        <Metric
          label="PORTFOLIO VALUE"
          value={money(equity)}
          detail="Cash + BTC + ETH + SOL"
        />
        <Metric
          label="TOTAL P&L"
          value={signedMoney(pnl)}
          detail={`Realized ${signedMoney(desk.realizedPnlCents)} · Unrealized ${signedMoney(pnl - desk.realizedPnlCents)}`}
          tone={pnl >= 0 ? "profit" : "loss"}
        />
      </div>
      {desk.error && (
        <div role="alert" className="notice">
          {desk.error}
        </div>
      )}
      {feedStatus === "FEED UNAVAILABLE" && (
        <div role="status" className="notice">
          <span>
            Live {asset} reference unavailable or stale. Historical candles may
            still be visible, but the current quote is hidden and trading is
            paused.
          </span>
          <button
            className="btn ghost notice-action"
            type="button"
            onClick={() => setLiveRefreshEpoch((epoch) => epoch + 1)}
          >
            Retry live quote
          </button>
        </div>
      )}
      {feedStatus === "REPLAY UNAVAILABLE" && (
        <div role="status" className="notice">
          Historical {asset}/USD data is temporarily unavailable. Try the replay
          again shortly or return to the live market feed.
        </div>
      )}
      <div className="paper-grid">
        <section className="panel">
          <div className="market-header">
            <div>
              <div className="market-pair">
                <span className="pair-icon">
                  <AssetLogo asset={asset} size={22} />
                </span>
                <div>
                  <h2>{asset} / USD</h2>
                  <small>{feedLabel} · PAPER MARKET</small>
                </div>
              </div>
              <div className={`price-readout ${currentQuoteState}`}>
                {currentQuoteState === "available" ? (
                  <>
                    <strong>{money(market.priceCents, 3)}</strong>
                    <span
                      className={`change-badge ${change < 0 ? "loss" : ""}`}
                    >
                      {change >= 0 ? "+" : ""}
                      {change.toFixed(2)}%
                    </span>
                  </>
                ) : (
                  <>
                    <strong>
                      {currentQuoteState === "loading"
                        ? "LOADING LIVE QUOTE"
                        : "LIVE QUOTE UNAVAILABLE"}
                    </strong>
                    <span className="change-badge neutral">
                      {rangeBars?.status === "ready"
                        ? "HISTORICAL CHART ONLY"
                        : "TRADING PAUSED"}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="market-header-controls">
              <MarketExplorer
                activeAsset={asset}
                onSelectMarket={changeAsset}
              />
              <ThemedSelect
                className="cluster-select"
                label="Price feed"
                value={source}
                options={[
                  {
                    value: "replay",
                    label: "Historical replay",
                    icon: <IconHistory size={14} />,
                  },
                  {
                    value: "pyth",
                    label: "Live Pyth",
                    icon: <IconActivity size={14} />,
                  },
                ]}
                onChange={changeSource}
              />
            </div>
          </div>
          {source === "pyth" ? (
            <div className="timeframes" aria-label="Chart range">
              {HISTORY_RANGE_LABELS.map((value) => (
                <button
                  key={value}
                  className={range === value ? "active" : ""}
                  aria-pressed={range === value}
                  onClick={() => setRange(value)}
                >
                  {HISTORY_RANGES[value].label}
                </button>
              ))}
              <span className="control-hint" style={{ marginLeft: "auto" }}>
                {rangeBars?.status === "ready"
                  ? currentQuoteState === "available"
                    ? `${formatInterval(rangeBars.intervalSeconds)} candles · ${(rangeBars.source ?? "exchange").toUpperCase()} OHLCV + live ${feedStatus === "PYTH LIVE" ? "Pyth" : "exchange"} price`
                    : `${formatInterval(rangeBars.intervalSeconds)} candles · ${(rangeBars.source ?? "exchange").toUpperCase()} OHLCV · current quote unavailable`
                  : rangeBars?.status === "failed"
                    ? currentQuoteState === "available"
                      ? "Range history unavailable · showing live polled prices"
                      : "Range history and current quote unavailable"
                    : "Loading range history…"}
              </span>
            </div>
          ) : (
            <div className="timeframes" aria-label="Chart timeframe">
              {[
                [1, "1M"],
                [5, "5M"],
                [15, "15M"],
                [60, "1H"],
                [240, "4H"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={timeframe === value ? "active" : ""}
                  aria-pressed={timeframe === value}
                  onClick={() => setTimeframe(Number(value))}
                >
                  {label}
                </button>
              ))}
              <span className="control-hint" style={{ marginLeft: "auto" }}>
                {replayRange
                  ? `Replay: ${replayRange}`
                  : "Available session data"}
              </span>
            </div>
          )}
          <PaperChartSwitcher
            // Remount per asset/feed so the chart never carries bars across modes.
            key={`${asset}-${source}-${source === "pyth" ? range : ""}`}
            view={chartView}
            onViewChange={setChartView}
            points={points}
            bars={chartBars}
            desk={desk}
            intervals={source === "replay" ? [300, 900, 1800, 3600] : undefined}
            indicators={indicators}
            onIndicatorsChange={setIndicators}
            book={source === "pyth" && book?.asset === asset ? book : null}
            readoutActions={playbackControls}
          />
          <div className="quick-trade">
            <button
              className="btn buy"
              disabled={tradingPaused}
              onClick={() =>
                dispatch({
                  type: "market",
                  asset,
                  side: "buy",
                  sizeMilliAsset: quickSizeMilliAsset,
                  at: marketNow(),
                })
              }
            >
              <IconArrowUpRight size={17} />
              Buy {quickSizeLabel} {asset}{" "}
              <span className="mono">{money(market.priceCents)}</span>
            </button>
            <button
              className="btn sell"
              disabled={tradingPaused}
              onClick={() =>
                dispatch({
                  type: "market",
                  asset,
                  side: "sell",
                  sizeMilliAsset: quickSizeMilliAsset,
                  at: marketNow(),
                })
              }
            >
              <IconArrowDownRight size={17} />
              Sell {quickSizeLabel} {asset}{" "}
              <span className="mono">{money(market.priceCents)}</span>
            </button>
          </div>
        </section>
        <section className="panel">
          <PanelHeading eyebrow="ORDER ENTRY" title="Limit Quote">
            <IconActivity size={17} />
          </PanelHeading>
          <form className="quote-form" onSubmit={place}>
            <div className="segmented">
              <button
                type="button"
                className={side === "buy" ? "active" : ""}
                aria-pressed={side === "buy"}
                onClick={() => setSide("buy")}
              >
                BUY
              </button>
              <button
                type="button"
                className={`sell ${side === "sell" ? "active" : ""}`}
                aria-pressed={side === "sell"}
                onClick={() => setSide("sell")}
              >
                SELL
              </button>
            </div>
            <label className="field">
              <span className="field-label">
                Limit price <span className="field-unit">USDC</span>
              </span>
              <div className="input-unit">
                <input
                  aria-label="Limit price"
                  type="number"
                  min=".01"
                  step=".01"
                  required
                  value={limitValue}
                  onChange={(event) => setLimit(event.target.value)}
                />
                <div className="number-stepper" aria-label="Adjust limit price">
                  <button
                    type="button"
                    aria-label="Increase limit price"
                    onClick={() => stepLimit(1)}
                  >
                    <IconChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label="Decrease limit price"
                    onClick={() => stepLimit(-1)}
                  >
                    <IconChevronDown size={13} />
                  </button>
                </div>
              </div>
            </label>
            <label className="field">
              <span className="field-label">
                Size <span className="field-unit">{asset}</span>
              </span>
              <div className="input-unit">
                <input
                  aria-label="Size"
                  type="number"
                  min=".001"
                  step=".001"
                  required
                  value={size}
                  onChange={(event) => setSize(event.target.value)}
                />
                <div className="number-stepper" aria-label="Adjust size">
                  <button
                    type="button"
                    aria-label="Increase size"
                    onClick={() => stepSize(1)}
                  >
                    <IconChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label="Decrease size"
                    onClick={() => stepSize(-1)}
                  >
                    <IconChevronDown size={13} />
                  </button>
                </div>
              </div>
            </label>
            <div className="quote-estimates">
              <div>
                <span>Distance to market</span>
                <b>
                  {distance >= 0 ? "+" : ""}
                  {distance.toFixed(2)}%
                </b>
              </div>
              <div>
                <span>Estimated notional</span>
                <b>{money(notional)}</b>
              </div>
            </div>
            <button
              className={`btn wide ${side === "buy" ? "buy" : "sell"}`}
              disabled={tradingPaused}
              type="submit"
            >
              Place {side} {asset} quote
            </button>
            <p className="control-hint" style={{ marginTop: 14 }}>
              Simulated execution only. Open quotes reserve USDC or {asset}{" "}
              until filled or cancelled.
            </p>
            <button
              type="button"
              className="btn ghost wide"
              style={{ marginTop: 14 }}
              onClick={reset}
            >
              {confirmReset ? "Confirm reset portfolio" : "Reset portfolio"}
            </button>
          </form>
        </section>
      </div>
      <div className="table-grid">
        <section className="panel">
          <PanelHeading title="Open quotes">
            <span className="tag">{desk.quotes.length} ACTIVE</span>
          </PanelHeading>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Side</th>
                  <th>Price</th>
                  <th>Size</th>
                  <th>Distance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {desk.quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>{quote.asset}/USDC</td>
                    <td>
                      <span
                        className={`tag ${quote.side === "buy" ? "profit" : "loss"}`}
                      >
                        {quote.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="mono">{money(quote.priceCents)}</td>
                    <td className="mono">
                      {quote.sizeMilliAsset / 1000} {quote.asset}
                    </td>
                    <td className="mono">
                      {(
                        (quote.priceCents /
                          desk.markets[quote.asset].priceCents -
                          1) *
                        100
                      ).toFixed(2)}
                      %
                    </td>
                    <td>
                      <button
                        className="table-cancel"
                        onClick={() =>
                          dispatch({ type: "cancel", id: quote.id })
                        }
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!desk.quotes.length && (
            <div className="empty-state">
              <IconActivity size={24} />
              No open quotes. Set your price and let the market come to you.
            </div>
          )}
        </section>
        <section className="panel">
          <PanelHeading title="Recent fills">
            <IconHistory size={16} />
          </PanelHeading>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Type / Side</th>
                  <th>Price</th>
                  <th>Size</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {desk.trades.map((trade) => (
                  <tr key={trade.id}>
                    <td>{trade.asset}/USDC</td>
                    <td>
                      <span className="tag">{trade.source}</span>{" "}
                      <span
                        className={trade.side === "buy" ? "profit" : "loss"}
                      >
                        {trade.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="mono">{money(trade.priceCents)}</td>
                    <td className="mono">
                      {trade.sizeMilliAsset / 1000} {trade.asset}
                    </td>
                    <td className="mono muted">
                      {new Date(trade.at).toLocaleTimeString("en-GB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!desk.trades.length && (
            <div className="empty-state">
              <IconHistory size={24} />
              Your first trade starts the story. Buy or sell to begin.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

/**
 * Paper trading deliberately fails closed until the deployed program, routed
 * Private ER runtime, and oracle-backed matching implementation are available.
 * Rendering the old reducer here would make local, refreshable state look like
 * an on-chain portfolio.
 */
export function PaperTradingDesk({ active = true }: { active?: boolean }) {
  const { wallet, signer } = useWallet();
  const { cluster, setCluster } = useCluster();
  // Environment configuration is immutable during a browser session. Keeping
  // this reference stable prevents routed-account loading from restarting on
  // every state update.
  const magicBlock = useMemo(() => getMagicBlockConfig(), []);
  const programAddress = getResultRegistryProgramAddress();
  const runtime = useRef<PaperTradingRuntime | null>(null);
  const initialLoadKey = useRef<string | null>(null);
  const [portfolioState, setPortfolioState] = useState<PaperPortfolioRuntimeState | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const authenticate = useCallback(async () => {
    if (!wallet) throw new Error("Connect a wallet before authorizing Private ER access.");
    await authenticatePrivateEr(wallet);
  }, [wallet]);

  const loadPortfolio = useCallback(async () => {
    // The deployed registry and configured MagicBlock base RPC are devnet
    // only. Do not let a wallet preview a devnet transaction as mainnet,
    // testnet, or localhost: wallets can surface that as "insufficient SOL".
    if (cluster !== "devnet") {
      runtime.current = null;
      setPortfolioState(null);
      setRuntimeError(null);
      return;
    }
    if (!signer || !programAddress) return;
    const nextRuntime = new PaperTradingRuntime(
      signer,
      programAddress,
      async ({ instructions, computeUnits }) => {
        const result = await sendPaperTransaction({
          url: magicBlock.baseRpcUrl,
          payer: signer,
          instructions,
          computeUnits,
        });
        return result.context.signature;
      },
      magicBlock,
      magicBlock.privateErAuthEnabled ? getPrivateErRpcProxyUrl() : null,
      magicBlock.privateErAuthEnabled ? authenticate : null,
      magicBlock.privateErAuthEnabled ? getPrivateErTransactionRelayUrl() : null
    );
    runtime.current = nextRuntime;
    try {
      setRuntimeError(null);
      setPortfolioState(await nextRuntime.load());
    } catch (error) {
      setPortfolioState(null);
      setRuntimeError(error instanceof Error ? error.message : "Could not load the private portfolio runtime.");
    }
  }, [authenticate, cluster, magicBlock, programAddress, signer]);

  const portfolioLoadKey = `${active}:${cluster}:${signer?.address ?? ""}:${programAddress ?? ""}`;
  useEffect(() => {
    if (!active) {
      initialLoadKey.current = null;
      return;
    }
    // Rendering an error/loading state must not recreate the runtime and start
    // another thirty-request ER polling loop. A wallet, cluster, or tab change
    // produces a new key; explicit retries remain available through the UI.
    if (initialLoadKey.current === portfolioLoadKey) return;
    initialLoadKey.current = portfolioLoadKey;
    const timer = window.setTimeout(() => { void loadPortfolio(); }, 0);
    return () => window.clearTimeout(timer);
  }, [active, loadPortfolio, portfolioLoadKey]);

  const createPortfolio = useCallback(async () => {
    if (!runtime.current) return;
    setIsWorking(true);
    try {
      setRuntimeError(null);
      setPortfolioState(await runtime.current.createPortfolio());
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "Portfolio creation failed.");
    } finally { setIsWorking(false); }
  }, []);

  const renewAuthorization = useCallback(async () => {
    if (!runtime.current) return;
    setIsWorking(true);
    try {
      setRuntimeError(null);
      setPortfolioState(await runtime.current.renewAuthorization());
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "Authorization renewal failed.");
    } finally { setIsWorking(false); }
  }, []);

  const authorizePrivateAccess = useCallback(async () => {
    setIsWorking(true);
    try {
      setRuntimeError(null);
      await authenticate();
      await loadPortfolio();
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "Private ER authorization failed.");
    } finally { setIsWorking(false); }
  }, [authenticate, loadPortfolio]);

  const recoverPrivateRouting = useCallback(async () => {
    if (!runtime.current) return;
    setIsWorking(true);
    try {
      setRuntimeError(null);
      setPortfolioState(await runtime.current.recoverPrivateRouting());
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "Private routing recovery failed.");
    } finally { setIsWorking(false); }
  }, []);

  if (!active) return null;
  const isDevnet = cluster === "devnet";
  const canConfigure = Boolean(isDevnet && wallet && signer && wallet.signMessage && programAddress && magicBlock.enabled && magicBlock.privateErUrl && magicBlock.privateErValidator && magicBlock.privateErAuthEnabled);
  const isReady = portfolioState?.kind === "ready";
  const isReadOnly = portfolioState?.kind === "read-only";
  const routingRequired = portfolioState?.kind === "routing-required";
  const privateAccessRequired = portfolioState?.kind === "private-access-required";
  return (
    <section className="page-shell" aria-label="Paper Trading">
      <div className="workspace-top">
        <span>
          <strong>Private paper portfolio.</strong> · Balances and fills are read from the routed ER.
        </span>
        <span className="mono">ON-CHAIN EXECUTION REQUIRED</span>
      </div>
      <section className="panel empty-state" style={{ padding: 42 }}>
        <p className="eyebrow">PAPER PORTFOLIO</p>
        <h1>{isReady ? "Portfolio ready" : isReadOnly ? "Renew trading authorization" : privateAccessRequired ? "Private ER access required" : routingRequired ? "Private routing required" : "Create your paper portfolio"}</h1>
        <p>
          Each wallet has one persistent 10,000 virtual-USDC portfolio. There
          are no real-token transfers; the only devnet SOL used is the disclosed
          session-key fee allowance for Private ER transaction fees.
        </p>
        <div className="control-hint" style={{ marginTop: 16 }}>
          {!wallet
            ? "Connect a devnet wallet to create or view your portfolio."
            : !isDevnet
              ? "Paper portfolios are deployed on devnet. Switch this app to devnet so your wallet previews and signs the same cluster that receives the transaction."
            : !programAddress
              ? "The result registry program has not been configured for devnet yet."
              : !magicBlock.enabled
                ? "Private MagicBlock execution is not enabled for this deployment."
                : !magicBlock.privateErUrl
                  ? "Add the MagicBlock-provisioned Private ER endpoint and validator public key before enabling wallet setup."
                : !magicBlock.privateErValidator
                  ? "Add the MagicBlock-provisioned Private ER validator public key before enabling wallet setup."
                  : !magicBlock.privateErAuthEnabled
                    ? "Configure the server-side Private ER challenge/login proxy before enabling wallet setup."
                    : !wallet.signMessage
                      ? "This wallet must support message signing to authenticate Private ER access."
                  : runtimeError
                    ? runtimeError
                    : isReady
                      ? "BTC/USD is awaiting its registry transaction. Trading remains locked until its Pyth oracle configuration is committed and verified."
                      : isReadOnly
                        ? "Your portfolio is private and persistent. Its memory-only signer is unavailable after reload, so trading is read-only until renewed."
                        : privateAccessRequired
                          ? "The portfolio is correctly routed to the Private ER, but its TEE rejected the configured credential for generic Solana RPC. Retrying can refresh an expired grant; otherwise MagicBlock must provision a generic Private-ER RPC credential or authenticated proxy for this application. Trading stays locked—there is no browser or public-ER fallback."
                        : routingRequired
                          ? portfolioState.reason
                        : "Create your portfolio with one wallet approval. The wallet will initialize, fund the temporary fee signer, and delegate the portfolio."}
        </div>
        {!isDevnet && (
          <button className="btn primary" type="button" onClick={() => setCluster("devnet")} style={{ marginTop: 20 }}>
            Switch to devnet
          </button>
        )}
        {canConfigure && portfolioState?.kind === "missing" && (
          <button className="btn primary" type="button" disabled={isWorking} onClick={() => void createPortfolio()} style={{ marginTop: 20 }}>
            {isWorking ? "Creating portfolio…" : "Create portfolio"}
          </button>
        )}
        {canConfigure && isReadOnly && (
          <button className="btn primary" type="button" disabled={isWorking} onClick={() => void renewAuthorization()} style={{ marginTop: 20 }}>
            {isWorking ? "Renewing authorization…" : "Renew authorization"}
          </button>
        )}
        {canConfigure && privateAccessRequired && (
          <button className="btn primary" type="button" disabled={isWorking} onClick={() => void authorizePrivateAccess()} style={{ marginTop: 20 }}>
            {isWorking ? "Authorizing Private ER…" : "Authorize Private ER"}
          </button>
        )}
        {canConfigure && routingRequired && portfolioState.erEndpoint && (
          <button className="btn primary" type="button" disabled={isWorking} onClick={() => void recoverPrivateRouting()} style={{ marginTop: 20 }}>
            {isWorking ? "Recovering private routing…" : "Recover private routing"}
          </button>
        )}
        {canConfigure && runtimeError && !portfolioState && (
          <button className="btn primary" type="button" disabled={isWorking} onClick={() => void loadPortfolio()} style={{ marginTop: 20 }}>
            {isWorking ? "Loading portfolio…" : "Retry private ER read"}
          </button>
        )}
        {isReady && (
          <div className="metric-grid" style={{ marginTop: 20 }}>
            <Metric label="Virtual USDC" value={money(Number(portfolioState.portfolio.availableUsdcCents))} />
            <Metric label="Total equity" value={money(Number(portfolioState.portfolio.aggregateEquityCents))} />
            <Metric label="Authorization" value="Active" />
          </div>
        )}
        <p className="control-hint" style={{ marginTop: 12 }}>
          Setup uses one wallet approval. Renewal may request a capped devnet-SOL fee top-up plus its authorization update; individual simulated trades never prompt the wallet. A browser reducer or local storage is never used for portfolio state.
        </p>
      </section>
    </section>
  );
}

function PaperChartSwitcher({
  view,
  onViewChange,
  points,
  desk,
  bars,
  intervals,
  indicators,
  onIndicatorsChange,
  book,
  readoutActions,
}: {
  view: PaperChartView;
  onViewChange: (view: PaperChartView) => void;
  points: PricePoint[];
  bars?: ChartBar[];
  indicators: IndicatorId[];
  onIndicatorsChange: (indicators: IndicatorId[]) => void;
  book: OrderBook | null;
  desk: PaperState;
  intervals?: number[];
  readoutActions?: ReactNode;
}) {
  const asset = desk.activeAsset;
  const option = PAPER_CHART_OPTIONS.find((item) => item.value === view)!;
  const chartPicker = (
    <ChartViewPicker
      view={view}
      options={PAPER_CHART_OPTIONS}
      onViewChange={onViewChange}
      eyebrow="Paper market visualizer"
      label="Paper trading chart view"
    />
  );
  return (
    <>
      {option.group === "Price" ? (
        <InteractiveMarketChart
          view={view as PriceView}
          samples={points.map((point) => ({
            time: Math.floor(point.at / 1000),
            value: point.priceCents / 100,
          }))}
          label={`Paper ${asset} ${option.label} price chart`}
          bars={bars}
          variant="market"
          indicators={indicators}
          onIndicatorsChange={onIndicatorsChange}
          intervals={intervals}
          toolbarStart={chartPicker}
          readoutActions={readoutActions}
        />
      ) : (
        <>
          <div className="market-chart-toolbar analytics-toolbar">
            {chartPicker}
          </div>
          <PaperChart view={view} points={points} desk={desk} book={book} />
        </>
      )}
      <div className="chart-legend">
        {view === "depth" ? (
          <>
            <span className="profit">
              <i className="legend-dot" /> Bids
            </span>
            <span className="loss">
              <i className="legend-dot" /> Asks
            </span>
            <span>
              {book
                ? `Live ${book.source} order book · top ${book.bids.length} levels · dashed lines are your open quotes`
                : "Order book depth is only available on the live feed"}
            </span>
          </>
        ) : PRICE_VIEWS.includes(view) ? (
          <span className="primary">
            <i className="legend-dot" /> {asset} / USD reference
          </span>
        ) : view === "spread" ? (
          <span>
            {book
              ? `Best bid / ask spread on ${book.source}, sampled every 5s`
              : "The spread is only available on the live feed"}
          </span>
        ) : (
          <span>
            Rebuilt from your paper trades and this session&apos;s prices
          </span>
        )}
      </div>
    </>
  );
}

function PaperChart({
  view,
  points,
  desk,
  book,
}: {
  view: PaperChartView;
  points: PricePoint[];
  desk: PaperState;
  book: OrderBook | null;
}) {
  const asset = desk.activeAsset;
  if (view === "depth" || view === "spread") {
    if (!book)
      return (
        <div className="empty-state paper-chart">
          <IconChartDots size={24} />
          Real order book data comes from the live exchange feed. Switch the
          price feed to Live Pyth to see {asset}{" "}
          {view === "depth" ? "depth" : "spread"}.
        </div>
      );
    if (view === "depth")
      return <OrderBookDepth book={book} quotes={desk.quotes} asset={asset} />;
    return (
      <InteractiveMarketChart
        samples={book.spreads.map((sample) => ({
          time: Math.floor(sample.at / 1000),
          value: sample.bps,
        }))}
        label={`${asset} bid / ask spread (basis points)`}
        unit="bps"
        stepped
      />
    );
  }
  const step = Math.max(1, Math.floor(points.length / 500));
  const sampled = points.filter(
    (_, i) => i % step === 0 || i === points.length - 1
  );
  const history = portfolioHistory(desk, asset, sampled);
  const values =
    view === "inventory"
      ? history.map((point) => point.inventoryMilliAsset / 1000)
      : view === "pnl"
        ? history.map(
            (point) => (point.equityCents - desk.startEquityCents) / 100
          )
        : drawdownPercent(history.map((point) => point.equityCents));
  const labels: Record<string, string> = {
    inventory: `Paper inventory (${asset})`,
    pnl: "Paper P&L chart",
    drawdown: "Paper drawdown chart",
  };
  return (
    <InteractiveMarketChart
      samples={history.map((point, i) => ({
        time: Math.floor(point.at / 1000),
        value: values[i],
      }))}
      label={labels[view]}
      unit={view === "inventory" ? asset : view === "drawdown" ? "%" : "$"}
      stepped={view === "inventory"}
    />
  );
}

/** Cumulative depth of the live book, clipped symmetrically around the mid. */
function OrderBookDepth({
  book,
  quotes,
  asset,
}: {
  book: OrderBook;
  quotes: PaperState["quotes"];
  asset: PaperAsset;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const bestBid = book.bids[0].priceCents;
  const bestAsk = book.asks[0].priceCents;
  const mid = (bestBid + bestAsk) / 2;
  const half = Math.max(
    1,
    Math.min(
      mid - book.bids.at(-1)!.priceCents,
      book.asks.at(-1)!.priceCents - mid
    )
  );
  const low = mid - half;
  const high = mid + half;
  const bids = book.bids.filter((level) => level.priceCents >= low);
  const asks = book.asks.filter((level) => level.priceCents <= high);
  const bidDepth = cumulative(bids);
  const askDepth = cumulative(asks);
  const maxDepth = Math.max(
    bidDepth.at(-1)?.total ?? 0,
    askDepth.at(-1)?.total ?? 0,
    1e-9
  );
  const x = (priceCents: number) =>
    ((priceCents - low) / (high - low)) * BOOK_WIDTH;
  const y = (total: number) =>
    BOOK_HEIGHT - (total / maxDepth) * (BOOK_HEIGHT - 12);
  const area = (depth: typeof bidDepth, edge: number) => {
    let path = `M${x(depth[0]?.priceCents ?? mid)},${BOOK_HEIGHT}`;
    let previous = 0;
    for (const level of depth) {
      path += ` L${x(level.priceCents)},${y(previous)} L${x(level.priceCents)},${y(level.total)}`;
      previous = level.total;
    }
    return `${path} L${x(edge)},${y(previous)} L${x(edge)},${BOOK_HEIGHT} Z`;
  };
  const hoverPrice =
    hover === null ? null : low + (hover / BOOK_WIDTH) * (high - low);
  const hoverDepth =
    hoverPrice === null
      ? 0
      : (hoverPrice <= mid
          ? bids.filter((level) => level.priceCents >= hoverPrice)
          : asks.filter((level) => level.priceCents <= hoverPrice)
        ).reduce((total, level) => total + level.size, 0);
  const spread = bestAsk - bestBid;
  const visibleQuotes = quotes.filter(
    (quote) =>
      quote.asset === asset &&
      quote.priceCents >= low &&
      quote.priceCents <= high
  );
  return (
    <div className="order-book-depth">
      <div className="market-chart-readout" aria-label="Chart values">
        <span>
          {hoverPrice === null
            ? `Bid ${money(bestBid)}  Ask ${money(bestAsk)}  Spread ${money(spread)} (${((spread / mid) * 10_000).toFixed(2)} bps)`
            : `${money(Math.round(hoverPrice))}  ${hoverPrice <= mid ? "Bids" : "Asks"} ${hoverDepth.toFixed(3)} ${asset} cumulative`}
        </span>
      </div>
      <div
        className="order-book-plot"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setHover(((event.clientX - rect.left) / rect.width) * BOOK_WIDTH);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${BOOK_WIDTH} ${BOOK_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${asset} live order book depth chart`}
        >
          <path d={area(bidDepth, low)} className="depth-bid book-area" />
          <path d={area(askDepth, high)} className="depth-ask book-area" />
          <line
            x1={x(mid)}
            x2={x(mid)}
            y1={0}
            y2={BOOK_HEIGHT}
            className="chart-baseline"
            vectorEffect="non-scaling-stroke"
          />
          {visibleQuotes.map((quote) => (
            <line
              key={quote.id}
              x1={x(quote.priceCents)}
              x2={x(quote.priceCents)}
              y1={0}
              y2={BOOK_HEIGHT}
              className={`book-quote ${quote.side}`}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {hover !== null && (
            <line
              x1={hover}
              x2={hover}
              y1={0}
              y2={BOOK_HEIGHT}
              className="book-crosshair"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <span className="book-max">
          {maxDepth.toFixed(maxDepth < 10 ? 3 : 1)} {asset}
        </span>
      </div>
      <div className="time-axis">
        <span>{money(Math.round(low))}</span>
        <span>MID {money(Math.round(mid))}</span>
        <span>{money(Math.round(high))}</span>
      </div>
    </div>
  );
}

const BOOK_WIDTH = 1000;
const BOOK_HEIGHT = 300;

function cumulative(levels: BookLevel[]) {
  let total = 0;
  return levels.map((level) => {
    total += level.size;
    return { ...level, total };
  });
}
