"use client";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_STRATEGY, runSimulation } from "../../lib/simulation/engine";
import { SCENARIOS } from "../../lib/simulation/scenarios";
import { usd } from "./scenario-runs";
import { useReducedMotion } from "./use-reduced-motion";

const SLOTS = 30;
const TICKS_PER_CANDLE = 2;
const TICK_MS = 600;
const scenario = SCENARIOS["stable-market"];
// The Stable Market challenge's own seeded engine run, extended so the loop
// has room to play. Its first 60 ticks are the challenge's exact price path.
const prices = runSimulation(
  { ...scenario, durationTicks: 360 },
  DEFAULT_STRATEGY
).state.priceHistoryCents;
// Start with a full window so the scene is never half empty.
const FIRST_TICK = SLOTS * TICKS_PER_CANDLE;
const LAST_TICK = prices.length - 1;

/** The candles on screen once the feed has played up to `tick`. */
function windowAt(tick: number) {
  // The newest candle may still be forming: it only spans the ticks so far.
  const head = Math.ceil(tick / TICKS_PER_CANDLE) - 1;
  const first = head - SLOTS + 1;
  const visible = prices.slice(first * TICKS_PER_CANDLE, tick + 1);
  // Re-fit the scale to what is on screen, as a live chart does.
  const floor = Math.min(...visible);
  const span = Math.max(...visible) - floor || 1;
  return Array.from({ length: SLOTS }, (_, slot) => {
    const start = (first + slot) * TICKS_PER_CANDLE;
    const ticks = prices.slice(
      start,
      Math.min(start + TICKS_PER_CANDLE, tick) + 1
    );
    const open = ticks[0];
    const close = ticks[ticks.length - 1];
    const top = Math.max(open, close);
    return {
      up: close >= open,
      // A visible base keeps the lowest tick readable as a candle.
      height: 26 + ((top - floor) / span) * 70,
      wick: 8 + ((Math.max(...ticks) - top) / span) * 120,
    };
  });
}

/**
 * Decorative: the seeded engine feed as a receding wall of candles that plays
 * on a loop. Each tick moves the newest candle; every second tick scrolls the
 * window by one candle.
 */
export function HeroScene() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(FIRST_TICK);

  useEffect(() => {
    const el = root.current;
    if (!el || reduced) return;
    // Only spend frames while the hero is actually on screen.
    let onScreen = true;
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
    });
    observer.observe(el);
    const timer = window.setInterval(() => {
      if (!onScreen || document.hidden) return;
      setTick((current) => (current >= LAST_TICK ? FIRST_TICK : current + 1));
    }, TICK_MS);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [reduced]);

  const candles = windowAt(tick);
  const rising = prices[tick] >= prices[tick - 1];

  return (
    <div ref={root} className="hero-scene" aria-hidden="true">
      <div className="hero-scene-plane">
        <span className="hero-scene-tag" style={{ top: "6%", left: "8%" }}>
          SF / MARKET ENGINE
        </span>
        <span
          className="hero-scene-tag is-accent"
          style={{ top: "6%", right: "12%" }}
        >
          SEEDED REPLAY · {scenario.seed}
        </span>
        <div
          // The last tick fades out so the loop restarts without a jump cut.
          className={`hero-scene-candles ${tick === LAST_TICK ? "is-restarting" : ""}`}
        >
          {candles.map((candle, slot) => (
            <i
              key={slot}
              className={`${candle.up ? "up" : "down"} ${slot === SLOTS - 1 ? "is-live" : ""}`}
              style={
                {
                  "--i": slot,
                  "--h": `${candle.height.toFixed(1)}%`,
                  "--wick": `${candle.wick.toFixed(0)}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <span className="hero-scene-tag" style={{ bottom: "7%", left: "8%" }}>
          {rising ? "↑" : "↓"} SOL / USDC
        </span>
        <span
          className="hero-scene-tag is-price"
          style={{ bottom: "6%", right: "12%" }}
        >
          {usd(prices[tick])}
        </span>
      </div>
    </div>
  );
}
