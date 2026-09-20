"use client";
import { useState } from "react";
import {
  IconFlame,
  IconActivity,
  IconTrophy,
  IconCode,
  IconBolt,
  IconShieldCheck,
} from "@tabler/icons-react";
import { SimulationLab, ChallengeDrawer } from "./components/simulation-lab";
import { PaperTradingDesk } from "./components/paper-trading-desk";
import { Architecture, Leaderboard } from "./components/community-pages";
import { WalletButton } from "./components/wallet-button";
import { ThemeToggle } from "./components/theme-toggle";
import { ClusterSelect } from "./components/cluster-select";
import { ForgeMark } from "./components/terminal-ui";
import { type ScenarioId } from "./lib/simulation";
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
  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => setTab("strategy")}
          aria-label="SpreadForge home"
        >
          <ForgeMark />
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
          <SimulationLab
            key={session}
            initialScenario={scenario}
            onScenarioChange={setScenario}
          />
        </div>
        {tab === "paper" && <PaperTradingDesk />}
        {tab === "leaderboard" && <Leaderboard />}
        {tab === "magicblock" && <Architecture />}
      </main>
      <footer className="app-footer">
        <span>
          <IconShieldCheck size={12} />
          EDUCATIONAL SIMULATION · NO REAL FUNDS AT RISK
        </span>
        <span>
          <span className="status-dot" />
          LOCAL ENGINE ONLINE <span>·</span> BUILT ON SOLANA
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
        <ChallengeDrawer
          selected={scenario}
          onClose={() => setDrawer(false)}
          onSelect={(id) => {
            setScenario(id);
            setSession((value) => value + 1);
            setTab("strategy");
          }}
        />
      )}
    </div>
  );
}
