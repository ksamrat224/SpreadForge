import { describe, expect, it } from "vitest";
import { bollinger, ema, macd, rsi, sma, vwap } from "./indicators";

const ramp = Array.from({ length: 40 }, (_, i) => 100 + i);

describe("technical indicators", () => {
  it("averages a rolling window once enough closes exist", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it("seeds the EMA with the first window's SMA", () => {
    const values = ema([1, 2, 3, 4, 5], 3);
    expect(values.slice(0, 3)).toEqual([null, null, 2]);
    expect(values[3]).toBeCloseTo(3);
    expect(values[4]).toBeCloseTo(4);
  });
  it("collapses Bollinger Bands onto the mean for a flat series", () => {
    const bands = bollinger(Array(25).fill(50), 20, 2);
    expect(bands.upper[24]).toBe(50);
    expect(bands.lower[24]).toBe(50);
    expect(bands.middle[18]).toBeNull();
  });
  it("pins RSI at 100 for a series that only rises and 0 for one that only falls", () => {
    expect(rsi(ramp).at(-1)).toBe(100);
    expect(rsi([...ramp].reverse()).at(-1)).toBe(0);
    expect(rsi(ramp)[13]).toBeNull();
    expect(rsi(ramp)[14]).not.toBeNull();
  });
  it("starts the MACD signal line nine bars after the MACD line", () => {
    const result = macd(ramp);
    expect(result.macd.findIndex((value) => value !== null)).toBe(25);
    expect(result.signal.findIndex((value) => value !== null)).toBe(33);
    expect(result.histogram[33]).toBeCloseTo(
      result.macd[33]! - result.signal[33]!
    );
  });
  it("weights VWAP by volume and waits for traded volume", () => {
    expect(
      vwap([
        { high: 10, low: 10, close: 10, volume: 0 },
        { high: 10, low: 10, close: 10, volume: 1 },
        { high: 20, low: 20, close: 20, volume: 3 },
      ])
    ).toEqual([null, 10, 17.5]);
  });
});
