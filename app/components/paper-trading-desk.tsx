"use client";

import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconHistory,
  IconActivity,
  IconBolt,
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
import { createPrng } from "../lib/simulation/prng";
import { Metric, PanelHeading, money, signedMoney } from "./terminal-ui";
import { ChartViewPicker, type ChartViewOption } from "./chart-view-picker";
import { ThemedSelect } from "./themed-select";
import { AssetLogo } from "./crypto-logos";
import {
  HISTORY_RANGE_LABELS,
  HISTORY_RANGES,
  mergeLiveTick,
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

type FeedSource = "synthetic" | "pyth" | "replay";
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
const QUICK_SIZE_MILLI: Record<PaperAsset, number> = {
  BTC: 1,
  ETH: 100,
  SOL: 1000,
};
const INITIAL_STATUS: Record<FeedSource, string> = {
  synthetic: "SYNTHETIC",
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

// The live feed starts with an empty chart; seeded synthetic history would
// otherwise sit on a different time axis than the real prices appended to it.
function createInitialDesk() {
  return paperReducer(createPaperState(), {
    type: "restart-feed",
    history: "empty",
    at: 0,
  });
}

export function PaperTradingDesk({ active = true }: { active?: boolean }) {
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
  const random = useRef(createPrng(7264));
  const replay = useRef<PricePoint[]>([]);
  const lastToast = useRef<PaperState["trades"][number] | null>(null);
  const asset = desk.activeAsset;
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
  const tradingPaused =
    (source === "pyth" && !hasLiveFeed) ||
    (source === "replay" && feedStatus !== "HISTORICAL REPLAY");

  // Live and synthetic feeds update every market so the shared portfolio is
  // marked to current prices and quotes on inactive assets can still fill.
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
      const results = await Promise.allSettled(PAPER_ASSETS.map(load));
      if (cancelled) return;
      results.forEach((result, i) => {
        if (result.status === "fulfilled")
          dispatch({
            type: "tick",
            asset: PAPER_ASSETS[i],
            priceCents: result.value.priceCents,
            at: result.value.publishedAt,
          });
      });
      const current = results[PAPER_ASSETS.indexOf(asset)];
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
  }, [active, asset, liveKey, playbackPaused, source]);
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
    if (!active || source !== "synthetic" || playbackPaused) return;
    const timer = window.setInterval(() => {
      const at = Date.now();
      for (const item of PAPER_ASSETS)
        dispatch({
          type: "tick",
          asset: item,
          delta: Math.round(
            (random.current() - 0.49) *
              Math.max(2, PAPER_MARKETS[item].initialPriceCents * 0.0015)
          ),
          at,
        });
    }, 60000 / playbackSpeed);
    return () => window.clearInterval(timer);
  }, [active, playbackPaused, playbackSpeed, source]);
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
    dispatch({
      type: "restart-feed",
      history: next === "synthetic" ? "synthetic" : "empty",
      at: Date.now(),
    });
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
    toast.success("Paper portfolio reset to 10,000 simulated USDC.");
  }
  const place = (event: React.FormEvent) => {
    event.preventDefault();
    dispatch({
      type: "quote",
      asset,
      side,
      priceCents,
      sizeMilliAsset,
      at: now(),
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
  const points = market.points.filter((point) => point.at >= cutoff);
  const replayRange =
    source === "replay" && market.points.length
      ? `${new Date(market.points[0].at).toLocaleString()} — ${new Date(market.points.at(-1)!.at).toLocaleString()}`
      : null;
  const feedLabel =
    source === "synthetic"
      ? "SYNTHETIC REFERENCE"
      : source === "replay"
        ? `HISTORICAL REPLAY · ${(historicalProvider ?? "LOADING").toUpperCase()}`
        : feedStatus === "LIVE FALLBACK"
          ? "EXCHANGE FALLBACK REFERENCE"
          : "PYTH REFERENCE";
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
      <div className="context-banner">
        <div>
          <p className="eyebrow">
            {source === "synthetic"
              ? "SYNTHETIC MARKET MODEL · BTC · ETH · SOL"
              : source === "replay"
                ? `HISTORICAL ${asset} / USD REPLAY · 1M CANDLES`
                : "LIVE REFERENCE FEED · 5S · BTC · ETH · SOL"}
          </p>
          <h1>Paper Trading Desk</h1>
          <p className="tip">
            <IconBolt size={14} />
            Practice real decisions across BTC, ETH and SOL with one shared
            10,000 USDC simulated portfolio.
          </p>
        </div>
        <span className="feed-live">
          <i />
          {feedStatus}
        </span>
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
          Live {asset} reference unavailable or stale. Trading is paused; switch
          to the synthetic feed to continue.
        </div>
      )}
      {feedStatus === "REPLAY UNAVAILABLE" && (
        <div role="status" className="notice">
          Historical {asset}/USD data is temporarily unavailable. Switch to the
          synthetic feed or try the replay again shortly.
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
              <div className="price-readout">
                <strong>{money(market.priceCents, 3)}</strong>
                <span className={`change-badge ${change < 0 ? "loss" : ""}`}>
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="market-header-controls">
              <ThemedSelect
                className="cluster-select"
                label="Market"
                value={asset}
                options={PAPER_ASSETS.map((item) => ({
                  value: item,
                  label: PAPER_MARKETS[item].label,
                  icon: <AssetLogo asset={item} size={14} />,
                }))}
                onChange={changeAsset}
              />
              <ThemedSelect
                className="cluster-select"
                label="Price feed"
                value={source}
                options={[
                  {
                    value: "synthetic",
                    label: "Synthetic feed",
                    icon: <IconChartLine size={14} />,
                  },
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
                  ? `${formatInterval(rangeBars.intervalSeconds)} candles · ${(rangeBars.source ?? "exchange").toUpperCase()} OHLCV + live ${feedStatus === "PYTH LIVE" ? "Pyth" : "exchange"} price`
                  : rangeBars?.status === "failed"
                    ? "Range history unavailable · showing polled prices"
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
                  at: Date.now(),
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
                  at: Date.now(),
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

function PaperChartSwitcher({
  view,
  onViewChange,
  points,
  desk,
  bars,
  intervals,
  readoutActions,
}: {
  view: PaperChartView;
  onViewChange: (view: PaperChartView) => void;
  points: PricePoint[];
  bars?: ChartBar[];
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
          intervals={intervals}
          toolbarStart={chartPicker}
          readoutActions={readoutActions}
        />
      ) : (
        <>
          <div className="market-chart-toolbar analytics-toolbar">
            {chartPicker}
          </div>
          <PaperChart view={view} points={points} desk={desk} />
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
            <span>working paper quotes and indicative depth</span>
          </>
        ) : PRICE_VIEWS.includes(view) ? (
          <span className="primary">
            <i className="legend-dot" /> {asset} / USD reference
          </span>
        ) : (
          <span>
            Calculated from your simulated balances and session prices
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
}: {
  view: PaperChartView;
  points: PricePoint[];
  desk: PaperState;
}) {
  if (view === "depth") return <PaperDepthChart desk={desk} />;
  const asset = desk.activeAsset;
  const quantity = desk.positions[asset].quantityMilliAsset;
  // Other assets are held at their current marks; only the active market moves.
  const otherEquity =
    getPaperEquityCents(desk) - getPositionValueCents(desk, asset);
  const sampled = points.filter(
    (_, i) => i % Math.max(1, Math.floor(points.length / 500)) === 0
  );
  const analytics = sampled.map((point) => {
    if (view === "spread") return 30;
    if (view === "inventory") return quantity / 1000;
    return (
      (otherEquity +
        Math.round((quantity * point.priceCents) / 1000) -
        desk.startEquityCents) /
      100
    );
  });
  const series =
    view === "drawdown"
      ? analytics.map((value, index) => {
          const peak = Math.max(...analytics.slice(0, index + 1));
          return peak ? -((peak - value) / peak) * 100 : 0;
        })
      : analytics;
  const labels: Record<string, string> = {
    spread: "Paper bid / ask spread (basis points)",
    inventory: `Paper inventory (${asset})`,
    pnl: "Paper P&L / equity chart",
    drawdown: "Paper drawdown chart",
  };
  return (
    <InteractiveMarketChart
      ticks
      samples={series.map((value, time) => ({ time, value }))}
      label={labels[view]}
      unit={
        view === "inventory"
          ? asset
          : view === "spread"
            ? "bps"
            : view === "drawdown"
              ? "%"
              : "$"
      }
    />
  );
}

function PaperDepthChart({ desk }: { desk: PaperState }) {
  const asset = desk.activeAsset;
  const { priceCents } = desk.markets[asset];
  const size = Math.max(1, desk.positions[asset].quantityMilliAsset / 10000);
  const quoteSize = desk.quotes
    .filter((quote) => quote.asset === asset)
    .reduce((total, quote) => total + quote.sizeMilliAsset / 1000, 0);
  return (
    <div className="price-chart paper-chart depth-chart">
      <svg
        viewBox="0 0 720 210"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Paper ${asset} order book depth chart`}
      >
        <line x1="360" x2="360" y1="10" y2="200" className="chart-baseline" />
        {[1, 2, 3, 4, 5].map((level) => {
          const width = level * 53;
          const y = 200 - level * 34;
          const amount = (size * level + quoteSize).toFixed(1);
          return (
            <g key={level}>
              <rect
                x={360 - width}
                y={y}
                width={width}
                height={25}
                className="depth-bid"
              />
              <rect
                x="360"
                y={y}
                width={width}
                height={25}
                className="depth-ask"
              />
              <text x={352 - width} y={y + 16} className="depth-label">
                {amount} {asset}
              </text>
              <text x={368 + width - 12} y={y + 16} className="depth-label">
                {amount} {asset}
              </text>
            </g>
          );
        })}
        <text x="274" y="205" className="depth-price">
          BID {money(Math.floor(priceCents * 0.9985))}
        </text>
        <text x="377" y="205" className="depth-price">
          ASK {money(Math.ceil(priceCents * 1.0015))}
        </text>
      </svg>
      <div className="time-axis">
        <span>SESSION HISTORY</span>
        <span>{desk.markets[asset].points.length} SAMPLES</span>
        <span>NOW</span>
      </div>
    </div>
  );
}
