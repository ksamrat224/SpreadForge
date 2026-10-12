"use client";

import { useEffect, useMemo, useState } from "react";
import { IconArrowRight, IconChartPie, IconRefresh } from "@tabler/icons-react";
import { AssetLogo } from "./crypto-logos";
import { PaperChainPanel } from "./paper-chain-panel";
import { Metric, money, signedMoney } from "./terminal-ui";
import { usePaperChain } from "../lib/hooks/use-paper-chain";
import type { HistoryCandle } from "../lib/market-history";
import {
  analyzePortfolio,
  selectSpotlights,
  type PortfolioMarketData,
} from "../lib/simulation/portfolio-insights";
import type { PaperAsset } from "../lib/simulation/paper";

const MOMENTUM_LABEL = {
  "strong-up": "Strong upward",
  up: "Upward",
  neutral: "Neutral",
  down: "Downward",
  "strong-down": "Strong downward",
} as const;

const pct = (value: number | null) =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

export function PaperPortfolio({
  active,
  onTradeAsset,
}: {
  active: boolean;
  onTradeAsset: (asset: PaperAsset) => void;
}) {
  const chain = usePaperChain(active);
  const [market, setMarket] = useState<PortfolioMarketData>({});
  const [errors, setErrors] = useState<PaperAsset[]>([]);
  const [retry, setRetry] = useState(0);
  const snapshot = chain.snapshot;
  const assets = useMemo(
    () =>
      snapshot
        ? (Object.entries(snapshot.positions)
            .filter(([, position]) => position.quantityMilliAsset > 0)
            .map(([asset]) => asset) as PaperAsset[])
        : [],
    [snapshot]
  );
  const assetKey = assets.join(",");

  useEffect(() => {
    if (!active || !assets.length) return;
    let cancelled = false;
    const controller = new AbortController();
    const refreshPrices = async () => {
      const results = await Promise.allSettled(
        assets.map(async (asset) => {
          const response = await fetch(
            `/api/market/${asset.toLowerCase()}-usd`,
            { cache: "no-store", signal: controller.signal }
          );
          if (!response.ok) throw new Error("unavailable");
          const data = (await response.json()) as { priceCents: number };
          if (!Number.isSafeInteger(data.priceCents) || data.priceCents <= 0)
            throw new Error("invalid");
          return { asset, priceCents: data.priceCents };
        })
      );
      if (cancelled) return;
      const failed: PaperAsset[] = [];
      setMarket((current) => {
        const next = { ...current };
        results.forEach((result, index) => {
          const asset = assets[index];
          if (result.status === "fulfilled")
            next[asset] = {
              ...next[asset],
              priceCents: result.value.priceCents,
              candles: next[asset]?.candles ?? null,
            };
          else {
            failed.push(asset);
            next[asset] = {
              ...next[asset],
              priceCents: null,
              candles: next[asset]?.candles ?? null,
            };
          }
        });
        return next;
      });
      setErrors(failed);
    };
    void refreshPrices();
    const timer = window.setInterval(() => void refreshPrices(), 5000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [active, assetKey, assets, retry]);

  useEffect(() => {
    if (!active || !assets.length) return;
    let cancelled = false;
    const controller = new AbortController();
    const refreshHistory = async () => {
      const results = await Promise.allSettled(
        assets.map(async (asset) => {
          const response = await fetch(
            `/api/market/${asset.toLowerCase()}-usd/history?range=1D`,
            { cache: "no-store", signal: controller.signal }
          );
          if (!response.ok) throw new Error("unavailable");
          const data = (await response.json()) as { candles?: HistoryCandle[] };
          if (!data.candles?.length) throw new Error("empty");
          return { asset, candles: data.candles };
        })
      );
      if (cancelled) return;
      setMarket((current) => {
        const next = { ...current };
        results.forEach((result, index) => {
          if (result.status === "fulfilled")
            next[result.value.asset] = {
              priceCents: next[result.value.asset]?.priceCents ?? null,
              candles: result.value.candles,
            };
          else
            next[assets[index]] = {
              priceCents: next[assets[index]]?.priceCents ?? null,
              candles: null,
            };
        });
        return next;
      });
    };
    void refreshHistory();
    const timer = window.setInterval(() => void refreshHistory(), 60_000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [active, assetKey, assets, retry]);

  const rows = useMemo(
    () => (snapshot ? analyzePortfolio(snapshot, market) : []),
    [snapshot, market]
  );
  const spotlights = useMemo(() => selectSpotlights(rows), [rows]);
  const loading = assets.some((asset) => market[asset] === undefined);
  const knownInvested = rows.reduce(
    (sum, row) => sum + (row.marketValueCents ?? 0),
    0
  );
  const fullData = rows.every((row) => row.priceCents !== null);
  const equity = snapshot ? snapshot.usdcCents + knownInvested : 0;
  const pnl = snapshot ? equity - snapshot.startEquityCents : 0;

  return (
    <section className="page-shell portfolio-workspace" aria-label="Portfolio">
      <div className="workspace-top">
        <span>
          <strong>Your paper portfolio.</strong> · Compare every owned asset in
          one place.
        </span>
        <span className="tag">ON-CHAIN · DEVNET</span>
      </div>
      <PaperChainPanel chain={chain} />
      {chain.status !== "ready" ? (
        <section className="portfolio-state panel">
          <IconChartPie size={28} />
          <h1>
            {chain.status === "disconnected"
              ? "Connect your wallet"
              : chain.status === "none"
                ? "Open your paper portfolio"
                : chain.status === "loading"
                  ? "Loading on-chain portfolio…"
                  : "Portfolio unavailable"}
          </h1>
          <p>
            Your canonical devnet account is read independently here. No local
            balances are substituted.
          </p>
        </section>
      ) : rows.length === 0 ? (
        <section className="portfolio-state panel">
          <IconChartPie size={28} />
          <h1>Your portfolio is all USDC</h1>
          <p>
            You have {money(snapshot!.usdcCents)} available. Buy an asset in
            Paper Trading to start tracking performance.
          </p>
          <button className="btn primary" onClick={() => onTradeAsset("SOL")}>
            Trade SOL <IconArrowRight size={15} />
          </button>
        </section>
      ) : (
        <>
          <div className="portfolio-summary panel">
            <Metric
              label={`TOTAL VALUE${fullData ? "" : " · PARTIAL"}`}
              value={money(equity)}
              detail={
                fullData ? "Live marked value" : "Excludes unavailable prices"
              }
            />
            <Metric
              label="TOTAL P&L"
              value={fullData ? signedMoney(pnl) : "Partial"}
              detail={
                fullData && snapshot!.startEquityCents
                  ? pct((pnl / snapshot!.startEquityCents) * 100)
                  : "Waiting for all prices"
              }
              tone={fullData ? (pnl >= 0 ? "profit" : "loss") : undefined}
            />
            <Metric
              label="AVAILABLE USDC"
              value={money(snapshot!.usdcCents)}
              detail="Buying power"
            />
            <Metric
              label="INVESTED VALUE"
              value={money(knownInvested)}
              detail={`${rows.length} owned asset${rows.length === 1 ? "" : "s"}`}
            />
          </div>
          {(loading || errors.length > 0) && (
            <div className="notice" role="status">
              <span>
                {loading
                  ? "Loading live portfolio prices…"
                  : `Live data unavailable for ${errors.join(", ")}. Totals are partial.`}
              </span>
              {!loading && (
                <button
                  className="btn ghost notice-action"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  <IconRefresh size={14} /> Retry
                </button>
              )}
            </div>
          )}
          <section
            className="portfolio-spotlights"
            aria-label="Portfolio insights"
          >
            <Spotlight
              label="BEST PERFORMER"
              row={spotlights.best}
              value={
                spotlights.best ? pct(spotlights.best.unrealizedPercent) : "—"
              }
            />
            <Spotlight
              label="NEEDS ATTENTION"
              row={spotlights.needsAttention}
              value={
                spotlights.needsAttention
                  ? pct(spotlights.needsAttention.unrealizedPercent)
                  : "No negative positions"
              }
            />
            <Spotlight
              label="STRONGEST 1D MOMENTUM"
              row={spotlights.momentum}
              value={
                spotlights.momentum
                  ? pct(spotlights.momentum.dayChangePercent)
                  : "—"
              }
            />
          </section>
          <section className="portfolio-allocation panel">
            <div className="portfolio-section-heading">
              <div>
                <p className="eyebrow">EXPOSURE</p>
                <h2>Allocation</h2>
              </div>
              <small>Based on holdings with available live prices</small>
            </div>
            <div className="allocation-list">
              {rows.map((row) => (
                <div key={row.asset}>
                  <span>
                    <b>{row.asset}</b>
                    <em>
                      {row.allocationPercent === null
                        ? "—"
                        : `${row.allocationPercent.toFixed(1)}%`}
                    </em>
                  </span>
                  <i>
                    <b style={{ width: `${row.allocationPercent ?? 0}%` }} />
                  </i>
                </div>
              ))}
            </div>
          </section>
          <section className="portfolio-holdings panel">
            <div className="portfolio-section-heading">
              <div>
                <p className="eyebrow">POSITIONS</p>
                <h2>Holdings</h2>
              </div>
              <small>
                Momentum is based on 1-day price movement—not a prediction.
              </small>
            </div>
            <div className="portfolio-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Quantity</th>
                    <th>Avg cost</th>
                    <th>Live price</th>
                    <th>Market value</th>
                    <th>Allocation</th>
                    <th>Unrealized P&L</th>
                    <th>1-day</th>
                    <th>Signals</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.asset}>
                      <td>
                        <span className="holding-asset">
                          <AssetLogo asset={row.asset} size={22} />
                          <b>{row.asset}</b>
                        </span>
                      </td>
                      <td>
                        {(row.quantityMilliAsset / 1000).toLocaleString(
                          "en-US",
                          { maximumFractionDigits: 3 }
                        )}
                      </td>
                      <td>
                        {row.averageCostCents === null
                          ? "—"
                          : money(row.averageCostCents)}
                      </td>
                      <td>
                        {row.priceCents === null
                          ? "Unavailable"
                          : money(row.priceCents, 3)}
                      </td>
                      <td>
                        {row.marketValueCents === null
                          ? "—"
                          : money(row.marketValueCents)}
                      </td>
                      <td>
                        {row.allocationPercent === null
                          ? "—"
                          : `${row.allocationPercent.toFixed(1)}%`}
                      </td>
                      <td
                        className={
                          row.unrealizedPnlCents === null
                            ? ""
                            : row.unrealizedPnlCents >= 0
                              ? "profit-text"
                              : "loss-text"
                        }
                      >
                        {row.unrealizedPnlCents === null ? (
                          "—"
                        ) : (
                          <>
                            {signedMoney(row.unrealizedPnlCents)}{" "}
                            <small>{pct(row.unrealizedPercent)}</small>
                          </>
                        )}
                      </td>
                      <td
                        className={
                          row.dayChangePercent === null
                            ? ""
                            : row.dayChangePercent >= 0
                              ? "profit-text"
                              : "loss-text"
                        }
                      >
                        {pct(row.dayChangePercent)}
                      </td>
                      <td>
                        <span
                          className={`signal-badge ${row.momentum ?? "unavailable"}`}
                        >
                          {row.momentum
                            ? MOMENTUM_LABEL[row.momentum]
                            : "Unavailable"}
                        </span>
                        <span
                          className={`signal-badge volatility ${row.volatility ?? "unavailable"}`}
                        >
                          {row.volatility
                            ? `${row.volatility[0].toUpperCase()}${row.volatility.slice(1)} volatility`
                            : "No range"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn ghost compact"
                          onClick={() => onTradeAsset(row.asset)}
                        >
                          Trade
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function Spotlight({
  label,
  row,
  value,
}: {
  label: string;
  row: ReturnType<typeof selectSpotlights>["best"];
  value: string;
}) {
  return (
    <article className="panel">
      <p className="eyebrow">{label}</p>
      <div>
        {row && <AssetLogo asset={row.asset} size={24} />}
        <strong>{row?.asset ?? "—"}</strong>
      </div>
      <b>{value}</b>
    </article>
  );
}
