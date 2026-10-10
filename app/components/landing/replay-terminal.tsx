"use client";
import { useEffect, useRef } from "react";
import { animate, createTimeline, stagger, svg } from "animejs";
import { SCENARIO_RUNS, pricePath } from "./scenario-runs";
import { useReducedMotion } from "./use-reduced-motion";

const W = 560;
const H = 200;
export const REPLAY_RUN = SCENARIO_RUNS["whale-sell"];
const run = REPLAY_RUN;
const prices = run.state.priceHistoryCents;
const chart = pricePath(prices, W, H, 18);
const whale = run.scenario.events[0];
const fills = run.state.fills.filter((_, i) => i % 2 === 0).slice(0, 14);
const last = prices[prices.length - 1];

/** The Whale Sell replay: real engine output for the default strategy. */
export function ReplayTerminal() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = root.current;
    if (!el || reduced) return;
    let cleanup = () => {};
    // Draw the path when the card scrolls into view, not on page load.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const [line] = svg.createDrawable(el.querySelector(".replay-line")!);
        const timeline = createTimeline()
          .add(line, {
            draw: ["0 0", "0 1"],
            duration: 2400,
            ease: "inOutQuad",
          })
          .add(
            el.querySelectorAll(".replay-area"),
            { opacity: [0, 1], duration: 800, ease: "outQuad" },
            "-=900"
          )
          .add(
            el.querySelectorAll(".replay-fill"),
            {
              scale: [0, 1],
              opacity: [0, 1],
              delay: stagger(70),
              duration: 420,
            },
            "-=1600"
          )
          .add(
            el.querySelectorAll(".replay-event"),
            { opacity: [0, 1], translateY: [8, 0], duration: 500 },
            "-=1000"
          );
        const pulse = animate(el.querySelectorAll(".replay-head"), {
          scale: [1, 1.9],
          opacity: [0.7, 0],
          duration: 1600,
          loop: true,
          ease: "outQuad",
        });
        cleanup = () => {
          timeline.revert();
          pulse.revert();
        };
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cleanup();
    };
  }, [reduced]);

  return (
    <div ref={root}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Deterministic ${run.scenario.name} price path with ${run.state.fills.length} simulated fills`}
      >
        <defs>
          <linearGradient id="replay-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1="0"
            x2={W}
            y1={H * r}
            y2={H * r}
            stroke="var(--border)"
            strokeDasharray="3 6"
          />
        ))}
        <path className="replay-area" d={chart.area} fill="url(#replay-area)" />
        <g className="replay-event">
          <line
            x1={chart.x(whale.tick)}
            x2={chart.x(whale.tick)}
            y1="0"
            y2={H}
            stroke="var(--warning)"
            strokeDasharray="4 4"
            strokeOpacity="0.8"
          />
          <text
            x={chart.x(whale.tick) + 8}
            y="14"
            className="mono"
            fontSize="10"
            fill="var(--warning)"
          >
            {whale.label.toUpperCase()} {whale.priceMoveBps / 100}%
          </text>
        </g>
        <path
          className="replay-line"
          d={chart.line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.25"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {fills.map((fill, i) => (
          <circle
            key={i}
            className="replay-fill"
            cx={chart.x(fill.tick)}
            cy={chart.y(prices[fill.tick] ?? fill.priceCents)}
            r="4"
            fill={fill.side === "buy" ? "var(--profit)" : "var(--loss)"}
            stroke="var(--card)"
            strokeWidth="1.5"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        ))}
        <circle
          className="replay-head"
          cx={W}
          cy={chart.y(last)}
          r="5"
          fill="var(--primary)"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
        <circle cx={W} cy={chart.y(last)} r="3.5" fill="var(--primary)" />
      </svg>
    </div>
  );
}
