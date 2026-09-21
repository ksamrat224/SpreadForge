export type ChartSample = { time: number; value: number };
export type ChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

// Buckets depend on the chosen interval, never the visible chart window.
export function buildCandles(
  samples: ChartSample[],
  interval: number
): ChartCandle[] {
  const candles: ChartCandle[] = [];
  for (const sample of samples) {
    if (!Number.isFinite(sample.time) || !Number.isFinite(sample.value))
      continue;
    const time = Math.floor(sample.time / interval) * interval;
    const last = candles.at(-1);
    if (last && time < last.time) continue;
    if (last?.time === time) {
      last.high = Math.max(last.high, sample.value);
      last.low = Math.min(last.low, sample.value);
      last.close = sample.value;
    } else {
      candles.push({
        time,
        open: sample.value,
        high: sample.value,
        low: sample.value,
        close: sample.value,
      });
    }
  }
  return candles;
}

export function heikinAshi(candles: ChartCandle[]): ChartCandle[] {
  const result: ChartCandle[] = [];
  for (const candle of candles) {
    const previous = result.at(-1);
    const open = previous
      ? (previous.open + previous.close) / 2
      : (candle.open + candle.close) / 2;
    const close = (candle.open + candle.high + candle.low + candle.close) / 4;
    result.push({
      time: candle.time,
      open,
      close,
      high: Math.max(candle.high, open, close),
      low: Math.min(candle.low, open, close),
    });
  }
  return result;
}
