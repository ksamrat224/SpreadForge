"use client";
import { useRef, useState } from "react";
import { IconArrowUpRight } from "@tabler/icons-react";
import CardSwap, { Card, type CardSwapHandle } from "../reactbits/CardSwap";
import AnimatedContent from "../reactbits/AnimatedContent";
import { SectionHeading } from "./section-heading";
import { SCENARIO_RUNS, pricePath, usd } from "./scenario-runs";
import { CHALLENGE_META } from "../../lib/simulation/challenges";
import type { ScenarioId } from "../../lib/simulation/types";
import { useMediaQuery, useReducedMotion } from "./use-reduced-motion";

const ORDER: ScenarioId[] = ["stable-market", "whale-sell", "flash-crash"];
const TONE = {
  profit: "var(--profit)",
  warning: "var(--warning)",
  loss: "var(--loss)",
};

export function Challenges() {
  const reduced = useReducedMotion();
  // CardSwap needs room for its 3D fan; small screens get a plain stack.
  const compact = useMediaQuery("(max-width: 767px)");
  // The wider container leaves the deck a bigger column to fill.
  const wide = useMediaQuery("(min-width: 1280px)");
  const deck = useRef<CardSwapHandle>(null);
  // The row matching the card at the front of the deck stays highlighted.
  const [active, setActive] = useState<ScenarioId | null>(null);
  function choose(id: ScenarioId) {
    setActive(id);
    if (compact)
      // No deck on small screens: go to the matching card in the stack.
      document.getElementById(`challenge-${id}`)?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "center",
      });
    else deck.current?.bringToFront(ORDER.indexOf(id));
  }
  return (
    <section id="challenges" className="landing-section overflow-hidden">
      <div className="landing-container grid items-center gap-16 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="CHALLENGES / 03 MARKETS"
            title="Three markets. Escalating pressure."
            description="Every scenario is versioned and seeded, so your run can be reproduced and compared fairly with everyone else's."
          />
          <div className="mt-10 grid gap-3">
            {ORDER.map((id, i) => {
              const meta = CHALLENGE_META[id];
              const scenario = SCENARIO_RUNS[id].scenario;
              return (
                <AnimatedContent
                  key={id}
                  distance={30}
                  delay={i * 0.1}
                  threshold={0.15}
                >
                  <button
                    type="button"
                    className="landing-challenge-row"
                    style={{ "--tone": TONE[meta.tone] } as React.CSSProperties}
                    aria-pressed={active === id}
                    onClick={() => choose(id)}
                  >
                    <span className="mono">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="landing-challenge-text">
                      <b>
                        {scenario.name}
                        <em>{meta.level}</em>
                      </b>
                      <small>{meta.tip}</small>
                    </span>
                    <IconArrowUpRight
                      size={18}
                      className="landing-challenge-arrow"
                      aria-hidden="true"
                    />
                  </button>
                </AnimatedContent>
              );
            })}
          </div>
        </div>

        {compact ? (
          <div className="grid gap-4">
            {ORDER.map((id, i) => (
              <AnimatedContent
                key={id}
                distance={40}
                delay={i * 0.08}
                threshold={0.1}
              >
                <div
                  id={`challenge-${id}`}
                  className={`landing-scenario-card h-[330px] ${active === id ? "is-active" : ""}`}
                  style={
                    {
                      "--tone": TONE[CHALLENGE_META[id].tone],
                    } as React.CSSProperties
                  }
                >
                  <ScenarioCard id={id} />
                </div>
              </AnimatedContent>
            ))}
          </div>
        ) : (
          <div className="relative h-[520px] xl:h-[600px]">
            <CardSwap
              ref={deck}
              onFrontChange={(index) => setActive(ORDER[index])}
              width={wide ? 540 : 420}
              height={wide ? 410 : 330}
              cardDistance={48}
              verticalDistance={56}
              delay={reduced ? 600_000 : 4200}
              pauseOnHover
              skewAmount={4}
            >
              {ORDER.map((id) => (
                <Card key={id} customClass="landing-scenario-card">
                  <ScenarioCard id={id} />
                </Card>
              ))}
            </CardSwap>
          </div>
        )}
      </div>
    </section>
  );
}

function ScenarioCard({ id }: { id: ScenarioId }) {
  const run = SCENARIO_RUNS[id];
  const meta = CHALLENGE_META[id];
  const prices = run.state.priceHistoryCents;
  const chart = pricePath(prices, 380, 120, 10);
  const tone = TONE[meta.tone];
  const pnl = run.state.equityCents - run.state.startingEquityCents;
  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="mono text-[10px] tracking-[0.18em] text-muted-foreground">
          {meta.volatility} VOLATILITY
        </span>
        <span
          className="landing-level"
          style={{ color: tone, borderColor: tone }}
        >
          {meta.level.toUpperCase()}
        </span>
      </div>
      <h3 className="mt-3 text-[20px] font-bold tracking-[-0.02em]">
        {run.scenario.name}
      </h3>
      <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
        {meta.description}
      </p>
      <svg
        viewBox="0 0 380 120"
        className="mt-auto h-auto w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`sc-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.3" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={chart.area} fill={`url(#sc-${id})`} />
        {run.scenario.events.map((event) => (
          <line
            key={event.tick}
            x1={chart.x(event.tick)}
            x2={chart.x(event.tick)}
            y1="0"
            y2="120"
            stroke={tone}
            strokeOpacity="0.45"
            strokeDasharray="3 4"
          />
        ))}
        <path
          d={chart.line}
          fill="none"
          stroke={tone}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-[11px]">
        <span>
          <small className="mono block text-muted-foreground">SEED</small>
          <b className="mono">{run.scenario.seed}</b>
        </span>
        <span>
          <small className="mono block text-muted-foreground">
            DEFAULT P&L
          </small>
          <b className={`mono ${pnl >= 0 ? "profit" : "loss"}`}>
            {pnl >= 0 ? "+" : "−"}
            {usd(Math.abs(pnl), 0)}
          </b>
        </span>
        <span>
          <small className="mono block text-muted-foreground">
            DEFAULT SCORE
          </small>
          <b className="mono">{run.score.total.toLocaleString("en-US")}</b>
        </span>
      </div>
    </div>
  );
}
