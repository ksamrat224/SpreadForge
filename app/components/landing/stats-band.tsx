"use client";
import CountUp from "../reactbits/CountUp";
import AnimatedContent from "../reactbits/AnimatedContent";
import { PAPER_ASSETS } from "../../lib/simulation/paper";
import { SCENARIOS } from "../../lib/simulation/scenarios";
import { SCORE_MAX } from "../../lib/simulation/score";

const stats = [
  { value: Object.keys(SCENARIOS).length, label: "Seeded challenge scenarios" },
  { value: PAPER_ASSETS.length, label: "Paper markets with live references" },
  { value: 10_000, prefix: "$", label: "Simulated USDC buying power" },
  { value: SCORE_MAX, label: "Maximum deterministic score" },
];

export function StatsBand() {
  return (
    <section
      aria-label="SpreadForge at a glance"
      className="landing-container py-16"
    >
      <div className="landing-stats">
        {stats.map(({ value, label, prefix }, i) => (
          <AnimatedContent
            key={label}
            distance={30}
            delay={i * 0.08}
            threshold={0.15}
          >
            <div className="landing-stat">
              <b className="mono">
                {prefix}
                <CountUp to={value} duration={1} separator="," />
              </b>
              <span>{label}</span>
            </div>
          </AnimatedContent>
        ))}
      </div>
    </section>
  );
}
