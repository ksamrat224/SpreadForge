"use client";
import { useState } from "react";
import Image from "next/image";
import {
  IconFlame,
  IconActivity,
  IconTrophy,
  IconCode,
  IconBolt,
  IconShieldCheck,
} from "@tabler/icons-react";
import { RankedChallengeDrawer } from "../components/ranked-challenge-drawer";
import { RankedStrategyLab } from "../components/ranked-strategy-lab";
import { PaperTradingDesk } from "../components/paper-trading-desk";
import { Architecture, Leaderboard } from "../components/community-pages";
import { WalletButton } from "../components/wallet-button";
import { ThemeToggle } from "../components/theme-toggle";
import { ClusterSelect } from "../components/cluster-select";
import { type ScenarioId } from "../lib/simulation";
const tabs = [
  { id: "strategy", label: "Strategy Lab", Icon: IconFlame },
  { id: "paper", label: "Paper Trading", Icon: IconActivity },
  { id: "leaderboard", label: "Leaderboard", Icon: IconTrophy },
  { id: "magicblock", label: "MagicBlock", Icon: IconCode },
] as const;
type Tab = (typeof tabs)[number]["id"];
export default function Home() {
  const [tab, setTab] = useState<Tab>("strategy");
  const [drawer, setDrawer] = useState(false);
  const [scenario, setScenario] = useState<ScenarioId>("whale-sell");
  const [session, setSession] = useState(0);
  const [rankedRunBusy, setRankedRunBusy] = useState(false);
  const rankedRunsEnabled =
    process.env.NEXT_PUBLIC_RANKED_RUNS_ENABLED === "true";
  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => setTab("strategy")}
          aria-label="SpreadForge home"
        >
          <Image
            src="/SpreadForge.png"
            alt=""
            width={34}
            height={34}
            priority
            className="brand-logo"
          />
          <span className="brand-word">
            <b>SPREAD</b>FORGE
          </span>
          <em>LAB</em>
        </button>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? "active" : ""}`}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="btn ghost"
            aria-label="Choose challenge"
            onClick={() => setDrawer(true)}
            disabled={rankedRunBusy}
          >
            <IconBolt size={15} />
            <span className="challenge-label">Challenges</span>
          </button>
          <ClusterSelect />
          <ThemeToggle />
          <WalletButton />
        </div>
      </header>
      <main>
        <div hidden={tab !== "strategy"}>
          <RankedStrategyLab
            key={session}
            initialScenario={scenario}
            onScenarioChange={setScenario}
            onBusyChange={setRankedRunBusy}
            active={tab === "strategy"}
          />
        </div>
        <div hidden={tab !== "paper"}>
          <PaperTradingDesk active={tab === "paper"} />
        </div>
        <div hidden={tab !== "leaderboard"}>
          <Leaderboard active={tab === "leaderboard"} />
        </div>
        <div hidden={tab !== "magicblock"}>
          <Architecture />
        </div>
      </main>
      <footer className="app-footer">
        <span>
          <IconShieldCheck size={12} />
          EDUCATIONAL SIMULATION · NO REAL FUNDS AT RISK
        </span>
        <span>
          <span className="status-dot" />
          {rankedRunsEnabled ? "DEVNET RANKED ENGINE" : "RANKED RUNS OFF"}{" "}
          <span>·</span> BUILT ON SOLANA
        </span>
      </footer>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            aria-label={label}
            aria-current={tab === id ? "page" : undefined}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={21} />
          </button>
        ))}
      </nav>
      {drawer && (
        <RankedChallengeDrawer
          selected={scenario}
          onClose={() => setDrawer(false)}
          onSelect={(id) => {
            if (rankedRunBusy) return;
            setScenario(id);
            setSession((value) => value + 1);
            setTab("strategy");
          }}
        />
      )}
    </div>
  );
}
