"use client";
import { useEffect, useState } from "react";
import LogoLoop, { type LogoItem } from "../reactbits/LogoLoop";
import { AssetLogo } from "../crypto-logos";
import { usd } from "./scenario-runs";
import type { PaperAsset } from "../../lib/simulation/paper";

const MARKETS: PaperAsset[] = [
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "AVAX",
  "LINK",
  "SUI",
  "DOGE",
  "ADA",
  "DOT",
];

type Quote = { priceCents: number; source: string } | null;

/** Live reference prices from the same API route the Paper Desk uses. */
function useLiveQuotes() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  useEffect(() => {
    let alive = true;
    const load = () =>
      MARKETS.forEach(async (asset) => {
        try {
          const response = await fetch(
            `/api/market/${asset.toLowerCase()}-usd`,
            {
              cache: "no-store",
            }
          );
          if (!response.ok) throw new Error();
          const body = (await response.json()) as {
            priceCents?: number;
            source?: string;
          };
          if (!body.priceCents) throw new Error();
          const quote = {
            priceCents: body.priceCents,
            source: body.source ?? "live",
          };
          if (alive) setQuotes((current) => ({ ...current, [asset]: quote }));
        } catch {
          if (alive)
            setQuotes((current) => ({
              ...current,
              [asset]: current[asset] ?? null,
            }));
        }
      });
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);
  return quotes;
}

export function MarketTicker() {
  const quotes = useLiveQuotes();
  const items: LogoItem[] = MARKETS.map((asset) => {
    const quote = quotes[asset];
    return {
      title: `${asset}/USD`,
      node: (
        <span className="landing-tick">
          <AssetLogo asset={asset} size={18} />
          <b>{asset}/USD</b>
          <span className="mono">
            {quote
              ? usd(quote.priceCents, quote.priceCents < 1_000 ? 4 : 2)
              : quote === null
                ? "unavailable"
                : "loading…"}
          </span>
          {quote && (
            <small className="mono">{quote.source.toUpperCase()}</small>
          )}
        </span>
      ),
    };
  });
  return (
    <section aria-label="Live reference prices" className="landing-ticker">
      <span className="landing-ticker-label mono">
        <span className="status-dot" /> LIVE REFERENCE
      </span>
      <LogoLoop
        logos={items}
        speed={42}
        gap={44}
        logoHeight={22}
        pauseOnHover
        fadeOut
        fadeOutColor="var(--background)"
        ariaLabel="Live market reference prices"
      />
    </section>
  );
}
