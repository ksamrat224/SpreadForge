import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaperTradingDesk } from "./paper-trading-desk";

vi.mock("./interactive-market-chart", () => ({
  InteractiveMarketChart: () => <div data-testid="market-chart" />,
}));

function liveResponse(url: string) {
  if (url.includes("/history"))
    return { ok: false, json: async () => ({}) };
  if (url.includes("/book"))
    return {
      ok: true,
      json: async () => ({
        source: "pyth",
        at: Date.now(),
        bids: [{ priceCents: 15_000, size: 1 }],
        asks: [{ priceCents: 15_100, size: 1 }],
      }),
    };
  return {
    ok: true,
    json: async () => ({
      priceCents: 15_000,
      publishedAt: Date.now(),
      source: "pyth",
    }),
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("fixed-USDC paper practice", () => {
  it("starts every local practice portfolio with fixed buying power", () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => liveResponse(url)));
    render(<PaperTradingDesk active={false} />);
    expect(screen.getAllByText("$10,000.00")).toHaveLength(2);
    expect(screen.getByText("Simulated buying power")).toBeTruthy();
  });

  it("does not expose wallet-SOL mirroring or conversion controls", () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => liveResponse(url)));
    render(<PaperTradingDesk active={false} />);
    expect(screen.queryByText(/wallet-backed practice/i)).toBeNull();
    expect(screen.queryByText(/virtual SOL/i)).toBeNull();
  });
});

describe("Live reference failure states", () => {
  it("keeps historical candles visible without presenting the seeded price as live", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/history"))
          return {
            ok: true,
            json: async () => ({
              source: "coinbase",
              intervalSeconds: 3600,
              candles: [
                {
                  at: Date.now() - 3600_000,
                  openCents: 12_000,
                  highCents: 15_000,
                  lowCents: 11_000,
                  priceCents: 14_000,
                  volume: 1,
                },
              ],
            }),
          };
        return { ok: false, json: async () => ({}) };
      })
    );
    render(<PaperTradingDesk />);
    expect(
      await screen.findByText("LIVE QUOTE UNAVAILABLE")
    ).toBeTruthy();
    expect(screen.getByText("HISTORICAL CHART ONLY")).toBeTruthy();
    expect(
      screen.getByText(/CURRENT QUOTE UNAVAILABLE · HISTORICAL DATA ONLY/)
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry live quote" })).toBeTruthy();
    expect(screen.queryByText("$146.820")).toBeNull();
  });
});
