"use client";

import { ClusterSelect } from "./components/cluster-select";
import { GridBackground } from "./components/grid-background";
import { SimulationLab } from "./components/simulation-lab";
import { ThemeToggle } from "./components/theme-toggle";
import { WalletButton } from "./components/wallet-button";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#080b11] text-white">
      <GridBackground />
      <div className="relative z-10 mx-auto max-w-7xl px-5 pb-12 sm:px-8">
        <header className="flex items-center justify-between py-5">
          <a
            className="flex items-center gap-2 font-semibold tracking-tight"
            href="#lab"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#14f195] to-[#a17aff] font-black text-[#070a0f]">
              S
            </span>
            SpreadForge
          </a>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ClusterSelect />
            <WalletButton />
          </div>
        </header>
        <main id="lab">
          <section className="max-w-3xl py-10 sm:py-16">
            <p className="text-sm font-semibold tracking-[.18em] text-[#14f195]">
              LEARN · SIMULATE · COMPETE
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
              Master market making without risking real money.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/60">
              Build a liquidity strategy, run it through a repeatable SOL/USDC
              scenario, and see exactly how spread, fills, and inventory risk
              shape its score.
            </p>
          </section>
          <SimulationLab />
        </main>
      </div>
    </div>
  );
}
