import { describe, expect, it } from "vitest";
import { buildCandles, heikinAshi } from "./chart-data";

describe("market chart data", () => {
  it("keeps completed candles stable while a new candle is formed", () => {
    const samples = [100, 108, 94, 103, 110, 105].map((value, time) => ({
      value,
      time,
    }));
    const before = buildCandles(samples.slice(0, 4), 4);
    const after = buildCandles(samples, 4);

    expect(after[0]).toEqual(before[0]);
    expect(after[0]).toEqual({
      time: 0,
      open: 100,
      high: 108,
      low: 94,
      close: 103,
    });
  });

  it("calculates Heikin-Ashi opens from the previous smoothed candle", () => {
    const raw = [
      { time: 0, open: 100, high: 120, low: 90, close: 110 },
      { time: 4, open: 110, high: 130, low: 105, close: 125 },
      { time: 8, open: 125, high: 140, low: 120, close: 135 },
    ];
    const smoothed = heikinAshi(raw);

    expect(smoothed[2].open).toBe((smoothed[1].open + smoothed[1].close) / 2);
    expect(smoothed[2].open).not.toBe((raw[1].open + raw[1].close) / 2);
  });
});
