"use client";
import {
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconHistory,
  IconActivity,
  IconBolt,
  IconChevronDown,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { createPrng } from "../lib/simulation/prng";
import { Metric, PanelHeading, money, signedMoney } from "./terminal-ui";
import {
  createPaperState,
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

const PAPER_CHART_OPTIONS: Array<{
  value: PaperChartView;
  label: string;
  group: "Price" | "Analytics";
}> = [
  { value: "line", label: "Line", group: "Price" },
  { value: "area", label: "Area", group: "Price" },
  { value: "candles", label: "Candles", group: "Price" },
  { value: "ohlc", label: "OHLC bars", group: "Price" },
  { value: "heikin", label: "Heikin-Ashi", group: "Price" },
  { value: "depth", label: "Order book depth", group: "Analytics" },
  { value: "spread", label: "Bid / ask spread", group: "Analytics" },
  { value: "inventory", label: "Inventory", group: "Analytics" },
  { value: "pnl", label: "P&L / equity", group: "Analytics" },
  { value: "drawdown", label: "Drawdown", group: "Analytics" },
];

function usePaperChartViewport(total: number) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ x: number; offset: number } | null>(null);
  const windowSize = Math.max(8, Math.min(total, Math.round(total / zoom)));
  const maxOffset = Math.max(0, total - windowSize);
  const start = Math.max(0, maxOffset - Math.min(maxOffset, offset));
  const end = Math.min(total, start + windowSize);
  const onWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    setZoom((current) =>
      Math.max(
        1,
        Math.min(
          Math.max(1, total / 8),
          current * (event.deltaY < 0 ? 1.25 : 0.8)
        )
      )
    );
  };
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    drag.current = { x: event.clientX, offset };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const width = Math.max(
      1,
      event.currentTarget.getBoundingClientRect().width
    );
    const movedBars = Math.round(
      ((drag.current.x - event.clientX) / width) * windowSize
    );
    setOffset(
      Math.max(0, Math.min(maxOffset, drag.current.offset + movedBars))
    );
  };
  const finishDrag = () => {
    drag.current = null;
  };
  return {
    start,
    end,
    zoom,
    reset: () => {
      setZoom(1);
      setOffset(0);
    },
    zoomIn: () =>
      setZoom((current) => Math.min(Math.max(1, total / 8), current * 1.25)),
    zoomOut: () => setZoom((current) => Math.max(1, current * 0.8)),
    svgEvents: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
    },
  };
}

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
  const [source, setSource] = useState<"synthetic" | "pyth">("synthetic");
  const [feedStatus, setFeedStatus] = useState("SYNTHETIC");
  const random = useRef(createPrng(7264));
  const lastToast = useRef(0);
  useEffect(() => {
    if (!visible) return;
    if (source === "synthetic") {
      const timer = window.setInterval(
        () =>
          dispatch({
            type: "tick",
            delta: Math.round((random.current() - 0.49) * 24),
            at: Date.now(),
          }),
        400
      );
      return () => window.clearInterval(timer);
    }
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
  }, [source, visible]);
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
              ? "SYNTHETIC PYTH-STYLE FEED · 400MS"
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
      <div className="paper-grid">
        <section className="panel">
          <div className="market-header">
            <div>
              <div className="market-pair">
                <span className="pair-icon">◎</span>
                <div>
                  <h2>SOL / USD</h2>
                  <small>
                    {source === "synthetic"
                      ? "SYNTHETIC REFERENCE"
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
            <label className="cluster-select">
              <select
                aria-label="Price feed"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value as "synthetic" | "pyth");
                  setFeedStatus(
                    e.target.value === "synthetic" ? "SYNTHETIC" : "CONNECTING"
                  );
                }}
              >
                <option value="synthetic">Synthetic feed</option>
                <option value="pyth">Live Pyth</option>
              </select>
              <IconChevronDown size={12} />
            </label>
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
              Available session data
            </span>
          </div>
          <PaperChartSwitcher
            view={chartView}
            onViewChange={setChartView}
            points={points}
            desk={desk}
          />
          <div className="quick-trade">
            <button
              className="btn buy"
              disabled={source === "pyth" && feedStatus !== "PYTH LIVE"}
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
              disabled={source === "pyth" && feedStatus !== "PYTH LIVE"}
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
              Limit price
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
                <span>USDC</span>
              </div>
            </label>
            <label className="field">
              Size
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
                <span>SOL</span>
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
              disabled={source === "pyth" && feedStatus !== "PYTH LIVE"}
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
}: {
  view: PaperChartView;
  onViewChange: (view: PaperChartView) => void;
  points: PricePoint[];
  desk: PaperState;
}) {
  const option = PAPER_CHART_OPTIONS.find((item) => item.value === view)!;
  return (
    <>
      <div className="chart-toolbar paper-chart-toolbar">
        <div>
          <span className="eyebrow">Paper market visualizer</span>
          <strong>{option.label}</strong>
        </div>
        <label className="chart-select">
          <span className="sr-only">Paper trading chart view</span>
          <select
            aria-label="Paper trading chart view"
            value={view}
            onChange={(event) =>
              onViewChange(event.target.value as PaperChartView)
            }
          >
            {(["Price", "Analytics"] as const).map((group) => (
              <optgroup key={group} label={group}>
                {PAPER_CHART_OPTIONS.filter((item) => item.group === group).map(
                  (item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  )
                )}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      <PaperChart view={view} points={points} desk={desk} />
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
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
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

  if (view !== "line") {
    return (
      <PaperPriceStyleChart
        view={view as "area" | "candles" | "ohlc" | "heikin"}
        values={values}
      />
    );
  }
  const min = Math.min(...values) - 15,
    max = Math.max(...values) + 15;
  const line = values
    .map(
      (v, i) =>
        `${(i / Math.max(1, values.length - 1)) * 720},${195 - ((v - min) / (max - min)) * 180}`
    )
    .join(" ");
  return (
    <div className="price-chart paper-chart">
      <svg
        viewBox="0 0 720 210"
        preserveAspectRatio="none"
        role="img"
        aria-label="SOL paper trading price chart"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHover(
            Math.max(
              0,
              Math.min(
                values.length - 1,
                Math.round(
                  ((e.clientX - rect.left) / rect.width) * (values.length - 1)
                )
              )
            )
          );
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity=".28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,210 ${line} 720,210`} fill={`url(#${id})`} />
        <polyline
          points={line}
          className="chart-line"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="price-axis">
        <span>{money(max)}</span>
        <span>{money((min + max) / 2)}</span>
        <span>{money(min)}</span>
      </div>
      <div className="time-axis">
        <span>SESSION HISTORY</span>
        <span>{points.length} SAMPLES</span>
        <span>NOW</span>
      </div>
      {hover !== null && (
        <div className="chart-tooltip">{money(values[hover])}</div>
      )}
    </div>
  );
}

function PaperPriceStyleChart({
  view,
  values,
}: {
  view: "area" | "candles" | "ohlc" | "heikin";
  values: number[];
}) {
  const viewport = usePaperChartViewport(values.length);
  const visibleValues = values.slice(viewport.start, viewport.end);
  const candles = useMemo(() => {
    const base: Array<{
      open: number;
      high: number;
      low: number;
      close: number;
    }> = [];
    const bucketSize = Math.max(1, Math.ceil(visibleValues.length / 40));
    for (let index = 0; index < visibleValues.length; index += bucketSize) {
      const chunk = visibleValues.slice(index, index + bucketSize);
      base.push({
        open: chunk[0],
        high: Math.max(...chunk),
        low: Math.min(...chunk),
        close: chunk[chunk.length - 1],
      });
    }
    if (view !== "heikin") return base;
    return base.map((candle, index) => {
      const previous = base[index - 1];
      const close = Math.round(
        (candle.open + candle.high + candle.low + candle.close) / 4
      );
      const open = previous
        ? Math.round((previous.open + previous.close) / 2)
        : Math.round((candle.open + candle.close) / 2);
      return {
        open,
        close,
        high: Math.max(candle.high, open, close),
        low: Math.min(candle.low, open, close),
      };
    });
  }, [visibleValues, view]);
  const min = Math.min(...candles.map((candle) => candle.low)) - 15;
  const max = Math.max(...candles.map((candle) => candle.high)) + 15;
  const y = (value: number) =>
    195 - ((value - min) / Math.max(1, max - min)) * 175;
  const line = visibleValues
    .map(
      (value, index) =>
        `${(index / Math.max(1, visibleValues.length - 1)) * 720},${y(value)}`
    )
    .join(" ");
  const name =
    view === "area"
      ? "Paper area price chart"
      : view === "candles"
        ? "Paper candlestick price chart"
        : view === "ohlc"
          ? "Paper OHLC price chart"
          : "Paper Heikin-Ashi price chart";
  return (
    <div className="price-chart paper-chart alternative-chart">
      <svg
        viewBox="0 0 720 210"
        preserveAspectRatio="none"
        role="img"
        aria-label={name}
        className="interactive-chart"
        {...viewport.svgEvents}
      >
        {view === "area" ? (
          <>
            <polygon points={`0,210 ${line} 720,210`} className="chart-area" />
            <polyline
              points={line}
              className="chart-line"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : (
          candles.map((candle, index) => {
            const center = ((index + 0.5) / candles.length) * 720;
            const rising = candle.close >= candle.open;
            const top = y(Math.max(candle.open, candle.close));
            const height = Math.max(
              2,
              Math.abs(y(candle.open) - y(candle.close))
            );
            return (
              <g key={index} className={rising ? "candle-up" : "candle-down"}>
                <line
                  x1={center}
                  x2={center}
                  y1={y(candle.high)}
                  y2={y(candle.low)}
                  className="candle-wick"
                  vectorEffect="non-scaling-stroke"
                />
                {view === "ohlc" ? (
                  <>
                    <line
                      x1={center - 6}
                      x2={center}
                      y1={y(candle.open)}
                      y2={y(candle.open)}
                      className="candle-wick"
                    />
                    <line
                      x1={center}
                      x2={center + 6}
                      y1={y(candle.close)}
                      y2={y(candle.close)}
                      className="candle-wick"
                    />
                  </>
                ) : (
                  <rect
                    x={center - Math.min(9, 210 / candles.length)}
                    y={top}
                    width={Math.min(18, 420 / candles.length)}
                    height={height}
                    className="candle-body"
                  />
                )}
              </g>
            );
          })
        )}
      </svg>
      <div className="price-axis">
        <span>{money(max)}</span>
        <span>{money((min + max) / 2)}</span>
        <span>{money(min)}</span>
      </div>
      <PaperTimeAxis samples={visibleValues.length} />
      <div className="chart-navigation" aria-label="Chart navigation">
        <button
          type="button"
          onClick={viewport.zoomIn}
          aria-label="Zoom in chart"
        >
          +
        </button>
        <button
          type="button"
          onClick={viewport.zoomOut}
          aria-label="Zoom out chart"
        >
          −
        </button>
        <button
          type="button"
          onClick={viewport.reset}
          disabled={viewport.zoom === 1}
        >
          Fit
        </button>
        <span>Scroll to zoom · drag to pan</span>
      </div>
    </div>
  );
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
  const min = Math.min(...values);
  const max = Math.max(...values);
  const floor = min === max ? min - 1 : min;
  const ceiling = min === max ? max + 1 : max;
  const y = (value: number) =>
    195 - ((value - floor) / (ceiling - floor)) * 175;
  const line = values
    .map(
      (value, index) =>
        `${(index / Math.max(1, values.length - 1)) * 720},${y(value)}`
    )
    .join(" ");
  return (
    <div className={`price-chart paper-chart analytics-chart ${tone}`}>
      <svg
        viewBox="0 0 720 210"
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
      >
        <line x1="0" x2="720" y1={y(0)} y2={y(0)} className="chart-baseline" />
        <polyline
          points={line}
          className="chart-line"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="price-axis">
        <span>{ceiling.toFixed(2)}</span>
        <span>{((ceiling + floor) / 2).toFixed(2)}</span>
        <span>{floor.toFixed(2)}</span>
      </div>
      <PaperTimeAxis samples={values.length} />
    </div>
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
