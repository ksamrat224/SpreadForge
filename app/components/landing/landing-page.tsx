"use client";
import Image from "next/image";
import Link from "next/link";
import { IconShieldCheck } from "@tabler/icons-react";
import { LandingNav } from "./landing-nav";
import { Hero } from "./hero";
import { MarketTicker } from "./market-ticker";
import { StatsBand } from "./stats-band";
import { Features } from "./features";
import { Workflow } from "./workflow";
import { Challenges } from "./challenges";
import { Scoring } from "./scoring";
import { Verification } from "./verification";
import { FinalCta } from "./final-cta";

export function LandingPage() {
  return (
    <div className="landing dark">
      <LandingNav />
      <main>
        <Hero />
        <MarketTicker />
        <StatsBand />
        <Features />
        <Workflow />
        <Challenges />
        <Scoring />
        <Verification />
        <FinalCta />
      </main>
      <footer className="landing-footer">
        <div className="landing-container flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/SpreadForge.png"
              alt=""
              width={26}
              height={26}
              className="brand-logo"
            />
            <span className="brand-word text-[14px]">
              <b>SPREAD</b>FORGE
            </span>
          </div>
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <IconShieldCheck size={13} />
            Educational simulation. No real funds at risk. Built on Solana.
          </p>
          <nav
            aria-label="Footer"
            className="flex gap-5 text-[12px] text-muted-foreground"
          >
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#workflow" className="hover:text-foreground">
              Workflow
            </a>
            <Link href="/app" className="text-primary hover:underline">
              Launch app
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
