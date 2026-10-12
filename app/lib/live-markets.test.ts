import { describe, expect, it } from "vitest";
import { categorizeMarket, toLiveMarket } from "./live-markets";

describe("categorizeMarket", () => {
  it("treats xStock tickers as stocks", () => {
    expect(categorizeMarket("SPYx")).toBe("stocks");
    expect(categorizeMarket("BRK.Bx")).toBe("stocks");
  });

  it("recognises the hand-picked memecoins regardless of case", () => {
    expect(categorizeMarket("WIF")).toBe("memecoins");
    expect(categorizeMarket("Bonk")).toBe("memecoins");
  });

  it("files everything else under crypto", () => {
    expect(categorizeMarket("SOL")).toBe("crypto");
    expect(categorizeMarket("cbBTC")).toBe("crypto");
    expect(categorizeMarket("JitoSOL")).toBe("crypto");
  });
});

describe("toLiveMarket", () => {
  it("maps a Jupiter token record to a market", () => {
    expect(
      toLiveMarket({
        id: "mint-1",
        symbol: "$WIF",
        name: "dogwifhat",
        icon: "https://example.com/wif.png",
        usdPrice: 0.42,
        liquidity: 6_500_000,
        mcap: 420_000_000,
        stats24h: { priceChange: -3.5, buyVolume: 1_000, sellVolume: 500 },
      })
    ).toEqual({
      id: "mint-1",
      symbol: "WIF",
      name: "dogwifhat",
      icon: "https://example.com/wif.png",
      category: "memecoins",
      priceUsd: 0.42,
      change24hPercent: -3.5,
      volume24hUsd: 1_500,
      liquidityUsd: 6_500_000,
      marketCapUsd: 420_000_000,
    });
  });

  it("keeps missing statistics empty instead of inventing zeros", () => {
    const market = toLiveMarket({
      id: "mint-2",
      symbol: "SPYx",
      usdPrice: 779,
    });
    expect(market).toMatchObject({
      name: "SPYx",
      icon: null,
      category: "stocks",
      change24hPercent: null,
      volume24hUsd: null,
      liquidityUsd: null,
      marketCapUsd: null,
    });
  });

  it("rejects records without a usable price", () => {
    expect(toLiveMarket({ id: "mint-3", symbol: "SOL" })).toBeNull();
    expect(
      toLiveMarket({ id: "mint-3", symbol: "SOL", usdPrice: 0 })
    ).toBeNull();
    expect(toLiveMarket(null)).toBeNull();
  });
});
