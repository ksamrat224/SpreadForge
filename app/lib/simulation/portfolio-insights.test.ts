import { describe, expect, it } from "vitest";
import { createPaperState, type PaperChainSnapshot } from "./paper";
import {
  analyzePortfolio,
  calculateVolatility,
  classifyMomentum,
  classifyVolatility,
  selectSpotlights,
} from "./portfolio-insights";

const snapshot = (
  positions: Partial<PaperChainSnapshot["positions"]>
): PaperChainSnapshot => ({
  fundingSource: "fixed",
  usdcCents: 500_000,
  startEquityCents: 1_000_000,
  realizedPnlCents: 0,
  positions: { ...createPaperState().positions, ...positions },
  trades: [],
});

const candles = (open: number, low: number, high: number) => [
  {
    at: 1,
    openCents: open,
    lowCents: low,
    highCents: high,
    priceCents: open,
    volume: 1,
  },
];

describe("portfolio analysis", () => {
  it("calculates average cost, value, allocation and unrealized return", () => {
    const rows = analyzePortfolio(
      snapshot({
        SOL: { quantityMilliAsset: 2000, inventoryCostCents: 20_000 },
        ETH: { quantityMilliAsset: 1000, inventoryCostCents: 20_000 },
      }),
      {
        SOL: { priceCents: 12_000, candles: candles(10_000, 9_900, 12_000) },
        ETH: { priceCents: 16_000, candles: candles(20_000, 15_000, 21_000) },
      }
    );
    expect(rows.find((row) => row.asset === "SOL")).toMatchObject({
      averageCostCents: 10_000,
      marketValueCents: 24_000,
      unrealizedPnlCents: 4_000,
      unrealizedPercent: 20,
      allocationPercent: 60,
    });
    expect(rows.find((row) => row.asset === "ETH")?.allocationPercent).toBe(40);
  });

  it("keeps missing prices unavailable and supports zero-cost positions", () => {
    const rows = analyzePortfolio(
      snapshot({
        SOL: { quantityMilliAsset: 1000, inventoryCostCents: 0 },
        ETH: { quantityMilliAsset: 1000, inventoryCostCents: 10_000 },
      }),
      {
        SOL: { priceCents: 1000, candles: null },
        ETH: { priceCents: null, candles: null },
      }
    );
    expect(
      rows.find((row) => row.asset === "SOL")?.unrealizedPercent
    ).toBeNull();
    expect(rows.find((row) => row.asset === "ETH")).toMatchObject({
      marketValueCents: null,
      unrealizedPnlCents: null,
      allocationPercent: null,
    });
  });

  it("honors momentum thresholds", () => {
    expect([3.01, 3, 1, 0, -1, -3, -3.01].map(classifyMomentum)).toEqual([
      "strong-up",
      "up",
      "up",
      "neutral",
      "neutral",
      "down",
      "strong-down",
    ]);
  });

  it("uses the one-day high-to-low range for volatility thresholds", () => {
    expect(calculateVolatility(candles(10_000, 9_800, 10_200))).toBe(4);
    expect([1.99, 2, 5, 5.01].map(classifyVolatility)).toEqual([
      "low",
      "moderate",
      "moderate",
      "high",
    ]);
  });

  it("selects best, negative attention, and strongest momentum independently", () => {
    const rows = analyzePortfolio(
      snapshot({
        SOL: { quantityMilliAsset: 1000, inventoryCostCents: 10_000 },
        ETH: { quantityMilliAsset: 1000, inventoryCostCents: 20_000 },
      }),
      {
        SOL: { priceCents: 12_000, candles: candles(10_000, 9_500, 12_000) },
        ETH: { priceCents: 18_000, candles: candles(17_500, 17_000, 18_000) },
      }
    );
    expect(selectSpotlights(rows)).toMatchObject({
      best: { asset: "SOL" },
      needsAttention: { asset: "ETH" },
      momentum: { asset: "SOL" },
    });
  });
});
