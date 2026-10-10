import { SCENARIO_RUNS, usd } from "./scenario-runs";

const run = SCENARIO_RUNS["stable-market"];
const prices = run.state.priceHistoryCents;
const TICKS_PER_CANDLE = 2;
const floor = Math.min(...prices);
const span = Math.max(...prices) - floor || 1;

// Every candle is two ticks of the engine's real, seeded price path.
const candles = Array.from(
  { length: Math.floor((prices.length - 1) / TICKS_PER_CANDLE) },
  (_, i) => {
    const ticks = prices.slice(
      i * TICKS_PER_CANDLE,
      (i + 1) * TICKS_PER_CANDLE + 1
    );
    const open = ticks[0];
    const close = ticks[ticks.length - 1];
    return {
      up: close >= open,
      // A visible base keeps the lowest tick readable as a candle.
      height: 26 + ((Math.max(open, close) - floor) / span) * 70,
      wick: 8 + ((Math.max(...ticks) - Math.max(open, close)) / span) * 120,
    };
  }
);

/** Decorative: the Stable Market replay as a receding wall of candles. */
export function HeroScene() {
  return (
    <div className="hero-scene" aria-hidden="true">
      <div className="hero-scene-plane">
        <span className="hero-scene-tag" style={{ top: "6%", left: "8%" }}>
          SF / MARKET ENGINE
        </span>
        <span
          className="hero-scene-tag is-accent"
          style={{ top: "6%", right: "12%" }}
        >
          SEEDED REPLAY · {run.scenario.seed}
        </span>
        <div className="hero-scene-candles">
          {candles.map((candle, i) => (
            <i
              key={i}
              className={candle.up ? "up" : "down"}
              style={
                {
                  "--i": i,
                  "--h": `${candle.height.toFixed(1)}%`,
                  "--wick": `${candle.wick.toFixed(0)}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <span className="hero-scene-tag" style={{ bottom: "7%", left: "8%" }}>
          ↑ SOL / USDC
        </span>
        <span
          className="hero-scene-tag is-price"
          style={{ bottom: "6%", right: "12%" }}
        >
          {usd(prices[prices.length - 1])}
        </span>
      </div>
    </div>
  );
}
