"use client";
import { useEffect, useRef } from "react";
import { animate, createTimeline, stagger, svg } from "animejs";
import { IconBolt, IconPlayerPlayFilled } from "@tabler/icons-react";
import CountUp from "../reactbits/CountUp";
import GlareHover from "../reactbits/GlareHover";
import { SCENARIO_RUNS, pricePath, usd } from "./scenario-runs";
import { useReducedMotion } from "./use-reduced-motion";

const W = 560;
const H = 220;
const run = SCENARIO_RUNS["whale-sell"];
const prices = run.state.priceHistoryCents;
const chart = pricePath(prices, W, H, 18);
const whale = run.scenario.events[0];
const fills = run.state.fills.filter((_, i) => i % 2 === 0).slice(0, 14);
const pnlCents = run.state.equityCents - run.state.startingEquityCents;
const last = prices[prices.length - 1];
const half = Math.round(run.strategy.spreadBps / 2);
const bid = Math.round(last * (1 - half / 10_000));
const ask = Math.round(last * (1 + half / 10_000));

export function HeroTerminal() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = root.current;
    if (!el || reduced) return;
    const [line] = svg.createDrawable(el.querySelector(".hero-line")!);
    const timeline = createTimeline({ delay: 450 })
      .add(line, { draw: ["0 0", "0 1"], duration: 2400, ease: "inOutQuad" })
      .add(
        el.querySelectorAll(".hero-area"),
        { opacity: [0, 1], duration: 800, ease: "outQuad" },
        "-=900"
      )
      .add(
        el.querySelectorAll(".hero-fill"),
        { scale: [0, 1], opacity: [0, 1], delay: stagger(70), duration: 420 },
        "-=1600"
      )
      .add(
        el.querySelectorAll(".hero-event"),
        { opacity: [0, 1], translateY: [8, 0], duration: 500 },
        "-=1000"
      );
    const pulse = animate(el.querySelectorAll(".hero-head"), {
      scale: [1, 1.9],
      opacity: [0.7, 0],
      duration: 1600,
      loop: true,
      ease: "outQuad",
    });
    return () => {
      timeline.revert();
      pulse.revert();
    };
  }, [reduced]);

  return (
    <GlareHover
      width="100%"
      height="auto"
      background="color-mix(in oklab, var(--card) 82%, transparent)"
      borderColor="color-mix(in oklab, var(--primary) 22%, transparent)"
      borderRadius="18px"
      glareColor="#9ff5d6"
      glareOpacity={0.14}
      glareSize={240}
      className="hero-terminal"
      style={{ cursor: "default" }}
    >
      <div ref={root} className="w-full p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="flex gap-1.5" aria-hidden="true">
              <i className="size-2.5 rounded-full bg-[#ff5f57]" />
              <i className="size-2.5 rounded-full bg-[#febc2e]" />
              <i className="size-2.5 rounded-full bg-[#28c840]" />
            </span>
            <span className="mono ml-2 text-[11px] tracking-wider text-muted-foreground">
              SOL/USDC · {run.scenario.name.toUpperCase()}
            </span>
          </div>
          <span className="landing-chip">
            <IconPlayerPlayFilled size={10} /> REPLAY · SEED {run.scenario.seed}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 py-3 text-left">
          <Quote label="BID" value={usd(bid)} tone="profit" />
          <Quote label="REFERENCE" value={usd(last)} />
          <Quote label="ASK" value={usd(ask)} tone="loss" />
        </div>

        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full overflow-visible"
            role="img"
            aria-label={`Deterministic ${run.scenario.name} price path with ${run.state.fills.length} simulated fills`}
          >
            <defs>
              <linearGradient id="hero-area" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--primary)"
                  stopOpacity="0.28"
                />
                <stop
                  offset="100%"
                  stopColor="var(--primary)"
                  stopOpacity="0"
                />
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
            <path className="hero-area" d={chart.area} fill="url(#hero-area)" />
            <g className="hero-event">
              <line
                x1={chart.x(whale.tick)}
                x2={chart.x(whale.tick)}
                y1="0"
                y2={H}
                stroke="var(--warning)"
                strokeDasharray="4 4"
                strokeOpacity="0.7"
              />
              <text
                x={chart.x(whale.tick) + 8}
                y="16"
                className="mono"
                fontSize="11"
                fill="var(--warning)"
              >
                {whale.label.toUpperCase()} {whale.priceMoveBps / 100}%
              </text>
            </g>
            <path
              className="hero-line"
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
                className="hero-fill"
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
              className="hero-head"
              cx={W}
              cy={chart.y(last)}
              r="5"
              fill="var(--primary)"
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
            <circle cx={W} cy={chart.y(last)} r="3.5" fill="var(--primary)" />
          </svg>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="SIM P&L">
            <span className={pnlCents >= 0 ? "profit" : "loss"}>
              {pnlCents < 0 ? "−" : "+"}$
              <CountUp
                to={Math.abs(pnlCents) / 100}
                duration={1}
                separator=","
              />
            </span>
          </Stat>
          <Stat label="FILLS">
            <CountUp to={run.state.fills.length} duration={1} />
          </Stat>
          <Stat label="MAX DRAWDOWN">
            <CountUp to={run.state.maxDrawdownBps / 100} duration={1} />%
          </Stat>
          <Stat label="SCORE">
            <span className="profit">
              <CountUp to={run.score.total} duration={1} separator="," />
            </span>
          </Stat>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-left text-[11px] text-muted-foreground">
          <IconBolt size={12} className="text-primary" />
          Real engine output: default strategy, {
            run.scenario.durationTicks
          }{" "}
          ticks, simulated balances only.
        </p>
      </div>
    </GlareHover>
  );
}

function Quote({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss";
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <small className="mono block text-[10px] tracking-wider text-muted-foreground">
        {label}
      </small>
      <b className={`mono text-[14px] ${tone ?? ""}`}>{value}</b>
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2 text-left">
      <small className="mono block text-[10px] tracking-wider text-muted-foreground">
        {label}
      </small>
      <b className="mono text-[15px]">{children}</b>
    </div>
  );
}
