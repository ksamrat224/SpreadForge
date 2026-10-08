"use client";

import { IconSearch, IconStar, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { PAPER_ASSETS, type PaperAsset } from "../lib/simulation/paper";

type Market = {
  id: string;
  symbol: string;
  base: string;
  quote: "USD";
  displayName: string;
  tradable: boolean;
  solana: boolean;
};
type Filter = "all" | "tradable" | "solana" | "watchlist";
const STORAGE_KEY = "spreadforge-market-watchlist-v1";

export function MarketExplorer({
  activeAsset,
  onSelectMarket,
}: {
  activeAsset: PaperAsset;
  onSelectMarket: (asset: PaperAsset) => void;
}) {
  const [open, setOpen] = useState(false);
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      return Array.isArray(saved)
        ? saved.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [preview, setPreview] = useState<Market | null>(null);
  const [quote, setQuote] = useState<{
    id: string;
    price: number | null;
  } | null>(null);

  useEffect(
    () => localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist)),
    [watchlist]
  );
  useEffect(() => {
    if (!open || markets) return;
    let cancelled = false;
    fetch("/api/markets")
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return (await response.json()).markets as Market[];
      })
      .then((items) => !cancelled && setMarkets(items))
      .catch(
        () =>
          !cancelled && setError("Market catalog is temporarily unavailable.")
      );
    return () => {
      cancelled = true;
    };
  }, [open, markets]);
  useEffect(() => {
    if (!preview || preview.tradable) return;
    let cancelled = false;
    fetch(`/api/markets/${encodeURIComponent(preview.id)}/quote`)
      .then(async (response) =>
        response.ok ? ((await response.json()).price as number) : null
      )
      .then((price) => !cancelled && setQuote({ id: preview.id, price }))
      .catch(() => !cancelled && setQuote({ id: preview.id, price: null }));
    return () => {
      cancelled = true;
    };
  }, [preview]);
  const visible = useMemo(
    () =>
      (markets ?? []).filter((market) => {
        const search = `${market.symbol} ${market.displayName}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matches =
          filter === "all" ||
          (filter === "tradable" && market.tradable) ||
          (filter === "solana" && market.solana) ||
          (filter === "watchlist" && watchlist.includes(market.id));
        return search && matches;
      }),
    [filter, markets, query, watchlist]
  );
  const toggleWatch = (id: string) =>
    setWatchlist((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id]
    );
  const choose = (market: Market) => {
    setPreview(market);
    if (market.tradable && PAPER_ASSETS.includes(market.base as PaperAsset)) {
      onSelectMarket(market.base as PaperAsset);
      setOpen(false);
    }
  };
  return (
    <>
      <button
        type="button"
        className="btn ghost market-explorer-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <IconSearch size={15} /> Explore markets
      </button>
      {open && (
        <div
          className="market-explorer-backdrop"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <section
            className="market-explorer"
            role="dialog"
            aria-modal="true"
            aria-label="Market Explorer"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>PYTH CRYPTO / USD</small>
                <h2>Market Explorer</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close Market Explorer"
                onClick={() => setOpen(false)}
              >
                <IconX size={18} />
              </button>
            </header>
            <label className="market-search">
              <IconSearch size={15} />
              <span className="sr-only">Search markets</span>
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search assets"
              />
            </label>
            <div className="market-filters" aria-label="Market filters">
              {(["all", "tradable", "solana", "watchlist"] as Filter[]).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={filter === item}
                    className={filter === item ? "active" : ""}
                    onClick={() => setFilter(item)}
                  >
                    {item === "all"
                      ? "All"
                      : item === "solana"
                        ? "Solana"
                        : item[0].toUpperCase() + item.slice(1)}
                  </button>
                )
              )}
            </div>
            {error ? (
              <div className="notice" role="status">
                {error}
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setError("");
                    setMarkets(null);
                  }}
                >
                  Retry
                </button>
              </div>
            ) : !markets ? (
              <p className="market-explorer-state">
                Loading Pyth crypto markets…
              </p>
            ) : (
              <div className="market-explorer-content">
                <div
                  className="market-list"
                  role="listbox"
                  aria-label="Pyth crypto markets"
                >
                  {visible.length ? (
                    visible.map((market) => (
                      <div key={market.id} className="market-row-wrap">
                        <button
                          type="button"
                          role="option"
                          aria-selected={
                            preview?.id === market.id ||
                            (market.tradable && market.base === activeAsset)
                          }
                          className="market-row"
                          onClick={() => choose(market)}
                        >
                          <span>
                            <strong>{market.symbol}</strong>
                            <small>{market.displayName}</small>
                          </span>
                          <span
                            className={
                              market.tradable
                                ? "market-capability tradable"
                                : "market-capability"
                            }
                          >
                            {market.tradable ? "Paper trade" : "Quote only"}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="market-star"
                          aria-label={`${watchlist.includes(market.id) ? "Remove" : "Add"} ${market.symbol} ${watchlist.includes(market.id) ? "from" : "to"} watchlist`}
                          onClick={() => toggleWatch(market.id)}
                        >
                          <IconStar
                            size={15}
                            fill={
                              watchlist.includes(market.id)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="market-explorer-state">
                      No markets match this filter.
                    </p>
                  )}
                </div>
                {preview && !preview.tradable && (
                  <aside className="market-preview">
                    <small>PYTH REFERENCE</small>
                    <h3>{preview.symbol}</h3>
                    <strong>
                      {quote?.id !== preview.id || quote.price === null
                        ? "Quote unavailable"
                        : quote.price.toLocaleString(undefined, {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 8,
                          })}
                    </strong>
                    <p>
                      Quote-only markets are available to explore. Trading needs
                      verified candles and order-book coverage.
                    </p>
                  </aside>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
