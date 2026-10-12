"use client";
import { useState } from "react";
import Image from "next/image";
import { MotionConfig, motion } from "motion/react";
import {
  IconFlame,
  IconActivity,
  IconTrophy,
  IconBolt,
  IconShieldCheck,
  IconChevronRight,
  IconBriefcase,
  IconUsersGroup,
} from "@tabler/icons-react";
import { RankedChallengeDrawer } from "../components/ranked-challenge-drawer";
import { RankedStrategyLab } from "../components/ranked-strategy-lab";
import { PaperTradingDesk } from "../components/paper-trading-desk";
import { PaperPortfolio } from "../components/paper-portfolio";
import { SyndicatesWorkspace } from "../components/syndicates-workspace";
import { Leaderboard } from "../components/community-pages";
import { WalletButton } from "../components/wallet-button";
import { ThemeToggle } from "../components/theme-toggle";
import { ClusterSelect } from "../components/cluster-select";
import { type ScenarioId } from "../lib/simulation";
import type { PaperAsset } from "../lib/simulation/paper";
const tabs = [
  { id: "strategy", label: "Strategy Lab", Icon: IconFlame },
  { id: "paper", label: "Paper Trading", Icon: IconActivity },
  { id: "portfolio", label: "Portfolio", Icon: IconBriefcase },
  { id: "syndicates", label: "Syndicates", Icon: IconUsersGroup },
  { id: "leaderboard", label: "Leaderboard", Icon: IconTrophy },
] as const;
type Tab = (typeof tabs)[number]["id"];
const indicatorSpring = {
  type: "spring",
  stiffness: 520,
  damping: 38,
} as const;
export default function Home() {
  const [tab, setTab] = useState<Tab>("strategy");
  const [drawer, setDrawer] = useState(false);
  const [scenario, setScenario] = useState<ScenarioId>("whale-sell");
  const [session, setSession] = useState(0);
  const [rankedRunBusy, setRankedRunBusy] = useState(false);
  const [paperAssetRequest, setPaperAssetRequest] = useState<{
    asset: PaperAsset;
    requestId: number;
  }>();
  const tradeAsset = (asset: PaperAsset) => {
    setPaperAssetRequest((current) => ({
      asset,
      requestId: (current?.requestId ?? 0) + 1,
    }));
    setTab("paper");
  };
  const rankedRunsEnabled =
    process.env.NEXT_PUBLIC_RANKED_RUNS_ENABLED === "true";
  const current = tabs.find((item) => item.id === tab)!;
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <aside className="app-sidebar">
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
              <b>Spread</b>Forge
            </span>
            <em>LAB</em>
          </button>
          <nav className="side-nav" aria-label="Primary navigation">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`nav-item ${tab === id ? "active" : ""}`}
                aria-current={tab === id ? "page" : undefined}
                title={label}
                onClick={() => setTab(id)}
              >
                {tab === id && (
                  <motion.span
                    layoutId="side-nav-indicator"
                    className="nav-indicator"
                    transition={indicatorSpring}
                  />
                )}
                <Icon size={18} stroke={1.7} />
                <span className="nav-text">{label}</span>
              </button>
            ))}
          </nav>
        </aside>
        <div className="app-main">
          <header className="topbar">
            <button
              className="brand topbar-brand"
              onClick={() => setTab("strategy")}
              aria-label="SpreadForge home"
            >
              <Image
                src="/SpreadForge.png"
                alt=""
                width={30}
                height={30}
                className="brand-logo"
              />
            </button>
            <div className="topbar-title">
              <span className="topbar-crumb">SpreadForge</span>
              <IconChevronRight size={14} className="topbar-sep" />
              <motion.strong
                key={current.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {current.label}
              </motion.strong>
            </div>
            <div className="header-actions">
              <button
                className="btn ghost header-challenges"
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
          <main className="app-content">
            <div className="app-view" hidden={tab !== "strategy"}>
              <RankedStrategyLab
                key={session}
                initialScenario={scenario}
                onScenarioChange={setScenario}
                onBusyChange={setRankedRunBusy}
                active={tab === "strategy"}
              />
            </div>
            <div className="app-view" hidden={tab !== "paper"}>
              <PaperTradingDesk
                active={tab === "paper"}
                assetRequest={paperAssetRequest}
              />
            </div>
            <div className="app-view" hidden={tab !== "portfolio"}>
              <PaperPortfolio
                active={tab === "portfolio"}
                onTradeAsset={tradeAsset}
              />
            </div>
            <div className="app-view" hidden={tab !== "leaderboard"}>
              <Leaderboard active={tab === "leaderboard"} />
            </div>
            <div className="app-view" hidden={tab !== "syndicates"}>
              <SyndicatesWorkspace active={tab === "syndicates"} />
            </div>
          </main>
          <footer className="app-footer">
            <span>
              <IconShieldCheck size={13} />
              Educational simulation · No real funds at risk
            </span>
            <span>
              <span className="status-dot" />
              {rankedRunsEnabled ? "Devnet ranked engine" : "Ranked runs off"} ·
              Built on Solana
            </span>
          </footer>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              aria-label={label}
              aria-current={tab === id ? "page" : undefined}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {tab === id && (
                <motion.span
                  layoutId="mobile-nav-indicator"
                  className="mobile-nav-indicator"
                  transition={indicatorSpring}
                />
              )}
              <Icon size={20} stroke={1.8} />
              <span>{label.split(" ")[0]}</span>
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
    </MotionConfig>
  );
}
