import Image from "next/image";
import Link from "next/link";
import { IconShieldCheck } from "@tabler/icons-react";
import { LandingNav } from "./landing-nav";
import { Hero } from "./hero";
import { MarketTicker } from "./market-ticker";
import { Experience } from "./experience";
import { Workflow } from "./workflow";
import { Challenges } from "./challenges";
import { Scoring } from "./scoring";
import { UnderTheHood } from "./under-the-hood";
import { FinalCta } from "./final-cta";

export function LandingPage() {
  return (
    // No theme class here: the landing follows the site-wide theme toggle.
    <div className="landing">
      <LandingNav />
      <main>
        <Hero />
        <Experience />
        <Workflow />
        <Challenges />
        <Scoring />
        <UnderTheHood />
        <FinalCta />
      </main>
      <footer className="landing-footer">
        <div className="landing-container flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5 text-foreground">
            <Image
              src="/SpreadForge.png"
              alt=""
              width={24}
              height={24}
              className="brand-logo"
            />
            <span className="brand-word text-[13px]">
              <b>SPREAD</b>FORGE
            </span>
          </div>
          <p>
            Learn. Simulate. Compete. · Solana DeFi Market-Making Laboratory
          </p>
          <p className="flex items-center gap-1.5">
            <IconShieldCheck size={13} />
            Educational simulation. No real funds at risk.
            <Link href="/app" className="ml-3 text-primary hover:underline">
              Launch app
            </Link>
          </p>
        </div>
      </footer>
      {/* Outside <main> so it stays pinned above every section and the footer. */}
      <MarketTicker />
    </div>
  );
}
