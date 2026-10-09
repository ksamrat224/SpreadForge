"use client";
import {
  IconFlame,
  IconActivity,
  IconTrophy,
  IconCode,
  IconCheck,
  IconChartCandle,
  IconBulb,
  IconWallet,
  IconGauge,
  IconPalette,
  IconHistory,
} from "@tabler/icons-react";
import SpotlightCard from "../reactbits/SpotlightCard";
import AnimatedContent from "../reactbits/AnimatedContent";
import ScrollReveal from "../reactbits/ScrollReveal";
import { SectionHeading } from "./section-heading";

const modules = [
  {
    Icon: IconFlame,
    tag: "STRATEGY LAB",
    title: "Run a market-making strategy, tick by tick",
    body: "Set your spread, order size, inventory cap and refresh cycle, then watch your quotes meet a seeded market. Same seed, same strategy, same result, every time.",
    points: [
      "Live bid/ask quotes, fills, inventory and P&L",
      "Radial score meter and execution feed",
      "1×, 2× and 5× playback with pause and reset",
      "Illustrative depth ladder around your quotes",
    ],
    accent: "#2de2b0",
  },
  {
    Icon: IconActivity,
    tag: "PAPER DESK",
    title: "Practise execution against live prices",
    body: "Trade 20 crypto markets with a shared 10,000-USDC simulated portfolio. References stream from Pyth, with exchange fallbacks and historical replay.",
    points: [
      "Limit quotes, open orders and recent fills",
      "Reserved balances and portfolio-level P&L",
      "Optional devnet-wallet mirror of up to 10 SOL",
      "Candles, OHLC, Heikin-Ashi, depth and spread views",
    ],
    accent: "#60a5fa",
  },
  {
    Icon: IconTrophy,
    tag: "LEADERBOARD",
    title: "Compete on quality, not just profit",
    body: "Every run lands in your browser's history. With the Result Registry deployed, wallet-committed results rank globally in All-time and Weekly boards.",
    points: [
      "Personal run history with no wallet required",
      "Global rankings read straight from devnet",
      "Explorer proof links on every entry",
      "Honest labels: wallet-committed, never ‘verified’",
    ],
    accent: "#f5b84b",
  },
  {
    Icon: IconCode,
    tag: "MAGICBLOCK + SOLANA",
    title: "Fast sessions, one durable record",
    body: "Repeated session updates belong on an Ephemeral Rollup. Only the final hashed summary settles to a compact Solana PDA you can point anyone to.",
    points: [
      "Bounded PDA delegation with a scoped signer",
      "Router-discovered ER endpoints",
      "Commit-and-undelegate on completion",
      "Local deterministic fallback when the ER is unavailable",
    ],
    accent: "#a78bfa",
  },
];

const extras = [
  {
    Icon: IconBulb,
    title: "Teaching feedback",
    body: "Plain-language explanations of why your fills, inventory and score changed.",
  },
  {
    Icon: IconChartCandle,
    title: "Pro-grade charts",
    body: "Crosshair, zoom, drag, SMA/EMA/Bollinger/RSI/MACD/VWAP and ten chart views.",
  },
  {
    Icon: IconGauge,
    title: "Weighted score",
    body: "Liquidity, spread, inventory, drawdown and P&L, combined in one 0–10,000 number.",
  },
  {
    Icon: IconWallet,
    title: "Wallet Standard",
    body: "Connect any detected Solana wallet. Exploring the app never requires one.",
  },
  {
    Icon: IconHistory,
    title: "Historical replay",
    body: "Replay the last 12 hours of one-minute candles at adjustable speed.",
  },
  {
    Icon: IconPalette,
    title: "Built for every screen",
    body: "Dark and light themes plus desktop, tablet and mobile layouts.",
  },
];

export function Features() {
  return (
    <section id="features" className="landing-section">
      <div className="landing-container">
        <ScrollReveal
          baseOpacity={0.08}
          enableBlur
          baseRotation={2}
          blurStrength={6}
          containerClassName="landing-statement"
          textClassName="landing-statement-text"
        >
          Market makers earn the spread and carry the risk. SpreadForge lets you
          feel both, tick by tick, before a single real dollar is on the line.
        </ScrollReveal>

        <div className="mt-24">
          <SectionHeading
            eyebrow="THE PLATFORM"
            title="One lab. Four connected desks."
            description="Everything you need to learn liquidity provision, from your first spread to a public, hashed result."
          />
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {modules.map(({ Icon, tag, title, body, points, accent }, i) => (
            <AnimatedContent
              key={tag}
              distance={50}
              delay={(i % 2) * 0.12}
              threshold={0.12}
            >
              <SpotlightCard
                spotlightColor={accent}
                intensity={0.14}
                className="landing-module h-full"
                style={{ "--module-accent": accent } as React.CSSProperties}
              >
                <div className="flex items-center gap-3">
                  <span className="landing-module-icon">
                    <Icon size={20} />
                  </span>
                  <span className="mono text-[11px] tracking-[0.18em] text-[color:var(--module-accent)]">
                    {tag}
                  </span>
                </div>
                <h3 className="mt-6 text-[22px] leading-tight font-bold tracking-[-0.02em]">
                  {title}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                  {body}
                </p>
                <ul className="mt-6 grid gap-2.5">
                  {points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2.5 text-[13.5px]"
                    >
                      <IconCheck
                        size={15}
                        className="mt-0.5 shrink-0 text-[color:var(--module-accent)]"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </SpotlightCard>
            </AnimatedContent>
          ))}
        </div>

        <div className="mt-5 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {extras.map(({ Icon, title, body }, i) => (
            <AnimatedContent
              key={title}
              distance={24}
              delay={i * 0.06}
              threshold={0.1}
              className="bg-background"
            >
              <div className="landing-extra">
                <Icon size={18} className="text-primary" />
                <h4>{title}</h4>
                <p>{body}</p>
              </div>
            </AnimatedContent>
          ))}
        </div>
      </div>
    </section>
  );
}
