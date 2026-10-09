"use client";
import { useEffect, useRef } from "react";
import { animate, onScroll } from "animejs";
import {
  IconBolt,
  IconAdjustmentsHorizontal,
  IconPlayerPlay,
  IconGauge,
  IconShieldCheck,
} from "@tabler/icons-react";
import AnimatedContent from "../reactbits/AnimatedContent";
import { SectionHeading } from "./section-heading";
import { useReducedMotion } from "./use-reduced-motion";

const steps = [
  {
    Icon: IconBolt,
    title: "Pick a challenge",
    body: "Open the Challenges drawer and choose Stable Market, Whale Sell or Flash Crash & Recovery. Each one is a versioned scenario with a fixed seed.",
    meta: "SCENARIO · SEED · VERSION",
  },
  {
    Icon: IconAdjustmentsHorizontal,
    title: "Tune your strategy",
    body: "Set the spread, order size, maximum inventory and refresh cycle. Inline hints explain the trade-off behind each control before you commit to it.",
    meta: "SPREAD 30 BPS · SIZE 2 SOL · CAP 120 SOL",
  },
  {
    Icon: IconPlayerPlay,
    title: "Run the simulation",
    body: "Start the 60-tick challenge and watch your quotes, fills, inventory and P&L respond in real time. Teaching feedback explains what just happened and why.",
    meta: "60 TICKS · 1× / 2× / 5×",
  },
  {
    Icon: IconGauge,
    title: "Review your score",
    body: "Get a 0–10,000 score broken into liquidity, spread, inventory, drawdown and P&L. The run is saved locally and a SHA-256 result commitment is prepared.",
    meta: "WEIGHTED SCORE · LOCAL HISTORY",
  },
  {
    Icon: IconShieldCheck,
    title: "Commit and compete",
    body: "Connect a devnet wallet to write a compact result PDA to the Result Registry, then climb the All-time and Weekly leaderboards with an explorer proof link.",
    meta: "DEVNET · RESULT REGISTRY PDA",
  },
];

export function Workflow() {
  const list = useRef<HTMLOListElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = list.current;
    if (!el || reduced) return;
    const rail = el.querySelector<HTMLElement>(".landing-rail-fill")!;
    const progress = animate(rail, {
      scaleY: [0, 1],
      ease: "linear",
      autoplay: onScroll({
        target: el,
        enter: { target: "top", container: "center" },
        leave: { target: "bottom", container: "center" },
        sync: 0.25,
      }),
    });
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-step]"));
    const observers = nodes.map((node) =>
      onScroll({
        target: node,
        enter: { target: "top", container: "center" },
        onEnterForward: () => node.classList.add("is-active"),
        onLeaveBackward: () => node.classList.remove("is-active"),
      })
    );
    return () => {
      progress.revert();
      observers.forEach((observer) => observer.revert());
    };
  }, [reduced]);

  return (
    <section id="workflow" className="landing-section">
      <div className="landing-container grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            eyebrow="THE WORKFLOW"
            title="From first quote to public proof in five steps."
            description="SpreadForge teaches by showing cause and effect. Every step tells you what changed, what the market did and why your score moved."
          />
          <AnimatedContent distance={30} delay={0.2}>
            <div className="landing-note mt-8">
              <b>Prefer manual trading?</b> The Paper Desk runs alongside the
              lab. Place limit quotes on live BTC, ETH, SOL and 17 more markets
              whenever you like. No wallet is required.
            </div>
          </AnimatedContent>
        </div>

        <ol
          ref={list}
          className={`landing-steps ${reduced ? "is-static" : ""}`}
        >
          <span className="landing-rail" aria-hidden="true">
            <span className="landing-rail-fill" />
          </span>
          {steps.map(({ Icon, title, body, meta }, i) => (
            <li key={title} data-step={i + 1}>
              <span className="landing-step-node" aria-hidden="true">
                <Icon size={18} />
              </span>
              <AnimatedContent
                distance={40}
                direction="horizontal"
                threshold={0.2}
              >
                <div className="landing-step-card">
                  <span className="mono text-[11px] tracking-[0.16em] text-muted-foreground">
                    STEP {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <code className="mono">{meta}</code>
                </div>
              </AnimatedContent>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
