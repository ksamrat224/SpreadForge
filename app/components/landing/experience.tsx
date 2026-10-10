"use client";
import { useEffect, useMemo, useState } from "react";
import {
  IconActivity,
  IconArrowUpRight,
  IconBolt,
  IconShieldCheck,
  IconTrophy,
} from "@tabler/icons-react";
import { DEFAULT_STRATEGY, runSimulation } from "../../lib/simulation/engine";
import { SCENARIOS } from "../../lib/simulation/scenarios";
import { SCORE_MAX } from "../../lib/simulation/score";
import { CHALLENGE_META } from "../../lib/simulation/challenges";
import { createResultCommitment } from "../../lib/results/commitment";
import type { ScenarioId, SimulationResult } from "../../lib/simulation/types";
import { SectionHeading } from "./section-heading";
import { usd } from "./scenario-runs";

const ORDER: ScenarioId[] = ["stable-market", "whale-sell", "flash-crash"];
// The same range as the Strategy Lab's spread control.
const SPREAD = { min: 10, max: 100 };

/**
 * Learn, simulate, compete in miniature. Choosing a regime or moving the
 * spread re-runs the real deterministic engine, so the score and commitment
 * shown here are exactly what the lab would produce for those inputs.
 */
export function Experience() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("whale-sell");
  const [spreadBps, setSpreadBps] = useState(DEFAULT_STRATEGY.spreadBps);
  const run = useMemo(
    () =>
      runSimulation(SCENARIOS[scenarioId], { ...DEFAULT_STRATEGY, spreadBps }),
    [scenarioId, spreadBps]
  );
  // Keyed by run so a slower hash never shows under newer inputs.
  const [commitment, setCommitment] = useState<{
    run: SimulationResult;
    hash: string;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    createResultCommitment(run).then(
      ({ resultHash }) => alive && setCommitment({ run, hash: resultHash }),
      () => undefined
    );
    return () => {
      alive = false;
    };
  }, [run]);

  const hash = commitment?.run === run ? commitment.hash : null;
  const reference = run.state.priceHistoryCents[0];
  const half = spreadBps / 2 / 10_000;
  const percent = ((spreadBps - SPREAD.min) / (SPREAD.max - SPREAD.min)) * 100;

  return (
    <section id="experience" className="landing-section">
      <div className="landing-container">
        <SectionHeading
          size="lg"
          eyebrow="THE EXPERIENCE / 01—03"
          title="Quant skill is earned."
          description="From your first quote to your final score, every tick teaches you something the textbook can't."
        />

        <div className="landing-bento">
          <article className="landing-panel landing-bento-card">
            <p className="landing-bento-label">01 / LEARN</p>
            <div className="landing-bento-stage">
              <p className="landing-bento-label">SELECT A MARKET REGIME</p>
              <div className="landing-regimes">
                {ORDER.map((id, i) => (
                  <button
                    key={id}
                    type="button"
                    className="landing-regime"
                    aria-pressed={id === scenarioId}
                    onClick={() => setScenarioId(id)}
                  >
                    {SCENARIOS[id].name.toUpperCase()}
                    <span>
                      {String(i + 1).padStart(2, "0")}
                      {id === scenarioId && <IconArrowUpRight size={12} />}
                    </span>
                  </button>
                ))}
              </div>
              <p className="landing-regime-note">
                {CHALLENGE_META[scenarioId].description}
              </p>
            </div>
            <div className="landing-bento-foot">
              <IconBolt size={20} />
              <h3>Understand the market.</h3>
              <p>
                Start with seeded scenarios that make volatility, inventory, and
                spread feel tangible.
              </p>
            </div>
          </article>

          <article className="landing-panel landing-bento-card">
            <p className="landing-bento-label">02 / SIMULATE</p>
            <div className="landing-bento-stage">
              <label className="landing-bento-label" htmlFor="landing-spread">
                SPREAD / BPS
              </label>
              <p className="landing-spread-value">
                {spreadBps}
                <IconArrowUpRight size={22} stroke={2.5} />
              </p>
              <input
                id="landing-spread"
                className="landing-range"
                type="range"
                min={SPREAD.min}
                max={SPREAD.max}
                step={1}
                value={spreadBps}
                onChange={(event) => setSpreadBps(Number(event.target.value))}
                style={{ "--pct": `${percent}%` } as React.CSSProperties}
              />
              <div className="landing-range-scale">
                <span>{SPREAD.min}</span>
                <span>{SPREAD.max}</span>
              </div>
              <div className="landing-quotes">
                <div>
                  <small>YOUR BID</small>
                  <b>{usd(Math.round(reference * (1 - half)))}</b>
                </div>
                <div>
                  <small>YOUR ASK</small>
                  <b>{usd(Math.round(reference * (1 + half)))}</b>
                </div>
              </div>
            </div>
            <div className="landing-bento-foot">
              <IconActivity size={20} />
              <h3>Find your edge.</h3>
              <p>
                Tune your quotes, absorb price shocks, and watch every decision
                play out across {run.scenario.durationTicks} ticks.
              </p>
            </div>
          </article>

          <article className="landing-panel landing-bento-card landing-bento-wide">
            <p className="landing-bento-label">03 / COMPETE</p>
            <div className="landing-compete mt-8">
              <div className="landing-bento-foot">
                <IconTrophy size={20} />
                <h3>Make it count.</h3>
                <p>
                  Commit your result hash to the devnet Result Registry with
                  your wallet, then take your score to the leaderboard.
                </p>
              </div>
              <div className="landing-result" aria-live="polite">
                <span className="landing-result-badge">
                  <IconShieldCheck size={56} stroke={1.4} />
                </span>
                <div>
                  <small className="is-accent">
                    ENGINE SCORE / {run.scenario.name.toUpperCase()}
                  </small>
                  <p className="landing-result-score">
                    <b>{run.score.total.toLocaleString("en-US")}</b>
                    <span>/ {SCORE_MAX.toLocaleString("en-US")}</span>
                  </p>
                  <p className="landing-result-proof">
                    <i className="landing-dot" aria-hidden="true" />
                    SHA-256 COMMITMENT ·{" "}
                    {hash
                      ? `${hash.slice(0, 6)}…${hash.slice(-4)}`
                      : "HASHING…"}
                  </p>
                  <small className="mt-3">
                    SEED {run.scenario.seed} · {run.state.fills.length} FILLS ·
                    SIMULATED BALANCES
                  </small>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
