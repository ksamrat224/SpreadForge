"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsSort,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import type {
  LiveMarket,
  LiveMarketsSnapshot,
  MarketCategory,
} from "../lib/live-markets";
import { PAPER_ASSETS, type PaperAsset } from "../lib/simulation/paper";
import { Metric } from "./terminal-ui";

const REFRESH_MS = 10_000;
/** Prices older than this are shown as delayed rather than live. */
const STALE_MS = 60_000;

type Filter = "all" | MarketCategory;
type SortKey =
  | "symbol"
  | "priceUsd"
  | "change24hPercent"
  | "volume24hUsd"
  | "liquidityUsd"
  | "marketCapUsd";
type Sort = { key: SortKey; descending: boolean };
type Move = "up" | "down";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "stocks", label: "Stocks" },
  { value: "crypto", label: "Crypto" },
  { value: "memecoins", label: "Memecoins" },
];
const CATEGORY_LABEL: Record<MarketCategory, string> = {
  stocks: "Stock",
  crypto: "Crypto",
  memecoins: "Memecoin",
};
const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "priceUsd", label: "Price" },
  { key: "change24hPercent", label: "24h" },
  { key: "volume24hUsd", label: "24h volume" },
  { key: "liquidityUsd", label: "Liquidity" },
  { key: "marketCapUsd", label: "Market cap" },
];

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

export function formatMarketPrice(value: number) {
  // Sub-cent tokens keep four significant digits instead of rounding to $0.00.
  const options: Intl.NumberFormatOptions =
    value >= 1
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : value >= 0.01
        ? { minimumFractionDigits: 4, maximumFractionDigits: 4 }
        : { maximumSignificantDigits: 4 };
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    ...options,
  });
}

const formatCompact = (value: number | null) =>
  value === null ? "—" : compactUsd.format(value);
const formatChange = (value: number | null) =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const changeTone = (value: number | null) =>
  value === null ? "muted" : value >= 0 ? "profit" : "loss";
const isPaperAsset = (symbol: string): symbol is PaperAsset =>
  (PAPER_ASSETS as readonly string[]).includes(symbol);

export function LiveMarkets({
  active = true,
  onTradeAsset,
}: {
  active?: boolean;
  onTradeAsset?: (asset: PaperAsset) => void;
}) {
  // The latest prices, plus which way each one moved since the last read.
  const [feed, setFeed] = useState<{
    snapshot: LiveMarketsSnapshot;
    moves: Record<string, Move>;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [delayed, setDelayed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({
    key: "volume24hUsd",
    descending: true,
  });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/live-markets", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("unavailable");
        const next = (await response.json()) as LiveMarketsSnapshot;
        if (cancelled || !Array.isArray(next.markets)) return;
        setFeed((previous) => {
          // Remember which way each price moved so the cell can flash once.
          const before = new Map(
            previous?.snapshot.markets.map((market) => [
              market.id,
              market.priceUsd,
            ])
          );
          const moves: Record<string, Move> = {};
          for (const market of next.markets) {
            const last = before.get(market.id);
            if (last !== undefined && last !== market.priceUsd)
              moves[market.id] = market.priceUsd > last ? "up" : "down";
          }
          return { snapshot: next, moves };
        });
        setFailed(false);
        setDelayed(Date.now() - next.asOf > STALE_MS);
      } catch {
        if (cancelled) return;
        // Keep showing the last prices, marked as delayed, while retrying.
        setFailed(true);
        setDelayed(true);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [active, retry]);

  const snapshot = feed?.snapshot ?? null;
  const moves = feed?.moves ?? {};
  const markets = snapshot?.markets;
  const counts = useMemo(() => {
    const result: Record<Filter, number> = {
      all: markets?.length ?? 0,
      stocks: 0,
      crypto: 0,
      memecoins: 0,
    };
    for (const market of markets ?? []) result[market.category] += 1;
    return result;
  }, [markets]);
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    const rows = (markets ?? []).filter(
      (market) =>
        (filter === "all" || market.category === filter) &&
        (!search ||
          `${market.symbol} ${market.name}`.toLowerCase().includes(search))
    );
    const direction = sort.descending ? -1 : 1;
    return rows.sort((a, b) => {
      if (sort.key === "symbol")
        return direction * a.symbol.localeCompare(b.symbol);
      const left = a[sort.key];
      const right = b[sort.key];
      // Markets missing a value always sink to the bottom.
      if (left === null || right === null)
        return left === right ? 0 : left === null ? 1 : -1;
      return direction * (left - right);
    });
  }, [filter, markets, query, sort]);
  const summary = useMemo(() => {
    const scope = (markets ?? []).filter(
      (market) => filter === "all" || market.category === filter
    );
    const movers = scope
      .filter((market) => market.change24hPercent !== null)
      .sort((a, b) => b.change24hPercent! - a.change24hPercent!);
    return {
      volume: scope.reduce(
        (total, market) => total + (market.volume24hUsd ?? 0),
        0
      ),
      gainer: movers[0] ?? null,
      loser: movers.at(-1) ?? null,
    };
  }, [filter, markets]);

  const changeSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, descending: !current.descending }
        : { key, descending: key !== "symbol" }
    );
  const sortLabel = (key: SortKey): "none" | "ascending" | "descending" =>
    sort.key !== key ? "none" : sort.descending ? "descending" : "ascending";
  return (
    <section className="page-shell live-markets" aria-label="Markets">
      <div className="stat-row">
        <div className="stat">
          <Metric label="MARKETS" value={snapshot ? counts[filter] : "—"} />
        </div>
        <div className="stat">
          <Metric
            label="24H VOLUME"
            value={snapshot ? formatCompact(summary.volume) : "—"}
          />
        </div>
        <div className="stat">
          <Metric
            label="TOP GAINER"
            value={summary.gainer?.symbol ?? "—"}
            detail={
              summary.gainer
                ? formatChange(summary.gainer.change24hPercent)
                : undefined
            }
            tone={summary.gainer ? "profit" : ""}
          />
        </div>
        <div className="stat">
          <Metric
            label="TOP LOSER"
            value={summary.loser?.symbol ?? "—"}
            detail={
              summary.loser
                ? formatChange(summary.loser.change24hPercent)
                : undefined
            }
            tone={summary.loser ? "loss" : ""}
          />
        </div>
      </div>

      {snapshot && delayed && (
        <div className="notice" role="status">
          <span>
            Live prices are delayed. Showing the last update from{" "}
            {new Date(snapshot.asOf).toLocaleTimeString()}; retrying
            automatically.
          </span>
        </div>
      )}

      <section className="panel markets-panel">
        <div className="markets-toolbar">
          <div className="rank-tabs" aria-label="Market category">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                className={filter === item.value ? "active" : ""}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                <span className="tab-count">{counts[item.value]}</span>
              </button>
            ))}
          </div>
          <div className="markets-toolbar-end">
            <span
              className={`live ${snapshot && !delayed ? "" : "idle"}`}
              role="status"
            >
              <i />
              {!snapshot
                ? failed
                  ? "UNAVAILABLE"
                  : "CONNECTING"
                : delayed
                  ? "DELAYED"
                  : "LIVE"}
            </span>
            <label className="market-search">
              <IconSearch size={15} />
              <span className="sr-only">Search markets</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by ticker or name"
              />
            </label>
          </div>
        </div>

        {!snapshot ? (
          failed ? (
            <div className="empty-state roomy" role="alert">
              Live market prices are temporarily unavailable.
              <button
                className="btn small"
                type="button"
                onClick={() => {
                  setFailed(false);
                  setRetry((value) => value + 1);
                }}
              >
                <IconRefresh size={14} /> Retry
              </button>
            </div>
          ) : (
            <MarketsSkeleton />
          )
        ) : !visible.length ? (
          <div className="empty-state roomy">
            No markets match “{query.trim()}”.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="market-table">
              <thead>
                <tr>
                  <th aria-sort={sortLabel("symbol")}>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => changeSort("symbol")}
                    >
                      Market <SortIcon sort={sort} column="symbol" />
                    </button>
                  </th>
                  <th>Category</th>
                  {COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      className="numeric"
                      aria-sort={sortLabel(column.key)}
                    >
                      <button
                        type="button"
                        className="sort-button"
                        onClick={() => changeSort(column.key)}
                      >
                        {column.label}{" "}
                        <SortIcon sort={sort} column={column.key} />
                      </button>
                    </th>
                  ))}
                  {onTradeAsset && <th aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {visible.map((market) => (
                  <tr key={market.id}>
                    <td>
                      <span className="market-cell">
                        <MarketIcon market={market} />
                        <span>
                          <strong>{market.symbol}</strong>
                          <small>{market.name}</small>
                        </span>
                      </span>
                    </td>
                    <td className="muted">{CATEGORY_LABEL[market.category]}</td>
                    <td className="numeric">
                      <span
                        key={market.priceUsd}
                        className={`price-tick ${moves[market.id] ?? ""}`}
                      >
                        {formatMarketPrice(market.priceUsd)}
                      </span>
                    </td>
                    <td
                      className={`numeric ${changeTone(market.change24hPercent)}`}
                    >
                      {formatChange(market.change24hPercent)}
                    </td>
                    <td className="numeric">
                      {formatCompact(market.volume24hUsd)}
                    </td>
                    <td className="numeric">
                      {formatCompact(market.liquidityUsd)}
                    </td>
                    <td className="numeric">
                      {formatCompact(market.marketCapUsd)}
                    </td>
                    {onTradeAsset && (
                      <td className="numeric">
                        {isPaperAsset(market.symbol) && (
                          <button
                            type="button"
                            className="btn ghost compact"
                            onClick={() =>
                              onTradeAsset(market.symbol as PaperAsset)
                            }
                          >
                            Paper trade
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="sample-note">
          Prices from Jupiter, refreshed every {REFRESH_MS / 1000}s
          {snapshot &&
            ` · updated ${new Date(snapshot.asOf).toLocaleTimeString()}`}
        </p>
      </section>
    </section>
  );
}

function SortIcon({ sort, column }: { sort: Sort; column: SortKey }) {
  if (sort.key !== column) return <IconArrowsSort size={13} />;
  return sort.descending ? (
    <IconArrowDown size={13} />
  ) : (
    <IconArrowUp size={13} />
  );
}

function MarketIcon({ market }: { market: LiveMarket }) {
  // Token logos live on arbitrary hosts and some refuse to be embedded, so a
  // failed logo falls back to the mint's DexScreener image, then to initials.
  const sources = [
    market.icon,
    `https://dd.dexscreener.com/ds-data/tokens/solana/${market.id}.png`,
  ].filter((source): source is string => !!source);
  const [failures, setFailures] = useState(0);
  if (failures >= sources.length)
    return (
      <span className="market-icon fallback" aria-hidden="true">
        {market.symbol.slice(0, 2).toUpperCase()}
      </span>
    );
  return (
    // Remote logos bypass the image optimizer, which only allows known hosts.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="market-icon"
      src={sources[failures]}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      onError={() => setFailures((count) => count + 1)}
    />
  );
}

function MarketsSkeleton() {
  return (
    <div
      className="table-scroll leaderboard-skeleton"
      aria-busy="true"
      aria-label="Loading live markets"
    >
      <table className="market-table">
        <tbody>
          {Array.from({ length: 8 }, (_, index) => (
            <tr key={index}>
              <td>
                <div className="trader">
                  <span className="skeleton-avatar" />
                  <div>
                    <span className="skeleton-line skeleton-wallet" />
                    <span className="skeleton-line skeleton-time" />
                  </div>
                </div>
              </td>
              {Array.from({ length: 5 }, (_, cell) => (
                <td key={cell} className="numeric">
                  <span className="skeleton-line skeleton-score" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <span className="sr-only">Loading live market prices.</span>
    </div>
  );
}
