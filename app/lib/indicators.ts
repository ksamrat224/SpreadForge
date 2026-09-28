/**
 * Technical indicators over a close series. Every function returns an array
 * aligned with its input, holding `null` until the indicator has enough data.
 */
export type IndicatorValue = number | null;

export const INDICATORS = {
  sma20: { label: "MA 20", group: "Overlays", pane: false },
  ema50: { label: "EMA 50", group: "Overlays", pane: false },
  bollinger: { label: "Bollinger Bands 20, 2", group: "Overlays", pane: false },
  vwap: { label: "VWAP", group: "Overlays", pane: false },
  rsi: { label: "RSI 14", group: "Oscillators", pane: true },
  macd: { label: "MACD 12, 26, 9", group: "Oscillators", pane: true },
} as const;
export type IndicatorId = keyof typeof INDICATORS;
export const INDICATOR_IDS = Object.keys(INDICATORS) as IndicatorId[];

export function sma(values: number[], period: number): IndicatorValue[] {
  let sum = 0;
  return values.map((value, i) => {
    sum += value - (i >= period ? values[i - period] : 0);
    return i >= period - 1 ? sum / period : null;
  });
}

/** EMA seeded with the SMA of its first `period` values, as TradingView does. */
export function ema(values: number[], period: number): IndicatorValue[] {
  const k = 2 / (period + 1);
  let previous: number | null = null;
  return values.map((value, i) => {
    if (i < period - 1) return null;
    previous =
      previous === null
        ? values.slice(0, period).reduce((a, b) => a + b, 0) / period
        : value * k + previous * (1 - k);
    return previous;
  });
}

export function bollinger(values: number[], period = 20, deviations = 2) {
  const middle = sma(values, period);
  const band = values.map((_, i) => {
    const mean = middle[i];
    if (mean === null) return null;
    const window = values.slice(i - period + 1, i + 1);
    const variance =
      window.reduce((total, value) => total + (value - mean) ** 2, 0) / period;
    return Math.sqrt(variance) * deviations;
  });
  return {
    middle,
    upper: middle.map((mean, i) => (mean === null ? null : mean + band[i]!)),
    lower: middle.map((mean, i) => (mean === null ? null : mean - band[i]!)),
  };
}

/** Wilder-smoothed RSI. */
export function rsi(values: number[], period = 14): IndicatorValue[] {
  let gain = 0;
  let loss = 0;
  return values.map((value, i) => {
    if (i === 0) return null;
    const change = value - values[i - 1];
    const up = Math.max(change, 0);
    const down = Math.max(-change, 0);
    if (i <= period) {
      gain += up / period;
      loss += down / period;
      if (i < period) return null;
    } else {
      gain = (gain * (period - 1) + up) / period;
      loss = (loss * (period - 1) + down) / period;
    }
    return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  });
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const fastLine = ema(values, fast);
  const slowLine = ema(values, slow);
  const line = values.map((_, i) =>
    fastLine[i] === null || slowLine[i] === null
      ? null
      : fastLine[i]! - slowLine[i]!
  );
  const start = line.findIndex((value) => value !== null);
  const signalLine: IndicatorValue[] =
    start < 0
      ? line.map(() => null)
      : [
          ...line.slice(0, start).map(() => null),
          ...ema(line.slice(start) as number[], signal),
        ];
  return {
    macd: line,
    signal: signalLine,
    histogram: line.map((value, i) =>
      value === null || signalLine[i] === null ? null : value - signalLine[i]!
    ),
  };
}

/** Volume-weighted average price, anchored at the first bar of the range. */
export function vwap(
  bars: Array<{ high: number; low: number; close: number; volume?: number }>
): IndicatorValue[] {
  let priceVolume = 0;
  let volume = 0;
  return bars.map((bar) => {
    const weight = bar.volume ?? 0;
    priceVolume += ((bar.high + bar.low + bar.close) / 3) * weight;
    volume += weight;
    return volume > 0 ? priceVolume / volume : null;
  });
}
