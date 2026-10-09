"use client";
import Link from "next/link";
import {
  IconArrowRight,
  IconArrowDown,
  IconShieldCheck,
  IconCpu,
  IconMathFunction,
} from "@tabler/icons-react";
import Threads from "../reactbits/Threads";
import SplitText from "../reactbits/SplitText";
import BlurText from "../reactbits/BlurText";
import RotatingText from "../reactbits/RotatingText";
import ShinyText from "../reactbits/ShinyText";
import StarBorder from "../reactbits/StarBorder";
import Magnet from "../reactbits/Magnet";
import AnimatedContent from "../reactbits/AnimatedContent";
import { HeroTerminal } from "./hero-terminal";
import { useReducedMotion } from "./use-reduced-motion";

export function Hero() {
  const reduced = useReducedMotion();
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden pt-28 pb-20 sm:pt-36 lg:pb-28"
    >
      <div className="absolute inset-0 -z-10 opacity-70" aria-hidden="true">
        <Threads
          color="#2de2b0"
          accentColor="#8b5cf6"
          amplitude={1.1}
          distance={0.35}
          enableMouseInteraction={!reduced}
          paused={reduced}
        />
      </div>
      <div className="landing-hero-fade -z-10" aria-hidden="true" />

      <div className="landing-container grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <AnimatedContent distance={20} duration={0.8} threshold={0}>
            <span className="landing-badge">
              <span className="status-dot" />
              <ShinyText
                text="Solana devnet · MagicBlock Ephemeral Rollups"
                color="#9fb3bb"
                shineColor="#e9fff7"
                speed={3}
              />
            </span>
          </AnimatedContent>

          <SplitText
            tag="h1"
            text="Master market making without risking real money."
            splitType="words"
            delay={70}
            duration={1}
            threshold={0}
            rootMargin="0px"
            textAlign="left"
            className="mt-6 text-[clamp(2.6rem,6.4vw,4.9rem)] leading-[0.98] font-extrabold tracking-[-0.045em] text-foreground"
          />

          <div className="mt-6 flex flex-wrap items-center gap-3 text-[clamp(1.1rem,2vw,1.4rem)] font-semibold">
            <span className="text-muted-foreground">Built to</span>
            <RotatingText
              texts={[
                "learn liquidity.",
                "test strategies.",
                "compete.",
                "prove results.",
              ]}
              mainClassName="landing-rotator"
              staggerFrom="last"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-120%" }}
              staggerDuration={0.02}
              splitLevelClassName="overflow-hidden pb-0.5"
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              rotationInterval={2400}
              auto={!reduced}
            />
          </div>

          <BlurText
            text="Configure a quoting strategy, run it against deterministic market scenarios, practise manual execution against live Pyth prices, and commit a compact, hashed result to Solana."
            delay={22}
            stepDuration={0.25}
            direction="bottom"
            className="mt-6 max-w-xl text-[16px] leading-relaxed text-muted-foreground"
          />

          <AnimatedContent
            distance={24}
            duration={0.8}
            delay={0.5}
            threshold={0}
          >
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Magnet padding={60} magnetStrength={4}>
                <StarBorder
                  as={Link}
                  href="/app"
                  color="#5ff5c4"
                  backgroundColor="var(--primary)"
                  textColor="var(--primary-foreground)"
                  borderColor="color-mix(in oklab, var(--primary) 60%, white)"
                  radius={10}
                  stars={2}
                  glow={0.9}
                  className="landing-cta-primary"
                >
                  Launch SpreadForge
                  <IconArrowRight size={17} />
                </StarBorder>
              </Magnet>
              <a href="#workflow" className="landing-cta-secondary">
                See the workflow
                <IconArrowDown size={16} />
              </a>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <IconShieldCheck size={14} className="text-primary" />
                No real funds at risk
              </li>
              <li className="flex items-center gap-1.5">
                <IconCpu size={14} className="text-primary" />
                Deterministic, seeded engine
              </li>
              <li className="flex items-center gap-1.5">
                <IconMathFunction size={14} className="text-primary" />
                Open scoring formula
              </li>
            </ul>
          </AnimatedContent>
        </div>

        <AnimatedContent
          distance={60}
          duration={1.1}
          delay={0.3}
          threshold={0}
          scale={0.96}
        >
          <HeroTerminal />
        </AnimatedContent>
      </div>
    </section>
  );
}
