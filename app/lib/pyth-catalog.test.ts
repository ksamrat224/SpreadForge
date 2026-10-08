import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("Pyth catalog", () => {
  it("returns only crypto/USD feeds and caches the normalized result", async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          id: "0xbtc",
          attributes: {
            asset_type: "Crypto",
            quote_currency: "USD",
            display_symbol: "BTCUSD",
            description: "Bitcoin",
          },
        },
        {
          id: "eur",
          attributes: {
            asset_type: "Crypto",
            base: "BTC",
            quote_currency: "EUR",
          },
        },
        {
          id: "stock",
          attributes: {
            asset_type: "Equity",
            base: "ACME",
            quote_currency: "USD",
          },
        },
      ],
    }));
    vi.stubGlobal("fetch", fetch);
    const { getPythCatalog } = await import("./pyth-catalog");
    await expect(getPythCatalog()).resolves.toEqual([
      expect.objectContaining({ id: "btc", base: "BTC", tradable: true }),
    ]);
    await getPythCatalog();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fails clearly when Pyth cannot provide a catalog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false }))
    );
    const { getPythCatalog } = await import("./pyth-catalog");
    await expect(getPythCatalog()).rejects.toThrow("Pyth catalog unavailable");
  });
});
