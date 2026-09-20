"use client";

import { useEffect, useMemo, useState } from "react";

type Quote = {
  id: string;
  side: "buy" | "sell";
  priceCents: number;
  createdAt: number;
};
type Trade = {
  side: "buy" | "sell";
  priceCents: number;
  createdAt: number;
  source: "Market" | "Limit";
};
type PricePoint = { priceCents: number; at: number };

const STARTING_SOL_MILLI = 10_000;
const STARTING_USDC_CENTS = 150_000;
const money = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PaperTradingDesk() {
  const [price, setPrice] = useState<PricePoint>({
    priceCents: 15_000,
    at: Date.now(),
  });
  const [points, setPoints] = useState<PricePoint[]>([price]);
  const [isLive, setIsLive] = useState(false);
  const [solMilli, setSolMilli] = useState(STARTING_SOL_MILLI);
  const [usdcCents, setUsdcCents] = useState(STARTING_USDC_CENTS);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [quotePrice, setQuotePrice] = useState("150.00");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await fetch("/api/market/sol-usd", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Live feed unavailable");
        const data = (await response.json()) as {
          priceCents: number;
          publishedAt: number;
        };
        if (!active) return;
        const next = { priceCents: data.priceCents, at: data.publishedAt };
        setPrice(next);
        setPoints((current) => [...current.slice(-59), next]);
        setIsLive(true);
        setError(null);
      } catch {
        if (!active) return;
        const demo = {
          priceCents: 15_000 + Math.round(Math.sin(Date.now() / 18_000) * 120),
          at: Date.now(),
        };
        setPrice(demo);
        setPoints((current) => [...current.slice(-59), demo]);
        setIsLive(false);
        setError("Live feed unavailable — showing demo price.");
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    quotes.forEach((quote) => {
      const fills =
        quote.side === "buy"
          ? price.priceCents <= quote.priceCents
          : price.priceCents >= quote.priceCents;
      if (fills) execute(quote.side, quote.priceCents, "Limit", quote.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price.priceCents]);

  const equityCents =
    usdcCents + Math.round((solMilli * price.priceCents) / 1000);
  const pnlCents =
    equityCents -
    (STARTING_USDC_CENTS +
      Math.round((STARTING_SOL_MILLI * points[0].priceCents) / 1000));
  const chart = useMemo(() => candles(points), [points]);
  function execute(
    side: "buy" | "sell",
    executionPrice: number,
    source: Trade["source"],
    quoteId?: string
  ) {
    const amountCents = executionPrice;
    if (side === "buy" && usdcCents >= amountCents) {
      setUsdcCents((value) => value - amountCents);
      setSolMilli((value) => value + 1000);
    } else if (side === "sell" && solMilli >= 1000) {
      setUsdcCents((value) => value + amountCents);
      setSolMilli((value) => value - 1000);
    } else {
      setError(
        side === "buy"
          ? "Not enough simulated USDC for 1 SOL."
          : "Not enough simulated SOL to sell."
      );
      return;
    }
    setTrades((current) =>
      [
        { side, priceCents: executionPrice, createdAt: Date.now(), source },
        ...current,
      ].slice(0, 8)
    );
    if (quoteId)
      setQuotes((current) => current.filter((quote) => quote.id !== quoteId));
  }
  function addQuote(side: "buy" | "sell") {
    const priceCents = Math.round(Number(quotePrice) * 100);
    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      setError("Enter a valid quote price.");
      return;
    }
    setQuotes((current) => [
      ...current,
      { id: `${Date.now()}-${side}`, side, priceCents, createdAt: Date.now() },
    ]);
    setError(null);
  }

  return (
    <section className="space-y-5" aria-label="Paper Trading">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-5 py-4 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">
            Paper Trading
          </p>
          <h2 className="mt-1 text-xl font-bold">Practice with fake funds.</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${isLive ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}
        >
          {isLive ? "LIVE SOL/USD REFERENCE" : "DEMO PRICE FALLBACK"}
        </span>
      </div>
      {error && (
        <div className="rounded-xl border border-warning/20 bg-warning-soft px-4 py-3 text-sm text-warning">
          {error}
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-muted">SOL / USD</p>
              <p className="mt-1 font-mono text-4xl font-bold">
                {money(price.priceCents)}
              </p>
            </div>
            <p className="text-right text-xs text-muted">
              Updated {new Date(price.at).toLocaleTimeString()}
              <br />
              {isLive ? "Pyth reference" : "Simulation fallback"}
            </p>
          </div>
          <div className="mt-7 h-64 rounded-xl border bg-background p-3">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="h-full w-full"
              aria-label="SOL one-minute candle chart"
              role="img"
            >
              {chart.map((candle) => (
                <g key={candle.minute}>
                  <line
                    x1={candle.x}
                    x2={candle.x}
                    y1={candle.highY}
                    y2={candle.lowY}
                    stroke="currentColor"
                    className="text-primary"
                    vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={candle.x - candle.width / 2}
                    y={Math.min(candle.openY, candle.closeY)}
                    width={candle.width}
                    height={Math.max(1, Math.abs(candle.openY - candle.closeY))}
                    className={
                      candle.close >= candle.open
                        ? "fill-success"
                        : "fill-destructive"
                    }
                  />
                </g>
              ))}
            </svg>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => execute("buy", price.priceCents, "Market")}
              className="min-h-11 rounded-lg bg-success px-4 py-3 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-ring"
            >
              Buy 1 simulated SOL
            </button>
            <button
              onClick={() => execute("sell", price.priceCents, "Market")}
              className="min-h-11 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-bold text-destructive focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sell 1 simulated SOL
            </button>
          </div>
        </main>
        <aside className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">
            Portfolio
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric label="SOL" value={(solMilli / 1000).toFixed(2)} />
            <Metric label="USDC" value={money(usdcCents)} />
            <Metric label="Value" value={money(equityCents)} />
            <Metric
              label="P&L"
              value={`${pnlCents >= 0 ? "+" : ""}${money(pnlCents)}`}
            />
          </div>
          <div className="mt-6 border-t pt-5">
            <label className="text-sm font-semibold">
              Limit quote price
              <input
                value={quotePrice}
                onChange={(event) => setQuotePrice(event.target.value)}
                inputMode="decimal"
                className="mt-2 min-h-11 w-full rounded-lg border bg-background px-3 focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => addQuote("buy")}
                className="min-h-10 flex-1 rounded-lg bg-secondary text-sm font-bold text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                Place buy
              </button>
              <button
                onClick={() => addQuote("sell")}
                className="min-h-10 flex-1 rounded-lg bg-secondary text-sm font-bold text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                Place sell
              </button>
            </div>
          </div>
        </aside>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Activity
          title="Open simulated quotes"
          empty="No limit quotes. Add one to practice waiting for a fill."
        >
          {quotes.map((quote) => (
            <div
              key={quote.id}
              className="flex items-center justify-between rounded-lg border bg-background p-3 text-sm"
            >
              <span className="font-semibold capitalize">
                {quote.side} 1 SOL at {money(quote.priceCents)}
              </span>
              <button
                onClick={() =>
                  setQuotes((current) =>
                    current.filter((item) => item.id !== quote.id)
                  )
                }
                className="min-h-9 rounded-md px-2 font-semibold text-destructive focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cancel
              </button>
            </div>
          ))}
        </Activity>
        <Activity
          title="Trade & fill history"
          empty="No simulated trades yet. Buy, sell, or place a quote to begin."
        >
          {trades.map((trade, index) => (
            <div
              key={`${trade.createdAt}-${index}`}
              className="rounded-lg border bg-background p-3 text-sm"
            >
              <span className="font-semibold capitalize">
                {trade.side} 1 SOL
              </span>{" "}
              <span className="text-muted">
                at {money(trade.priceCents)} · {trade.source}
              </span>
            </div>
          ))}
        </Activity>
      </div>
    </section>
  );
}

function candles(points: PricePoint[]) {
  const groups = new Map<number, PricePoint[]>();
  points.forEach((point) => {
    const minute = Math.floor(point.at / 60_000) * 60_000;
    groups.set(minute, [...(groups.get(minute) ?? []), point]);
  });
  const values = points.map((point) => point.priceCents);
  const min = Math.min(...values) - 10;
  const max = Math.max(...values) + 10;
  const range = Math.max(1, max - min);
  const y = (value: number) => 100 - ((value - min) / range) * 88 - 6;
  const items = [...groups.entries()].map(([minute, entries]) => ({
    minute,
    open: entries[0].priceCents,
    close: entries.at(-1)!.priceCents,
    high: Math.max(...entries.map((entry) => entry.priceCents)),
    low: Math.min(...entries.map((entry) => entry.priceCents)),
  }));
  return items.map((item, index) => ({
    ...item,
    x: ((index + 0.5) / items.length) * 100,
    width: Math.min(12, 70 / items.length),
    openY: y(item.open),
    closeY: y(item.close),
    highY: y(item.high),
    lowY: y(item.low),
  }));
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-bold">{value}</p>
    </div>
  );
}
function Activity({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <h3 className="font-bold">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.filter(Boolean).length ? (
          children
        ) : (
          <p className="rounded-lg bg-secondary/60 p-4 text-sm text-muted">
            {empty}
          </p>
        )}
      </div>
    </section>
  );
}
