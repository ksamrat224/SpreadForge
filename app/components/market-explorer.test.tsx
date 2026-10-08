import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketExplorer } from "./market-explorer";

const markets = [
  {
    id: "btc",
    symbol: "BTC/USD",
    base: "BTC",
    quote: "USD",
    displayName: "Bitcoin",
    tradable: true,
    solana: false,
  },
  {
    id: "jup",
    symbol: "JUP/USD",
    base: "JUP",
    quote: "USD",
    displayName: "Jupiter",
    tradable: false,
    solana: true,
  },
] as const;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("MarketExplorer", () => {
  it("loads the catalog only after opening and selects verified markets", async () => {
    const onSelectMarket = vi.fn();
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ markets }),
    }));
    vi.stubGlobal("fetch", fetch);
    render(
      <MarketExplorer activeAsset="SOL" onSelectMarket={onSelectMarket} />
    );
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Explore markets/ }));
    expect(await screen.findByText("BTC/USD")).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: /BTC\/USD/ }));
    expect(onSelectMarket).toHaveBeenCalledWith("BTC");
  });

  it("keeps non-tradable feeds quote-only and persists the watchlist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/quote")
          ? { ok: true, json: async () => ({ price: 1.234 }) }
          : { ok: true, json: async () => ({ markets }) }
      )
    );
    render(<MarketExplorer activeAsset="SOL" onSelectMarket={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Explore markets/ }));
    fireEvent.click(await screen.findByRole("option", { name: /JUP\/USD/ }));
    expect(await screen.findByText(/Quote-only markets/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /Add JUP\/USD to watchlist/ })
    );
    await waitFor(() =>
      expect(localStorage.getItem("spreadforge-market-watchlist-v1")).toContain(
        "jup"
      )
    );
  });
});
