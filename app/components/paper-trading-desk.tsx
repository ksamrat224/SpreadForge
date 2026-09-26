"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { InteractiveMarketChart } from "./interactive-market-chart";
import { Metric, money, signedMoney } from "./terminal-ui";
import {
  createPaperSessionSeed,
  createPaperState,
  getPaperEquityCents,
  getPositionValueCents,
  PAPER_ASSETS,
  PAPER_MARKETS,
  paperReducer,
  type PaperAsset,
} from "../lib/simulation/paper";

type FeedSource = "synthetic" | "pyth" | "replay";

export function PaperTradingDesk({ active = true }: { active?: boolean }) {
  const [desk, dispatch] = useReducer(
    paperReducer,
    undefined,
    createPaperState
  );
  const [source, setSource] = useState<FeedSource>("pyth");
  const [feedStatus, setFeedStatus] = useState("CONNECTING");
  const [limit, setLimit] = useState("");
  const [size, setSize] = useState("0.001");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [confirmReset, setConfirmReset] = useState(false);
  const random = useRef(0);
  const replay = useRef<Array<{ priceCents: number; at: number }>>([]);
  const asset = desk.activeAsset;
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

  useEffect(() => {
    if (!active || source !== "pyth") return;
    let cancelled = false;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch(
          "/api/market/" + asset.toLowerCase() + "-usd",
          { cache: "no-store", signal: controller.signal }
        );
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        if (
          !Number.isSafeInteger(data.priceCents) ||
          data.priceCents <= 0 ||
          !Number.isFinite(data.publishedAt) ||
          Date.now() - data.publishedAt > 60_000
        )
          throw new Error("stale");
        if (!cancelled) {
          dispatch({
            type: "tick",
            asset,
            priceCents: data.priceCents,
            at: data.publishedAt,
          });
          setFeedStatus(data.source === "pyth" ? "PYTH LIVE" : "LIVE FALLBACK");
        }
      } catch {
        if (!cancelled) setFeedStatus("FEED UNAVAILABLE");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [active, asset, source]);
  useEffect(() => {
    if (!active || source !== "synthetic") return;
    const timer = window.setInterval(() => {
      random.current = (random.current * 1664525 + 1013904223) >>> 0;
      const delta = Math.round(
        (random.current / 2 ** 32 - 0.49) *
          Math.max(2, market.priceCents * 0.0015)
      );
      dispatch({ type: "tick", asset, delta, at: Date.now() });
    }, 400);
    return () => window.clearInterval(timer);
  }, [active, asset, market.priceCents, source]);
  useEffect(() => {
    if (!active || source !== "replay") return;
    let cancelled = false;
    const controller = new AbortController();
    void fetch("/api/market/" + asset.toLowerCase() + "-usd/history", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((data) => {
        const candles = (data.candles ?? []).filter(
          (item: { at: number; priceCents: number }) =>
            Number.isFinite(item.at) &&
            Number.isSafeInteger(item.priceCents) &&
            item.priceCents > 0
        );
        if (candles.length < 210) throw new Error("history");
        const start = Math.max(
          149,
          (createPaperSessionSeed() % (candles.length - 60)) + 149
        );
        replay.current = candles.slice(start + 1);
        if (!cancelled) {
          dispatch({
            type: "load-history",
            asset,
            points: candles.slice(start - 149, start + 1),
          });
          setFeedStatus("HISTORICAL REPLAY");
        }
      })
      .catch(() => {
        if (!cancelled) setFeedStatus("REPLAY UNAVAILABLE");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, asset, source]);
  useEffect(() => {
    if (!active || source !== "replay" || feedStatus !== "HISTORICAL REPLAY")
      return;
    const timer = window.setInterval(() => {
      const next = replay.current.shift();
      if (!next) {
        setFeedStatus("REPLAY COMPLETE");
        return;
      }
      dispatch({ type: "tick", asset, ...next });
    }, 400);
    return () => window.clearInterval(timer);
  }, [active, asset, feedStatus, source]);
  useEffect(() => {
    const trade = desk.trades[0];
    if (trade)
      toast.success(
        (trade.side === "buy" ? "Bought " : "Sold ") +
          trade.sizeMilliAsset / 1000 +
          " simulated " +
          trade.asset +
          " at " +
          money(trade.priceCents)
      );
  }, [desk.trades]);

  const change = (market.priceCents / market.startPriceCents - 1) * 100;
  const openQuotes = desk.quotes.filter((quote) => quote.asset === asset);
  const quickSizeMilliAsset =
    asset === "BTC" ? 1 : asset === "ETH" ? 100 : 1000;
  const quickSizeLabel = (quickSizeMilliAsset / 1000).toFixed(
    quickSizeMilliAsset < 1000 ? 3 : 0
  );
  const place = (event: React.FormEvent) => {
    event.preventDefault();
    dispatch({
      type: "quote",
      asset,
      side,
      priceCents,
      sizeMilliAsset,
      at: Date.now(),
    });
  };
  const reset = () => {
    if (!confirmReset) return setConfirmReset(true);
    dispatch({ type: "reset", seed: createPaperSessionSeed() });
    setConfirmReset(false);
    toast.success("Paper portfolio reset to 10,000 simulated USDC.");
  };
  return (
    <section className="page-shell" aria-label="Multi-asset Paper Trading">
      <div className="workspace-top">
        <span>
          <strong>Practice with live prices, not real money.</strong> Every
          order is simulated.
        </span>
        <span className="mono">PAPER EXECUTION / UNRANKED</span>
      </div>
      <div className="context-banner">
        <div>
          <p className="eyebrow">
            LIVE PRICE REFERENCE · SHARED 10,000 USDC PORTFOLIO
          </p>
          <h1>Multi-Asset Paper Trading</h1>
          <p className="tip">
            Phantom and faucet SOL are only used for devnet verification
            fees—not paper trades.
          </p>
        </div>
        <span className="feed-live">
          <i />
          {feedStatus}
        </span>
      </div>
      <div className="paper-portfolio panel">
        <Metric
          label="USDC BUYING POWER"
          value={money(desk.usdcCents)}
          detail="Simulated only"
        />
        <Metric
          label={asset + " BALANCE"}
          value={(position.quantityMilliAsset / 1000).toFixed(3) + " " + asset}
          detail={money(getPositionValueCents(desk, asset)) + " marked value"}
        />
        <Metric
          label="PORTFOLIO VALUE"
          value={money(equity)}
          detail="Cash + BTC + ETH + SOL"
        />
        <Metric
          label="TOTAL P&L"
          value={signedMoney(pnl)}
          detail={
            "Realized " +
            signedMoney(desk.realizedPnlCents) +
            " · Unrealized " +
            signedMoney(pnl - desk.realizedPnlCents)
          }
          tone={pnl >= 0 ? "profit" : "loss"}
        />
      </div>
      {desk.error && (
        <div role="alert" className="notice">
          {desk.error}
        </div>
      )}
      {tradingPaused && (
        <div role="status" className="notice">
          This market is unavailable or stale. Switch to the synthetic feed to
          continue paper trading.
        </div>
      )}
      <div className="paper-grid">
        <section className="panel">
          <div className="market-header">
            <div>
              <div className="market-pair">
                <span className="pair-icon">{PAPER_MARKETS[asset].icon}</span>
                <div>
                  <h2>{PAPER_MARKETS[asset].label}</h2>
                  <small>LIVE USD REFERENCE · SIMULATED USDC EXECUTION</small>
                </div>
              </div>
              <div className="price-readout">
                <strong>{money(market.priceCents, 3)}</strong>
                <span className={"change-badge " + (change < 0 ? "loss" : "")}>
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(2)}%
                </span>
              </div>
            </div>
            <div>
              <label className="sr-only" htmlFor="paper-asset">
                Market
              </label>
              <select
                id="paper-asset"
                className="cluster-select"
                value={asset}
                onChange={(event) =>
                  dispatch({
                    type: "select-asset",
                    asset: event.target.value as PaperAsset,
                  })
                }
              >
                {PAPER_ASSETS.map((item) => (
                  <option key={item} value={item}>
                    {PAPER_MARKETS[item].label}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="paper-feed">
                Price feed
              </label>
              <select
                id="paper-feed"
                className="cluster-select"
                value={source}
                onChange={(event) =>
                  setSource(event.target.value as FeedSource)
                }
              >
                <option value="pyth">Live Pyth</option>
                <option value="replay">Historical replay</option>
                <option value="synthetic">Synthetic fallback</option>
              </select>
            </div>
          </div>
          <InteractiveMarketChart
            view="candles"
            samples={market.points.map((point) => ({
              time:
                point.at > 1_000_000_000_000
                  ? Math.floor(point.at / 1000)
                  : point.sequence,
              value: point.priceCents / 100,
            }))}
            label={PAPER_MARKETS[asset].label + " paper price chart"}
            ticks={market.points[0]?.at < 1_000_000_000_000}
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
              Sell {quickSizeLabel} {asset}{" "}
              <span className="mono">{money(market.priceCents)}</span>
            </button>
          </div>
        </section>
        <section className="panel">
          <h2>Limit quote</h2>
          <form className="quote-form" onSubmit={place}>
            <div className="segmented">
              <button
                type="button"
                className={side === "buy" ? "active" : ""}
                onClick={() => setSide("buy")}
              >
                BUY
              </button>
              <button
                type="button"
                className={side === "sell" ? "sell active" : "sell"}
                onClick={() => setSide("sell")}
              >
                SELL
              </button>
            </div>
            <label className="field">
              <span className="field-label">
                Limit price <span className="field-unit">USDC</span>
              </span>
              <input
                aria-label="Limit price"
                type="number"
                min=".01"
                step=".01"
                value={limitValue}
                onChange={(event) => setLimit(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">
                Size <span className="field-unit">{asset}</span>
              </span>
              <input
                aria-label="Size"
                type="number"
                min=".001"
                step=".001"
                value={size}
                onChange={(event) => setSize(event.target.value)}
                required
              />
            </label>
            <button
              className={"btn wide " + (side === "buy" ? "buy" : "sell")}
              disabled={tradingPaused}
              type="submit"
            >
              Place {side} {asset} quote
            </button>
            <p className="control-hint">
              Paper orders reserve simulated USDC or {asset} until filled or
              cancelled.
            </p>
          </form>
          <button className="btn ghost" onClick={reset}>
            {confirmReset ? "Confirm reset portfolio" : "Reset portfolio"}
          </button>
        </section>
      </div>
      <div className="table-grid">
        <section className="panel">
          <h2>Open {asset} quotes</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Side</th>
                  <th>Price</th>
                  <th>Size</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {openQuotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>{quote.side.toUpperCase()}</td>
                    <td className="mono">{money(quote.priceCents)}</td>
                    <td>
                      {quote.sizeMilliAsset / 1000} {asset}
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
          {!openQuotes.length && (
            <div className="empty-state">No open {asset} quotes.</div>
          )}
        </section>
        <section className="panel">
          <h2>Recent fills</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Type / Side</th>
                  <th>Price</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {desk.trades.map((trade) => (
                  <tr key={trade.id}>
                    <td>{trade.asset}/USDC</td>
                    <td>
                      {trade.source} {trade.side.toUpperCase()}
                    </td>
                    <td className="mono">{money(trade.priceCents)}</td>
                    <td>
                      {trade.sizeMilliAsset / 1000} {trade.asset}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!desk.trades.length && (
            <div className="empty-state">
              Buy an asset to start your paper portfolio.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
