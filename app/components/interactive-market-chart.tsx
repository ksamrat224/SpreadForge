"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  IconArrowsMaximize,
  IconCheck,
  IconChartCandle,
  IconMathFunction,
  IconFocusCentered,
  IconMinus,
  IconPlus,
  IconRefresh,
} from "@tabler/icons-react";
import type {
  IChartApi,
  ISeriesApi,
  SeriesType,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import {
  buildCandles,
  heikinAshi,
  type ChartCandle,
  type ChartSample,
} from "../lib/chart-data";
import {
  bollinger,
  ema,
  INDICATOR_IDS,
  INDICATORS,
  macd,
  rsi,
  sma,
  vwap,
  type IndicatorId,
  type IndicatorValue,
} from "../lib/indicators";
import { ThemedSelect } from "./themed-select";

export type PriceView = "line" | "area" | "candles" | "ohlc" | "heikin";
type Marker = { time: number; side: "buy" | "sell"; text: string };
export type ChartBar = ChartCandle & { volume?: number };

const UP = "#16c784";
const DOWN = "#ea3943";
const LOG_MODE = 1; // PriceScaleMode.Logarithmic, without importing the lib eagerly

const PANE_HEIGHT = 110;
const NO_INDICATORS: IndicatorId[] = [];

/** One drawable output of an indicator, e.g. Bollinger's upper band. */
type IndicatorLine = {
  id: IndicatorId;
  name: string;
  color: string;
  kind: "line" | "histogram";
  dashed?: boolean;
  guides?: number[];
  points: Array<{ time: number; value: number; color?: string }>;
};

function toPoints(times: number[], values: IndicatorValue[]) {
  return values.flatMap((value, i) =>
    value === null ? [] : [{ time: times[i], value }]
  );
}

function indicatorLines(id: IndicatorId, candles: ChartBar[]): IndicatorLine[] {
  const times = candles.map((candle) => candle.time);
  const closes = candles.map((candle) => candle.close);
  const line = (
    name: string,
    color: string,
    values: IndicatorValue[],
    extra: Partial<IndicatorLine> = {}
  ): IndicatorLine => ({
    id,
    name,
    color,
    kind: "line",
    points: toPoints(times, values),
    ...extra,
  });
  if (id === "sma20") return [line("MA 20", "#f5a524", sma(closes, 20))];
  if (id === "ema50") return [line("EMA 50", "#7c5cff", ema(closes, 50))];
  if (id === "vwap") return [line("VWAP", "#e056fd", vwap(candles))];
  if (id === "bollinger") {
    const bands = bollinger(closes);
    return [
      line("BB upper", "#2f80ed", bands.upper),
      line("BB basis", "#2f80ed", bands.middle, { dashed: true }),
      line("BB lower", "#2f80ed", bands.lower),
    ];
  }
  if (id === "rsi")
    return [line("RSI", "#a78bfa", rsi(closes), { guides: [70, 30] })];
  const result = macd(closes);
  return [
    {
      id,
      name: "Histogram",
      color: "",
      kind: "histogram",
      points: toPoints(times, result.histogram).map((point) => ({
        ...point,
        color:
          point.value >= 0 ? "rgba(22,199,132,0.55)" : "rgba(234,57,67,0.55)",
      })),
    },
    line("MACD", "#2f80ed", result.macd),
    line("Signal", "#f5a524", result.signal),
  ];
}

// Percentages and basis points are often tiny (a 0.004% drawdown), so they
// keep significant digits instead of rounding to zero.
function formatValue(value: number, unit: string) {
  if (unit === "$") return `$${value.toFixed(2)}`;
  const digits =
    (unit === "%" || unit === "bps") && value !== 0 && Math.abs(value) < 0.1
      ? 4
      : 2;
  return `${value.toFixed(digits)} ${unit}`;
}

function localTick(date: Date, type: number) {
  // TickMarkType: 0 year, 1 month, 2 day of month, 3 time, 4 time with seconds
  if (type === 0) return String(date.getFullYear());
  if (type === 1) return date.toLocaleDateString(undefined, { month: "short" });
  if (type === 2)
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(type === 4 ? { second: "2-digit" } : {}),
  });
}
type Props = {
  samples: ChartSample[];
  view?: PriceView;
  label: string;
  ticks?: boolean;
  timeLabelPrefix?: string;
  toolbarStart?: ReactNode;
  readoutActions?: ReactNode;
  unit?: string;
  markers?: Marker[];
  /** Candle bucket sizes, in ticks when `ticks` is set, otherwise seconds. */
  intervals?: number[];
  /** Exchange OHLCV candles; when set they are drawn as-is instead of bucketing `samples`. */
  bars?: ChartBar[];
  /**
   * "market" draws the line view as a baseline around the range's opening
   * price, with volume bars and a log-scale toggle, like public price pages.
   */
  variant?: "default" | "market";
  /** Draws the line view as steps, for values that change in discrete jumps. */
  stepped?: boolean;
  /** Active technical indicators; the Indicators menu shows when a change handler is given. */
  indicators?: IndicatorId[];
  onIndicatorsChange?: (indicators: IndicatorId[]) => void;
};

export function InteractiveMarketChart({
  samples,
  view = "line",
  label,
  ticks = false,
  timeLabelPrefix,
  toolbarStart,
  readoutActions,
  unit = "$",
  markers = [],
  intervals = ticks ? [2, 4, 8] : [5, 15, 30, 60],
  bars,
  variant = "default",
  stepped = false,
  indicators = NO_INDICATORS,
  onIndicatorsChange,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const syncRef = useRef<(() => void) | null>(null);
  const followFullWidth = useRef(true);
  const [interval, setInterval] = useState(intervals[ticks ? 1 : 0]);
  const [logScale, setLogScale] = useState(false);
  const [error, setError] = useState("");
  const market = variant === "market";
  const baseline = market && view === "line";
  const candleView = view === "candles" || view === "ohlc" || view === "heikin";
  const candles = useMemo<ChartBar[]>(
    () =>
      bars ?? buildCandles(samples, candleView ? interval : ticks ? 1 : 0.001),
    [bars, samples, candleView, interval, ticks]
  );
  const data = useMemo(
    () =>
      candleView
        ? view === "heikin"
          ? heikinAshi(candles)
          : candles.map(({ time, open, high, low, close }) => ({
              time,
              open,
              high,
              low,
              close,
            }))
        : candles.map((c) => ({ time: c.time, value: c.close })),
    [candles, candleView, view]
  );
  const hasVolume = !!bars?.some((bar) => (bar.volume ?? 0) > 0);
  // Indicators always read the underlying candles, never Heikin-Ashi values.
  const activeIndicators = useMemo(
    () =>
      INDICATOR_IDS.filter(
        (id) => indicators.includes(id) && (id !== "vwap" || hasVolume)
      ),
    [indicators, hasVolume]
  );
  const lines = useMemo(
    () => activeIndicators.flatMap((id) => indicatorLines(id, candles)),
    [candles, activeIndicators]
  );
  const paneCount = activeIndicators.filter((id) => INDICATORS[id].pane).length;
  const volume = useMemo(
    () =>
      market && bars
        ? bars.map((bar) => ({
            time: bar.time,
            value: bar.volume ?? 0,
            color:
              bar.close >= bar.open
                ? "rgba(22,199,132,0.28)"
                : "rgba(234,57,67,0.28)",
          }))
        : [],
    [bars, market]
  );
  // The range's opening price, which the baseline view colours around.
  const basePrice = bars?.[0]?.open ?? samples[0]?.value;
  const latest = useRef({
    data,
    volume,
    basePrice,
    markers,
    interval,
    candleView,
    lines,
  });
  useEffect(() => {
    latest.current = {
      data,
      volume,
      basePrice,
      markers,
      interval,
      candleView,
      lines,
    };
    syncRef.current?.();
  }, [data, volume, basePrice, markers, interval, candleView, lines]);
  const logRef = useRef(logScale);
  useEffect(() => {
    logRef.current = logScale;
    chartRef.current
      ?.priceScale("right")
      .applyOptions({ mode: logScale ? LOG_MODE : 0 });
  }, [logScale]);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    async function initialize() {
      const lib = await import("lightweight-charts");
      if (disposed || !container.current) return;
      const chart = lib.createChart(container.current, {
        autoSize: true,
        layout: {
          attributionLogo: true,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
        },
        crosshair: { mode: lib.CrosshairMode.Normal },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: { top: 0.16, bottom: market ? 0.22 : 0.12 },
          mode: logRef.current ? LOG_MODE : 0,
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
          rightOffset: 0,
          barSpacing: 9,
          minBarSpacing: 0.5,
          borderVisible: false,
          ...(ticks
            ? { tickMarkFormatter: (time: Time) => `T${Number(time)}` }
            : timeLabelPrefix
              ? {
                  tickMarkFormatter: (time: Time) =>
                    timeLabelPrefix === "Sample"
                      ? `S${Number(time)}`
                      : `${timeLabelPrefix} ${Number(time)}`,
                }
              : {
                  tickMarkFormatter: (time: Time, type: number) =>
                    localTick(new Date(Number(time) * 1000), type),
                }),
        },
        localization: {
          timeFormatter: (time: Time) =>
            ticks
              ? `Tick ${Number(time)}`
              : timeLabelPrefix
                ? `${timeLabelPrefix} ${Number(time)}`
                : new Date(Number(time) * 1000).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }),
          priceFormatter: (price: number) => formatValue(price, unit),
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          mouseWheel: true,
          pinch: true,
          axisPressedMouseMove: true,
          axisDoubleClickReset: true,
        },
        kineticScroll: { mouse: true, touch: true },
      });
      chartRef.current = chart;
      const up = market ? UP : "#26a69a";
      const down = market ? DOWN : "#ef5350";
      const volumeSeries = market
        ? chart.addSeries(lib.HistogramSeries, {
            priceScaleId: "volume",
            priceFormat: { type: "volume" },
            lastValueVisible: false,
            priceLineVisible: false,
          })
        : null;
      // The "volume" scale only exists once a series is attached to it.
      if (volumeSeries)
        chart
          .priceScale("volume")
          .applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
      const series = baseline
        ? chart.addSeries(lib.BaselineSeries, {
            lineWidth: 2,
            topLineColor: UP,
            topFillColor1: "rgba(22,199,132,0.28)",
            topFillColor2: "rgba(22,199,132,0.03)",
            bottomLineColor: DOWN,
            bottomFillColor1: "rgba(234,57,67,0.03)",
            bottomFillColor2: "rgba(234,57,67,0.28)",
          })
        : view === "ohlc"
          ? chart.addSeries(lib.BarSeries, {
              upColor: up,
              downColor: down,
              thinBars: true,
            })
          : view === "candles" || view === "heikin"
            ? chart.addSeries(lib.CandlestickSeries, {
                upColor: up,
                downColor: down,
                wickUpColor: up,
                wickDownColor: down,
                borderVisible: false,
              })
            : view === "area"
              ? chart.addSeries(lib.AreaSeries, {
                  lineColor: "#00bda7",
                  topColor: "rgba(0,189,167,0.28)",
                  bottomColor: "rgba(0,189,167,0)",
                  lineWidth: 2,
                })
              : chart.addSeries(lib.LineSeries, {
                  color: "#00bda7",
                  lineWidth: 2,
                  lineType: stepped
                    ? lib.LineType.WithSteps
                    : lib.LineType.Simple,
                });
      const markerApi = lib.createSeriesMarkers(series);
      const basePriceLine = baseline
        ? series.createPriceLine({
            price: 0,
            color: "rgba(148,163,184,0.8)",
            lineWidth: 1,
            lineStyle: lib.LineStyle.Dotted,
            axisLabelVisible: true,
            title: "Open",
          })
        : null;
      let previous: typeof data = [];
      let first = true;
      let builtIndicators = "";
      let indicatorSeries: ISeriesApi<SeriesType>[] = [];
      const plain = {
        type: "custom" as const,
        formatter: (price: number) => price.toFixed(2),
      };
      // Rebuilds indicator series only when the selection changes; data
      // updates reuse them. Emptied panes are removed by the library.
      const syncIndicators = () => {
        const current = latest.current.lines;
        const signature = current.map((line) => line.id + line.name).join();
        if (signature !== builtIndicators) {
          for (const item of indicatorSeries) chart.removeSeries(item);
          // Oscillators get fixed panes below the price in menu order.
          const paneIds = [
            ...new Set(
              current
                .filter((line) => INDICATORS[line.id].pane)
                .map((line) => line.id)
            ),
          ];
          indicatorSeries = current.map((line) => {
            const pane = paneIds.indexOf(line.id) + 1;
            const api =
              line.kind === "histogram"
                ? chart.addSeries(
                    lib.HistogramSeries,
                    {
                      priceFormat: plain,
                      priceLineVisible: false,
                      lastValueVisible: false,
                    },
                    pane
                  )
                : chart.addSeries(
                    lib.LineSeries,
                    {
                      color: line.color,
                      lineWidth: 1,
                      lineStyle: line.dashed
                        ? lib.LineStyle.Dashed
                        : lib.LineStyle.Solid,
                      priceLineVisible: false,
                      lastValueVisible: !line.dashed,
                      crosshairMarkerVisible: false,
                      ...(pane ? { priceFormat: plain } : {}),
                    },
                    pane
                  );
            for (const price of line.guides ?? [])
              api.createPriceLine({
                price,
                color: "rgba(148,163,184,0.6)",
                lineWidth: 1,
                lineStyle: lib.LineStyle.Dashed,
                axisLabelVisible: false,
                title: "",
              });
            return api;
          });
          for (let i = chart.panes().length - 1; i > paneIds.length; i--)
            chart.removePane(i);
          chart
            .panes()
            .forEach((pane, index) => pane.setStretchFactor(index ? 1 : 3));
          builtIndicators = signature;
        }
        indicatorSeries.forEach((api, index) =>
          api.setData(
            current[index].points.map((point) => ({
              ...point,
              time: point.time as UTCTimestamp,
            }))
          )
        );
      };
      const indicatorReadout = (time: number) =>
        latest.current.lines
          .filter((line) => line.kind === "line")
          .flatMap((line) => {
            const point = line.points.find((item) => item.time === time);
            return point ? [`${line.name} ${point.value.toFixed(2)}`] : [];
          })
          .join("  ");
      const format = (value: number) => formatValue(value, unit);
      const show = (bar: (typeof data)[number] | undefined) => {
        if (!readout.current) return;
        readout.current.textContent = !bar
          ? "Waiting for samples"
          : `${ticks ? `T${bar.time}` : timeLabelPrefix ? `${timeLabelPrefix} ${bar.time}` : new Date(bar.time * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}  ${"open" in bar ? `O ${format(bar.open)}  H ${format(bar.high)}  L ${format(bar.low)}  C ${format(bar.close)}` : format(bar.value)}  ${indicatorReadout(bar.time)}`.trim();
      };
      const sync = () => {
        const next = latest.current.data;
        const timeScale = chart.timeScale();
        const range = timeScale.getVisibleLogicalRange();
        const atLive = first || !range || range.to >= previous.length - 1;
        const reset =
          first ||
          next.length < previous.length ||
          next[0]?.time !== previous[0]?.time;
        if (reset)
          series.setData(
            next.map((bar) => ({ ...bar, time: bar.time as UTCTimestamp }))
          );
        else {
          for (let i = Math.max(0, previous.length - 1); i < next.length; i++)
            series.update({ ...next[i], time: next[i].time as UTCTimestamp });
        }
        volumeSeries?.setData(
          latest.current.volume.map((bar) => ({
            ...bar,
            time: bar.time as UTCTimestamp,
          }))
        );
        syncIndicators();
        const base = latest.current.basePrice;
        if (baseline && base !== undefined) {
          series.applyOptions({ baseValue: { type: "price", price: base } });
          basePriceLine?.applyOptions({ price: base });
        }
        markerApi.setMarkers(
          latest.current.markers
            .map((marker) => ({
              time: (latest.current.candleView
                ? Math.floor(marker.time / latest.current.interval) *
                  latest.current.interval
                : marker.time) as UTCTimestamp,
              position:
                marker.side === "buy"
                  ? ("belowBar" as const)
                  : ("aboveBar" as const),
              shape:
                marker.side === "buy"
                  ? ("arrowUp" as const)
                  : ("arrowDown" as const),
              color: marker.side === "buy" ? "#26a69a" : "#ef5350",
              text: marker.text,
            }))
            .filter((marker) => next.some((bar) => bar.time === marker.time))
            .sort((a, b) => Number(a.time) - Number(b.time))
        );
        if (first && next.length) {
          timeScale.fitContent();
          first = false;
        } else if (followFullWidth.current) {
          timeScale.fitContent();
        } else if (!atLive && range) {
          timeScale.setVisibleLogicalRange(range);
        } else if (atLive) {
          timeScale.scrollToRealTime();
        }
        previous = next;
        show(next.at(-1));
      };
      syncRef.current = sync;
      const theme = () => {
        const dark = document.documentElement.classList.contains("dark");
        chart.applyOptions({
          layout: {
            background: {
              type: lib.ColorType.Solid,
              color: dark ? "#10151b" : "#ffffff",
            },
            textColor: dark ? "#94a3b8" : "#475569",
          },
          grid: {
            vertLines: { color: dark ? "#1b2530" : "#edf0f3" },
            horzLines: { color: dark ? "#1b2530" : "#edf0f3" },
          },
        });
      };
      theme();
      const observer = new MutationObserver(theme);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      chart.subscribeCrosshairMove((event) => {
        const bar = event.seriesData.get(series);
        if (bar && ("value" in bar || "open" in bar))
          show({ ...bar, time: Number(bar.time) } as (typeof data)[number]);
        else show(latest.current.data.at(-1));
      });
      sync();
      cleanup = () => {
        observer.disconnect();
        markerApi.detach();
        chart.remove();
        chartRef.current = null;
        syncRef.current = null;
      };
    }
    void initialize().catch((reason: unknown) => {
      if (!disposed)
        setError(
          reason instanceof Error ? reason.message : "Chart unavailable"
        );
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [view, ticks, timeLabelPrefix, unit, interval, market, baseline, stepped]);

  const zoom = (factor: number) => {
    const scale = chartRef.current?.timeScale();
    const range = scale?.getVisibleLogicalRange();
    if (range) {
      followFullWidth.current = false;
      const center = (range.from + range.to) / 2;
      const half = Math.max(3, ((range.to - range.from) * factor) / 2);
      scale?.setVisibleLogicalRange({ from: center - half, to: center + half });
    }
  };
  const fit = () => {
    followFullWidth.current = true;
    chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
    chartRef.current?.timeScale().fitContent();
  };
  const goToLatest = () => {
    const scale = chartRef.current?.timeScale();
    const range = scale?.getVisibleLogicalRange();
    const last = latest.current.data.length - 1;
    if (!scale || last < 0) return;
    followFullWidth.current = false;

    const span = range ? Math.max(6, range.to - range.from) : 70;
    scale.setVisibleLogicalRange({
      from: last - span + 0.5,
      to: last + 0.5,
    });
  };
  const controls = (
    <>
      {market && (
        <button
          type="button"
          className={logScale ? "active" : ""}
          aria-pressed={logScale}
          onClick={() => setLogScale((current) => !current)}
          aria-label="Logarithmic price scale"
          title="Log scale"
          data-tooltip="Log scale"
        >
          Log
        </button>
      )}
      {onIndicatorsChange && (
        <IndicatorMenu
          active={indicators}
          hasVolume={hasVolume}
          onChange={onIndicatorsChange}
        />
      )}
      {candleView && !bars && (
        <div className="candle-interval">
          <span>Interval</span>
          <ThemedSelect
            label="Candle interval"
            value={interval}
            onChange={setInterval}
            options={intervals.map((value) => ({
              value,
              label: ticks
                ? `${value} ticks`
                : value >= 60
                  ? `${value / 60}m`
                  : `${value}s`,
              icon: <IconChartCandle size={14} />,
            }))}
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => zoom(0.8)}
        aria-label="Zoom in chart"
        title="Zoom in"
        data-tooltip="Zoom in"
      >
        <IconPlus size={14} />
      </button>
      <button
        type="button"
        onClick={() => zoom(1.25)}
        aria-label="Zoom out chart"
        title="Zoom out"
        data-tooltip="Zoom out"
      >
        <IconMinus size={14} />
      </button>
      <button
        type="button"
        onClick={fit}
        aria-label="Fit"
        title="Fit chart"
        data-tooltip="Fit chart"
      >
        <IconFocusCentered size={14} />
      </button>
      <button
        type="button"
        onClick={goToLatest}
        aria-label="Latest chart point"
        title="Latest point"
        data-tooltip="Go to latest"
      >
        <IconRefresh size={14} />
      </button>
      <button
        aria-label="Fullscreen chart"
        title="Fullscreen"
        data-tooltip="Fullscreen"
        type="button"
        onClick={() => {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void root.current?.requestFullscreen?.();
        }}
      >
        <IconArrowsMaximize size={14} />
      </button>
    </>
  );
  return (
    <div
      className="market-chart-widget"
      ref={root}
      onWheelCapture={() => {
        followFullWidth.current = false;
      }}
      onPointerDownCapture={() => {
        followFullWidth.current = false;
      }}
    >
      {toolbarStart ? (
        <div className="market-chart-toolbar">
          {toolbarStart}
          <div className="market-chart-controls">{controls}</div>
        </div>
      ) : (
        <div className="market-chart-controls">{controls}</div>
      )}
      <div className="market-chart-readout" aria-label="Chart values">
        <span ref={readout}>Loading chart…</span>
        {readoutActions && (
          <div className="market-chart-readout-actions">{readoutActions}</div>
        )}
      </div>
      <div
        ref={container}
        className="market-chart-canvas"
        style={
          paneCount ? { height: 320 + paneCount * PANE_HEIGHT } : undefined
        }
        role="img"
        aria-label={label}
        tabIndex={0}
        onDoubleClick={fit}
        onKeyDown={(event) => {
          if (event.key === "+" || event.key === "=") zoom(0.8);
          else if (event.key === "-") zoom(1.25);
          else if (event.key === "Home") fit();
          else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            const scale = chartRef.current?.timeScale();
            if (scale)
              scale.scrollToPosition(
                scale.scrollPosition() + (event.key === "ArrowLeft" ? 5 : -5),
                false
              );
          } else return;
          event.preventDefault();
        }}
      />
      {error && <p role="alert">Unable to load chart: {error}</p>}
    </div>
  );
}

function IndicatorMenu({
  active,
  hasVolume,
  onChange,
}: {
  active: IndicatorId[];
  hasVolume: boolean;
  onChange: (indicators: IndicatorId[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const count = active.filter((id) => id !== "vwap" || hasVolume).length;
  return (
    <div className="themed-select indicator-menu" ref={root}>
      <button
        type="button"
        className={count ? "active" : ""}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Indicators"
        onClick={() => setOpen((current) => !current)}
      >
        <IconMathFunction size={14} />
        <span>Indicators{count ? ` ${count}` : ""}</span>
      </button>
      {open && (
        <div className="themed-select-menu" role="menu" aria-label="Indicators">
          {(["Overlays", "Oscillators"] as const).map((group) => (
            <div key={group} role="group" aria-label={group}>
              <span className="indicator-menu-group">{group}</span>
              {INDICATOR_IDS.filter(
                (id) =>
                  INDICATORS[id].group === group && (id !== "vwap" || hasVolume)
              ).map((id) => {
                const checked = active.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={checked}
                    onClick={() =>
                      onChange(
                        checked
                          ? active.filter((item) => item !== id)
                          : [...active, id]
                      )
                    }
                  >
                    <span className="indicator-check">
                      {checked && <IconCheck size={12} />}
                    </span>
                    <span>{INDICATORS[id].label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
