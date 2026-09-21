"use client";
import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
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
} from "../lib/simulation/paper";

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
          <PaperChart points={points} />
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
function PaperChart({ points }: { points: PricePoint[] }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const sampled = points.filter(
    (_, i) => i % Math.max(1, Math.floor(points.length / 500)) === 0
  );
  const values = sampled.map((p) => p.priceCents);
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
