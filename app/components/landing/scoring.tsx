"use client";
import { useEffect, useRef } from "react";
import { animate, onScroll, stagger } from "animejs";
import AnimatedContent from "../reactbits/AnimatedContent";
import GradientText from "../reactbits/GradientText";
import CountUp from "../reactbits/CountUp";
import { SectionHeading } from "./section-heading";
import { SCORE_MAX, SCORE_WEIGHTS } from "../../lib/simulation/score";
import { useReducedMotion } from "./use-reduced-motion";

const components: Array<{
  key: keyof typeof SCORE_WEIGHTS;
  label: string;
  detail: string;
}> = [
  {
    key: "liquidity",
    label: "Liquidity uptime",
    detail: "Share of ticks your strategy is actively quoting.",
  },
  {
    key: "spreadEfficiency",
    label: "Spread efficiency",
    detail: "Distance from the 30 bps learning baseline.",
  },
  {
    key: "inventoryControl",
    label: "Inventory control",
    detail: "How close you finish to the 100 SOL start, relative to your cap.",
  },
  {
    key: "drawdownControl",
    label: "Drawdown control",
    detail: "Penalty for peak-to-trough simulated equity loss.",
  },
  {
    key: "pnl",
    label: "Simulated P&L",
    detail: "Normalised change in simulated account equity.",
  },
];

export function Scoring() {
  const bars = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = bars.current;
    if (!el || reduced) return;
    const fill = animate(el.querySelectorAll(".landing-weight-fill"), {
      scaleX: [0, 1],
      delay: stagger(110),
      duration: 1100,
      ease: "outExpo",
      autoplay: onScroll({
        target: el,
        enter: { target: "top", container: "85%" },
      }),
    });
    return () => {
      fill.revert();
    };
  }, [reduced]);

  return (
    <section id="scoring" className="landing-section">
      <div className="landing-container grid items-start gap-14 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="TRANSPARENT SCORING / 0—10,000"
            title="Rewarding healthy liquidity, not lucky P&L."
            description="Each component is clamped to 0–100, then weighted into a single deterministic score. Same inputs, same score, every time."
          />
          <AnimatedContent distance={30} delay={0.15}>
            <div className="landing-score-total">
              <span className="mono text-[11px] tracking-[0.18em] text-muted-foreground">
                MAXIMUM SCORE
              </span>
              <GradientText
                colors={["#2de2b0", "#8b5cf6", "#60a5fa", "#2de2b0"]}
                animationSpeed={6}
                className="landing-score-number"
              >
                <CountUp to={SCORE_MAX} duration={1} separator="," />
              </GradientText>
            </div>
          </AnimatedContent>
          <AnimatedContent distance={30} delay={0.25}>
            <pre className="landing-code mono" aria-label="Score formula">
              {`score = round((
    liquidity          × ${SCORE_WEIGHTS.liquidity.toFixed(2)}
  + spread efficiency  × ${SCORE_WEIGHTS.spreadEfficiency.toFixed(2)}
  + inventory control  × ${SCORE_WEIGHTS.inventoryControl.toFixed(2)}
  + drawdown control   × ${SCORE_WEIGHTS.drawdownControl.toFixed(2)}
  + P&L                × ${SCORE_WEIGHTS.pnl.toFixed(2)}
) × 100)`}
            </pre>
          </AnimatedContent>
        </div>

        <div ref={bars} className="landing-weights">
          {components.map(({ key, label, detail }) => {
            const weight = Math.round(SCORE_WEIGHTS[key] * 100);
            return (
              <div key={key} className="landing-weight">
                <div className="flex items-baseline justify-between gap-4">
                  <h3>{label}</h3>
                  <b className="mono">{weight}%</b>
                </div>
                <p>{detail}</p>
                <span className="landing-weight-track">
                  <span
                    className="landing-weight-fill"
                    style={{ width: `${(weight / 30) * 100}%` }}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
