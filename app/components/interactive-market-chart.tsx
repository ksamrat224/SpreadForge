"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, Time, UTCTimestamp } from "lightweight-charts";
import { buildCandles, heikinAshi, type ChartSample } from "../lib/chart-data";

export type PriceView = "line" | "area" | "candles" | "ohlc" | "heikin";
type Marker = { time: number; side: "buy" | "sell"; text: string };
type Props = {
  samples: ChartSample[];
  view?: PriceView;
  label: string;
  ticks?: boolean;
  unit?: string;
  markers?: Marker[];
};

export function InteractiveMarketChart({
  samples,
  view = "line",
  label,
  ticks = false,
  unit = "$",
  markers = [],
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const syncRef = useRef<(() => void) | null>(null);
  const [interval, setInterval] = useState(ticks ? 4 : 5);
  const [error, setError] = useState("");
  const candleView = view === "candles" || view === "ohlc" || view === "heikin";
  const data = useMemo(() => {
    const candles = buildCandles(
      samples,
      candleView ? interval : ticks ? 1 : 0.001
    );
    return candleView
      ? view === "heikin"
        ? heikinAshi(candles)
        : candles
      : candles.map((c) => ({ time: c.time, value: c.close }));
  }, [samples, candleView, interval, view, ticks]);
  const latest = useRef({ data, markers, interval, candleView });
  useEffect(() => {
    latest.current = { data, markers, interval, candleView };
    syncRef.current?.();
  }, [data, markers, interval, candleView]);

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
          scaleMargins: { top: 0.16, bottom: 0.12 },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
          rightOffset: 5,
          barSpacing: 9,
          minBarSpacing: 2,
          borderVisible: false,
          ...(ticks
            ? { tickMarkFormatter: (time: Time) => `T${Number(time)}` }
            : {}),
        },
        localization: {
          timeFormatter: (time: Time) =>
            ticks
              ? `Tick ${Number(time)}`
              : new Date(Number(time) * 1000).toLocaleTimeString(),
          priceFormatter: (price: number) =>
            `${unit === "$" ? "$" : ""}${price.toFixed(2)}${unit === "$" ? "" : ` ${unit}`}`,
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
      const series =
        view === "ohlc"
          ? chart.addSeries(lib.BarSeries, {
              upColor: "#26a69a",
              downColor: "#ef5350",
              thinBars: true,
            })
          : view === "candles" || view === "heikin"
            ? chart.addSeries(lib.CandlestickSeries, {
                upColor: "#26a69a",
                downColor: "#ef5350",
                wickUpColor: "#26a69a",
                wickDownColor: "#ef5350",
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
                });
      const markerApi = lib.createSeriesMarkers(series);
      let previous: typeof data = [];
      let first = true;
      const format = (value: number) =>
        `${unit === "$" ? "$" : ""}${value.toFixed(2)}${unit === "$" ? "" : ` ${unit}`}`;
      const show = (bar: (typeof data)[number] | undefined) => {
        if (!readout.current) return;
        readout.current.textContent = !bar
          ? "Waiting for samples"
          : `${ticks ? `T${bar.time}` : new Date(bar.time * 1000).toLocaleTimeString()}  ${"open" in bar ? `O ${format(bar.open)}  H ${format(bar.high)}  L ${format(bar.low)}  C ${format(bar.close)}` : format(bar.value)}`;
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
          timeScale.setVisibleLogicalRange({
            from: Math.max(-2, next.length - 70),
            to: Math.max(30, next.length + 4),
          });
          first = false;
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
  }, [view, ticks, unit, interval]);

  const zoom = (factor: number) => {
    const scale = chartRef.current?.timeScale();
    const range = scale?.getVisibleLogicalRange();
    if (range) {
      const center = (range.from + range.to) / 2;
      const half = Math.max(3, ((range.to - range.from) * factor) / 2);
      scale?.setVisibleLogicalRange({ from: center - half, to: center + half });
    }
  };
  const fit = () => {
    chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
    chartRef.current?.timeScale().fitContent();
  };
  return (
    <div className="market-chart-widget" ref={root}>
      <div className="market-chart-controls">
        {candleView && (
          <label>
            Bar interval{" "}
            <select
              aria-label="Candle interval"
              value={interval}
              onChange={(event) => setInterval(Number(event.target.value))}
            >
              {(ticks ? [2, 4, 8] : [5, 15, 30, 60]).map((value) => (
                <option key={value} value={value}>
                  {value}
                  {ticks ? " ticks" : "s"}
                </option>
              ))}
            </select>
          </label>
        )}
        <button onClick={() => zoom(0.8)} aria-label="Zoom in chart">
          +
        </button>
        <button onClick={() => zoom(1.25)} aria-label="Zoom out chart">
          −
        </button>
        <button onClick={fit}>Fit</button>
        <button
          onClick={() => chartRef.current?.timeScale().scrollToRealTime()}
        >
          Latest
        </button>
        <button
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void root.current?.requestFullscreen?.();
          }}
        >
          Fullscreen
        </button>
      </div>
      <div
        ref={readout}
        className="market-chart-readout"
        aria-label="Chart values"
      >
        Loading chart…
      </div>
      <div
        ref={container}
        className="market-chart-canvas"
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
      <div className="market-chart-help">
        Drag to pan · Scroll / pinch to zoom · Drag an axis to scale ·
        Double-click to fit{candleView && " · Wicks show sampled highs/lows"}
      </div>
      <a
        className="chart-attribution"
        href="https://www.tradingview.com/"
        target="_blank"
        rel="noreferrer"
      >
        Charts by TradingView · Lightweight Charts™
      </a>
    </div>
  );
}
