import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LiveMarket } from "../lib/live-markets";
import { LiveMarkets, formatMarketPrice } from "./live-markets";

const market = (overrides: Partial<LiveMarket>): LiveMarket => ({
  id: "mint",
  symbol: "SOL",
  name: "Wrapped SOL",
  icon: null,
  category: "crypto",
  priceUsd: 111.5,
  change24hPercent: 1.98,
  volume24hUsd: 5_000_000,
  liquidityUsd: 900_000_000,
  marketCapUsd: 60_000_000_000,
  ...overrides,
});
const markets = [
  market({}),
  market({
    id: "spy",
    symbol: "SPYx",
    name: "SP500 xStock",
    category: "stocks",
    priceUsd: 779.17,
    change24hPercent: 0.29,
    volume24hUsd: 4_000_000,
  }),
  market({
    id: "bonk",
    symbol: "Bonk",
    name: "Bonk",
    category: "memecoins",
    priceUsd: 0.000003123,
    change24hPercent: -4.5,
    volume24hUsd: 1_000_000,
  }),
];

function mockFeed(response: Partial<Response> & { ok: boolean }) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LiveMarkets", () => {
  it("lists live prices and filters by category and search", async () => {
    mockFeed({
      ok: true,
      json: async () => ({ markets, asOf: Date.now() }),
    });
    render(<LiveMarkets />);

    expect(await screen.findByText("SP500 xStock")).toBeTruthy();
    expect(screen.getByText("$779.17")).toBeTruthy();
    expect(screen.getByText("$0.000003123")).toBeTruthy();
    expect(screen.getByText("LIVE")).toBeTruthy();
    // Sorted by 24h volume by default.
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("SOL")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Stocks/ }));
    expect(screen.queryByText("Wrapped SOL")).toBeNull();
    expect(screen.getByText("SP500 xStock")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /All/ }));
    fireEvent.change(screen.getByPlaceholderText("Search by ticker or name"), {
      target: { value: "bonk" },
    });
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("offers a retry when prices cannot be loaded", async () => {
    mockFeed({ ok: false });
    render(<LiveMarkets />);
    expect(await screen.findByText(/temporarily unavailable/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Retry/ })).toBeTruthy();
  });

  it("does not poll while its tab is hidden", () => {
    mockFeed({ ok: true, json: async () => ({ markets, asOf: Date.now() }) });
    render(<LiveMarkets active={false} />);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("formatMarketPrice", () => {
  it("keeps precision for sub-cent tokens", () => {
    expect(formatMarketPrice(83439.93)).toBe("$83,439.93");
    expect(formatMarketPrice(0.0482)).toBe("$0.0482");
    expect(formatMarketPrice(0.000003123)).toBe("$0.000003123");
  });
});
