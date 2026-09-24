"use client";
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
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
  type PriceView,
} from "./interactive-market-chart";
import { createPrng } from "../lib/simulation/prng";
import { Metric, PanelHeading, money, signedMoney } from "./terminal-ui";
import { ChartViewPicker, type ChartViewOption } from "./chart-view-picker";
import { ThemedSelect } from "./themed-select";
import { SolanaLogo } from "./solana-logo";
import {
  createPaperState,
  createPaperSessionSeed,
  paperReducer,
  type PricePoint,
  type PaperState,
} from "../lib/simulation/paper";

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
  { value: "heikin", label: "Heikin-Ashi", group: "Price", Icon: IconChartHistogram },
  { value: "depth", label: "Order book depth", group: "Analytics", Icon: IconChartDots },
  { value: "spread", label: "Bid / ask spread", group: "Analytics", Icon: IconArrowsExchange },
  { value: "inventory", label: "Inventory", group: "Analytics", Icon: IconBox },
  { value: "pnl", label: "P&L / equity", group: "Analytics", Icon: IconCurrencyDollar },
  { value: "drawdown", label: "Drawdown", group: "Analytics", Icon: IconTrendingDown },
];

export function PaperTradingDesk({
  active: visible = true,
}: {
  active?: boolean;
}) {
  const [desk, dispatch] = useReducer(
    paperReducer,
    undefined,
    createPaperState
  );
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [limit, setLimit] = useState("146.82");
  const [size, setSize] = useState("1");
  const [timeframe, setTimeframe] = useState(1);
  const [chartView, setChartView] = useState<PaperChartView>("line");
  const [source, setSource] = useState<"synthetic" | "pyth" | "replay">("synthetic");
  const [feedStatus, setFeedStatus] = useState("SYNTHETIC");
  const [playbackSpeed, setPlaybackSpeed] = useState(150);
  const [playbackPaused, setPlaybackPaused] = useState(false);
  const random = useRef(createPrng(7264));
  const replay = useRef<PricePoint[]>([]);
  const lastToast = useRef(0);
  useEffect(() => {
    if (!visible) return;
    if (source === "synthetic") {
      if (playbackPaused) return;
      const timer = window.setInterval(
        () =>
          dispatch({
            type: "tick",
            delta: Math.round((random.current() - 0.49) * 24),
            at: Date.now(),
          }),
        60000 / playbackSpeed
      );
      return () => window.clearInterval(timer);
    }
    if (source === "replay" || playbackPaused) return;
    let active = true;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/market/sol-usd", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        if (
          !Number.isFinite(data.priceCents) ||
          data.priceCents <= 0 ||
          !Number.isFinite(data.publishedAt) ||
          Date.now() - data.publishedAt > 60000
        )
          throw new Error("stale");
        if (active) {
          dispatch({
            type: "tick",
            priceCents: data.priceCents,
            at: data.publishedAt,
          });
          setFeedStatus("PYTH LIVE");
        }
      } catch {
        if (active) setFeedStatus("FEED UNAVAILABLE");
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [playbackPaused, playbackSpeed, source, visible]);
  useEffect(() => {
    if (!visible || source !== "replay") return;
    let active = true;
    const controller = new AbortController();
    setFeedStatus("LOADING REPLAY");
    async function loadReplay() {
      try {
        const response = await fetch("/api/market/sol-usd/history", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("unavailable");
        const data = (await response.json()) as {
          candles?: Array<{ at: number; priceCents: number }>;
        };
        const candles = data.candles?.filter(
          (candle) => Number.isFinite(candle.at) && Number.isSafeInteger(candle.priceCents) && candle.priceCents > 0,
        ) ?? [];
        const historyLength = 150;
        const remainingLength = 60;
        const starts = candles.length - historyLength - remainingLength;
        if (starts < 1) throw new Error("not enough history");
        const start = historyLength - 1 + (createPaperSessionSeed() % starts);
        const history = candles
          .slice(start - historyLength + 1, start + 1)
          .map((candle, sequence) => ({ ...candle, sequence }));
        replay.current = candles
          .slice(start + 1)
          .map((candle, sequence) => ({ ...candle, sequence }));
        if (!active) return;
        dispatch({ type: "load-history", points: history });
        setPlaybackPaused(false);
        setFeedStatus("HISTORICAL REPLAY");
      } catch {
        if (active) setFeedStatus("REPLAY UNAVAILABLE");
      }
    }
    void loadReplay();
    return () => {
      active = false;
      controller.abort();
    };
  }, [source, visible]);
  useEffect(() => {
    if (
      !visible ||
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
      dispatch({ type: "tick", priceCents: next.priceCents, at: next.at });
    }, 60000 / playbackSpeed);
    return () => window.clearInterval(timer);
  }, [feedStatus, playbackPaused, playbackSpeed, source, visible]);
  useEffect(() => {
    const trade = desk.trades[0];
    if (trade && trade.id > lastToast.current) {
      lastToast.current = trade.id;
      toast.success(
        `${trade.side === "buy" ? "Bought" : "Sold"} ${trade.sizeMilliSol / 1000} simulated SOL at ${money(trade.priceCents)}`
      );
    }
  }, [desk.trades]);
  const equity =
    desk.usdcCents + Math.round((desk.solMilli * desk.priceCents) / 1000);
  const pnl = equity - desk.startEquityCents;
  const priceCents = Math.round(Number(limit) * 100);
  const sizeMilliSol = Math.round(Number(size) * 1000);
  const distance = Number.isFinite(priceCents)
    ? (priceCents / desk.priceCents - 1) * 100
    : 0;
  const cutoff = desk.points.at(-1)!.at - timeframe * 60000;
  const points = useMemo(
    () => desk.points.filter((p) => p.at >= cutoff),
    [desk.points, cutoff]
  );
  const change = (desk.priceCents / desk.startPriceCents - 1) * 100;
  const isHistoricalReplay =
    source === "replay" && (desk.points[0]?.at ?? 0) > 1_000_000_000_000;
  const replayRange = isHistoricalReplay
    ? `${new Date(desk.points[0].at).toLocaleString()} — ${new Date(desk.points.at(-1)!.at).toLocaleString()}`
    : null;
  const tradingPaused =
    (source === "pyth" && feedStatus !== "PYTH LIVE") ||
    (source === "replay" && feedStatus !== "HISTORICAL REPLAY");
  const playbackControls = (
    <div className="replay-playback-actions">
      <button
        type="button"
        aria-label={playbackPaused ? "Resume market display" : "Pause market display"}
        title={playbackPaused ? "Resume" : "Pause"}
        disabled={feedStatus === "REPLAY COMPLETE" || feedStatus === "LOADING REPLAY"}
        onClick={() => setPlaybackPaused((paused) => !paused)}
      >
        {playbackPaused ? <IconPlayerPlay size={14} /> : <IconPlayerPause size={14} />}
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
  function place(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "quote", side, priceCents, sizeMilliSol, at: Date.now() });
  }
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
              ? "SYNTHETIC MARKET MODEL · 400MS"
              : source === "replay"
                ? "HISTORICAL SOL / USD REPLAY · 1M CANDLES"
                : "PYTH REFERENCE FEED · 5S"}
          </p>
          <h1>Paper Trading Desk</h1>
          <p className="tip">
            <IconBolt size={14} />
            Practice real decisions with simulated capital.
          </p>
        </div>
        <span className="feed-live">
          <i />
          {feedStatus}
        </span>
      </div>
      <div className="paper-portfolio panel">
        <Metric
          label="SOL BALANCE"
          value={`${(desk.solMilli / 1000).toFixed(2)} SOL`}
          detail={`${money((desk.solMilli / 1000) * desk.priceCents)} notional`}
        />
        <Metric
          label="USDC BALANCE"
          value={money(desk.usdcCents)}
          detail="Simulated buying power"
        />
        <Metric
          label="PORTFOLIO VALUE"
          value={money(equity)}
          detail="Cash + marked inventory"
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
          Live reference unavailable or stale. Trading is paused; switch to the
          synthetic feed to continue.
        </div>
      )}
      {feedStatus === "REPLAY UNAVAILABLE" && (
        <div role="status" className="notice">
          Historical SOL/USD data is temporarily unavailable. Switch to the
          synthetic feed or try the replay again shortly.
        </div>
      )}
      <div className="paper-grid">
        <section className="panel">
          <div className="market-header">
            <div>
              <div className="market-pair">
                <span className="pair-icon"><SolanaLogo size={24} /></span>
                <div>
                  <h2>SOL / USD</h2>
                  <small>
                    {source === "synthetic"
                      ? "SYNTHETIC REFERENCE"
                      : source === "replay"
                        ? "HISTORICAL REPLAY"
                        : "PYTH REFERENCE"}{" "}
                    · PAPER MARKET
                  </small>
                </div>
              </div>
              <div className="price-readout">
                <strong>{money(desk.priceCents, 3)}</strong>
                <span className={`change-badge ${change < 0 ? "loss" : ""}`}>
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(2)}%
                </span>
              </div>
            </div>
            <ThemedSelect
              className="cluster-select"
              label="Price feed"
              value={source}
              options={[
                { value: "synthetic", label: "Synthetic feed", icon: <IconChartLine size={14} /> },
                { value: "replay", label: "Historical replay", icon: <IconHistory size={14} /> },
                { value: "pyth", label: "Live Pyth", icon: <IconActivity size={14} /> },
              ]}
              onChange={(value) => {
                setSource(value);
                setPlaybackPaused(false);
                if (value === "replay") setTimeframe(240);
                setFeedStatus(
                  value === "synthetic"
                    ? "SYNTHETIC"
                    : value === "replay"
                      ? "LOADING REPLAY"
                      : "CONNECTING",
                );
              }}
            />
          </div>
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
              {replayRange ? `Replay: ${replayRange}` : "Available session data"}
            </span>
          </div>
          <PaperChartSwitcher
            view={chartView}
            onViewChange={setChartView}
            points={points}
            desk={desk}
            useTimestampAxis={isHistoricalReplay}
            readoutActions={playbackControls}
          />
          <div className="quick-trade">
            <button
              className="btn buy"
              disabled={tradingPaused}
              onClick={() =>
                dispatch({
                  type: "market",
                  side: "buy",
                  sizeMilliSol: 1000,
                  at: Date.now(),
                })
              }
            >
              <IconArrowUpRight size={17} />
              Buy 1 SOL <span className="mono">{money(desk.priceCents)}</span>
            </button>
            <button
              className="btn sell"
              disabled={tradingPaused}
              onClick={() =>
                dispatch({
                  type: "market",
                  side: "sell",
                  sizeMilliSol: 1000,
                  at: Date.now(),
                })
              }
            >
              <IconArrowDownRight size={17} />
              Sell 1 SOL <span className="mono">{money(desk.priceCents)}</span>
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
              <span className="field-label">Limit price <span className="field-unit">USDC</span></span>
              <div className="input-unit">
                <input
                  aria-label="Limit price"
                  type="number"
                  min=".01"
                  step=".01"
                  required
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
                <div className="number-stepper" aria-label="Adjust limit price">
                  <button type="button" aria-label="Increase limit price" onClick={() => setLimit((value) => Math.max(0.01, Number(value || 0) + 0.01).toFixed(2))}>
                    <IconChevronUp size={13} />
                  </button>
                  <button type="button" aria-label="Decrease limit price" onClick={() => setLimit((value) => Math.max(0.01, Number(value || 0) - 0.01).toFixed(2))}>
                    <IconChevronDown size={13} />
                  </button>
                </div>
              </div>
            </label>
            <label className="field">
              <span className="field-label">Size <span className="field-unit">SOL</span></span>
              <div className="input-unit">
                <input
                  aria-label="Size"
                  type="number"
                  min=".001"
                  step=".001"
                  required
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                />
                <div className="number-stepper" aria-label="Adjust size">
                  <button type="button" aria-label="Increase size" onClick={() => setSize((value) => Math.max(0.001, Number(value || 0) + 0.001).toFixed(3))}>
                    <IconChevronUp size={13} />
                  </button>
                  <button type="button" aria-label="Decrease size" onClick={() => setSize((value) => Math.max(0.001, Number(value || 0) - 0.001).toFixed(3))}>
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
                <b>
                  {money(
                    Number.isFinite(priceCents * sizeMilliSol)
                      ? (priceCents * sizeMilliSol) / 1000
                      : 0
                  )}
                </b>
              </div>
            </div>
            <button
              className={`btn wide ${side === "buy" ? "buy" : "sell"}`}
              disabled={tradingPaused}
              type="submit"
            >
              Place {side} quote
            </button>
            <p className="control-hint" style={{ marginTop: 14 }}>
              Simulated execution only. Funds are reserved for open quotes.
            </p>
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
                  <th>Side</th>
                  <th>Price</th>
                  <th>Size</th>
                  <th>Distance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {desk.quotes.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <span
                        className={`tag ${q.side === "buy" ? "profit" : "loss"}`}
                      >
                        {q.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="mono">{money(q.priceCents)}</td>
                    <td className="mono">{q.sizeMilliSol / 1000} SOL</td>
                    <td className="mono">
                      {((q.priceCents / desk.priceCents - 1) * 100).toFixed(2)}%
                    </td>
                    <td>
                      <button
                        className="table-cancel"
                        onClick={() => dispatch({ type: "cancel", id: q.id })}
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
                  <th>Type / Side</th>
                  <th>Price</th>
                  <th>Size</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {desk.trades.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="tag">{t.source}</span>{" "}
                      <span className={t.side === "buy" ? "profit" : "loss"}>
                        {t.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="mono">{money(t.priceCents)}</td>
                    <td className="mono">{t.sizeMilliSol / 1000} SOL</td>
                    <td className="mono muted">
                      {new Date(t.at).toLocaleTimeString("en-GB")}
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
  useTimestampAxis,
  readoutActions,
}: {
  view: PaperChartView;
  onViewChange: (view: PaperChartView) => void;
  points: PricePoint[];
  desk: PaperState;
  useTimestampAxis: boolean;
  readoutActions?: ReactNode;
}) {
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
            time: useTimestampAxis ? Math.floor(point.at / 1000) : point.sequence,
            value: point.priceCents / 100,
          }))}
          label={`Paper ${option.label} price chart`}
          ticks={!useTimestampAxis}
          timeLabelPrefix={useTimestampAxis ? undefined : "Sample"}
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
        ) : ["line", "area", "candles", "ohlc", "heikin"].includes(view) ? (
          <span className="primary">
            <i className="legend-dot" /> SOL / USD reference
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
  const sampled = points.filter(
    (_, i) => i % Math.max(1, Math.floor(points.length / 500)) === 0
  );
  const values = sampled.map((p) => p.priceCents);
  if (view === "depth") return <PaperDepthChart desk={desk} />;
  if (!["line", "area", "candles", "ohlc", "heikin"].includes(view)) {
    const analytics = values.map((price) => {
      if (view === "spread") return 30;
      if (view === "inventory") return desk.solMilli / 1000;
      return (
        (desk.usdcCents +
          Math.round((desk.solMilli * price) / 1000) -
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
      inventory: "Paper inventory (SOL)",
      pnl: "Paper P&L / equity chart",
      drawdown: "Paper drawdown chart",
    };
    return (
      <PaperSeriesChart values={series} label={labels[view]} tone={view} />
    );
  }

  return null;
}

function PaperSeriesChart({
  values,
  label,
  tone,
}: {
  values: number[];
  label: string;
  tone: string;
}) {
  return (
    <InteractiveMarketChart
      ticks
      samples={values.map((value, time) => ({ time, value }))}
      label={label}
      unit={
        tone === "inventory"
          ? "SOL"
          : tone === "spread"
            ? "bps"
            : tone === "drawdown"
              ? "%"
              : "$"
      }
    />
  );
}

function PaperDepthChart({ desk }: { desk: PaperState }) {
  const size = Math.max(1, desk.solMilli / 10000);
  const quoteSize = desk.quotes.reduce(
    (total, quote) => total + quote.sizeMilliSol / 1000,
    0
  );
  return (
    <div className="price-chart paper-chart depth-chart">
      <svg
        viewBox="0 0 720 210"
        preserveAspectRatio="none"
        role="img"
        aria-label="Paper order book depth chart"
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
                {amount} SOL
              </text>
              <text x={368 + width - 12} y={y + 16} className="depth-label">
                {amount} SOL
              </text>
            </g>
          );
        })}
        <text x="274" y="205" className="depth-price">
          BID {money(Math.floor(desk.priceCents * 0.9985))}
        </text>
        <text x="377" y="205" className="depth-price">
          ASK {money(Math.ceil(desk.priceCents * 1.0015))}
        </text>
      </svg>
      <PaperTimeAxis samples={desk.points.length} />
    </div>
  );
}

function PaperTimeAxis({ samples }: { samples: number }) {
  return (
    <div className="time-axis">
      <span>SESSION HISTORY</span>
      <span>{samples} SAMPLES</span>
      <span>NOW</span>
    </div>
  );
}
