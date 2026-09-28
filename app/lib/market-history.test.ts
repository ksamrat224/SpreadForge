import { describe, expect, it } from "vitest";
import { mergeLiveTick, type HistoryCandle } from "./market-history";

const candle: HistoryCandle = {
  at: 1_800_000_000_000,
  openCents: 10_000,
  highCents: 10_100,
  lowCents: 9_900,
  priceCents: 10_050,
  volume: 12,
};

describe("live ticks on exchange candles", () => {
  it("extends the open candle's range and close within its interval", () => {
    const [next] = mergeLiveTick([candle], 300, 10_300, candle.at + 60_000);
    expect(next).toEqual({ ...candle, highCents: 10_300, priceCents: 10_300 });
  });
  it("opens a new candle from the previous close once the interval rolls", () => {
    const merged = mergeLiveTick([candle], 300, 9_800, candle.at + 300_000);
    expect(merged).toHaveLength(2);
    expect(merged[1]).toEqual({
      at: candle.at + 300_000,
      openCents: 10_050,
      highCents: 10_050,
      lowCents: 9_800,
      priceCents: 9_800,
      volume: 0,
    });
  });
  it("ignores ticks older than the latest candle", () => {
    const candles = [candle];
    expect(mergeLiveTick(candles, 300, 1, candle.at - 1)).toBe(candles);
  });
});
