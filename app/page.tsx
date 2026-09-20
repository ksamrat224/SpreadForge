"use client";

import { useState } from "react";
import { GridBackground } from "./components/grid-background";
import { PaperTradingDesk } from "./components/paper-trading-desk";
import { SimulationLab } from "./components/simulation-lab";
import { ThemeToggle } from "./components/theme-toggle";
import { WalletButton } from "./components/wallet-button";

export default function Home() {
  const [section, setSection] = useState<"paper" | "strategy">("strategy");
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <GridBackground />
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <header className="flex min-h-18 items-center justify-between gap-4 py-4">
          <a
            className="flex items-center gap-2.5 font-bold tracking-tight"
            href="#strategy-lab"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-lg text-primary-foreground shadow-sm">
              S
            </span>
            <span>SpreadForge</span>
          </a>
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-3 text-sm font-medium sm:flex"
          >
            <button
              onClick={() => setSection("paper")}
              className={`min-h-10 rounded-md px-3 py-2 transition focus-visible:ring-2 focus-visible:ring-ring ${section === "paper" ? "bg-accent text-primary" : "text-muted hover:text-primary"}`}
            >
              Paper Trading
            </button>
            <button
              onClick={() => setSection("strategy")}
              className={`min-h-10 rounded-md px-3 py-2 transition focus-visible:ring-2 focus-visible:ring-ring ${section === "strategy" ? "bg-accent text-primary" : "text-muted hover:text-primary"}`}
            >
              Strategy Lab
            </button>
            {section === "strategy" && (
              <a
                className="rounded-md px-2 py-2 text-muted transition hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                href="#challenges"
              >
                Challenges
              </a>
            )}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <WalletButton />
          </div>
        </header>
        <main id="strategy-lab">
          <section className="mx-auto max-w-3xl py-8 text-center sm:py-12">
            <p className="text-sm font-semibold tracking-[.16em] text-primary">
              LEARN · PRACTICE · COMPETE
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Learn market making without risking real money.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
              Choose a challenge, tune a simple strategy, and see how price
              moves, fills, and inventory risk change the outcome.
            </p>
          </section>
          {section === "paper" ? <PaperTradingDesk /> : <SimulationLab />}
        </main>
      </div>
    </div>
  );
}
