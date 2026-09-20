"use client";
import { useEffect, useState } from "react";
import {
  IconArrowRight,
  IconBolt,
  IconBrandDatabricks,
  IconCircleCheckFilled,
  IconCode,
  IconCopy,
  IconCheck,
  IconPlayerPlay,
  IconRefresh,
  IconRocket,
  IconShieldCheck,
  IconTrophy,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { PanelHeading, money } from "./terminal-ui";
const terminalSteps = [
  "Initializing delegated account…",
  "Deriving deterministic scenario hash…",
  "Executing 60 tick state transitions…",
  "Compressing score telemetry…",
  "Committing result registry PDA…",
];
export function Architecture() {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!running || step >= 5) return;
    const timer = window.setTimeout(() => setStep((value) => value + 1), 900);
    return () => window.clearTimeout(timer);
  }, [step, running]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        '["result", owner_pubkey, scenario_hash, nonce]'
      );
      setCopied(true);
    } catch {
      toast.error("Could not copy derivation.");
    }
  }
  const activeNode = step === 0 ? 0 : step < 2 ? 1 : step < 5 ? 2 : 3;
  return (
    <section className="page-shell" aria-label="MagicBlock architecture">
      <div className="page-title">
        <div>
          <p className="eyebrow profit">THE ENGINE BENEATH THE EDGE</p>
          <h1>Fast by design. Verifiable by default.</h1>
          <p>
            Explore the journey from an ephemeral session to a permanent Solana
            record.
          </p>
        </div>
        <span className="tag warning">INTERACTIVE DEMO</span>
      </div>
      <div className="context-banner">
        <div>
          <p className="eyebrow">MAGICBLOCK · EPHEMERAL ROLLUPS</p>
          <h1>Speed meets settlement.</h1>
          <p className="tip">
            <IconBolt size={14} />
            High-frequency state transitions. One compact result commitment.
          </p>
        </div>
        <button
          className="btn primary"
          disabled={running && step < 5}
          onClick={() => {
            setStep(0);
            setRunning(true);
          }}
        >
          {step === 5 ? (
            <IconRefresh size={15} />
          ) : (
            <IconPlayerPlay size={15} />
          )}
          {running && step < 5
            ? "Simulating…"
            : step === 5
              ? "Replay session"
              : "Simulate session"}
        </button>
      </div>
      <div className="architecture-flow">
        {[
          {
            title: "Delegated Session",
            description: "Wallet authorizes a scoped session key",
            code: "session_8xK4…v9Qp",
            Icon: IconWallet,
          },
          {
            title: "Ephemeral Rollup",
            description: "10–50ms target tick execution",
            code: "18.4ms · DEMO FINALITY",
            Icon: IconBolt,
          },
          {
            title: "Commit & Settle",
            description: "Undelegate and record on Solana devnet",
            code: "5RtQ…mB7f · DEMO",
            Icon: IconShieldCheck,
          },
        ].map(({ title, description, code, Icon }, i) => (
          <FlowItem
            key={title}
            index={i}
            title={title}
            description={description}
            code={code}
            icon={<Icon size={27} />}
            active={activeNode >= i + 1}
          />
        ))}
      </div>
      <div className="architecture-bottom">
        <section className="panel big-terminal">
          <div className="terminal-title">
            <i />
            <i />
            <i />
            <span>session-verifier.sh</span>
            <span style={{ marginLeft: "auto" }}>SIMULATION</span>
          </div>
          <div className="verifier-lines">
            <p className="eyebrow" style={{ marginBottom: 12 }}>
              $ spreadforge verify --demo
            </p>
            {terminalSteps.map((text, i) => (
              <div
                className={`verifier-line ${step > i ? "done" : ""}`}
                key={text}
              >
                {step > i ? (
                  <IconCircleCheckFilled size={14} />
                ) : (
                  <span className="mono">·</span>
                )}
                <span>{text}</span>
                <b>{step > i ? "OK" : step === i && running ? "…" : "—"}</b>
              </div>
            ))}
          </div>
          <p className="sample-note">
            {step === 5
              ? "Demo complete. No account was created and no transaction was sent."
              : "Step through the proposed session lifecycle. All addresses and latency values here are illustrative."}
          </p>
        </section>
        <section className="panel pda-card">
          <PanelHeading
            eyebrow="RESULT REGISTRY PDA"
            title="Canonical proof address"
          >
            <IconBrandDatabricks size={19} />
          </PanelHeading>
          <div className="pda-body">
            <p>
              A permanent home for a compact result. The owner, challenge and
              nonce identify a unique record.
            </p>
            <div className="seed-stack">
              {['"result"', "owner_pubkey", "scenario_hash", "nonce"].map(
                (seed, i) => (
                  <span key={seed}>
                    {i > 0 && <span className="muted"> + </span>}
                    <code>{seed}</code>
                  </span>
                )
              )}
            </div>
            <p className="eyebrow">EXAMPLE ADDRESS</p>
            <div className="hash-box">
              <span>FgR7xK9a2w…4nQPda</span>
              <button
                className="icon-button"
                aria-label="Copy PDA derivation"
                title="Copy derivation template"
                onClick={() => void copy()}
              >
                {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
              </button>
            </div>
            <p>
              <IconCode size={13} style={{ display: "inline" }} /> Scenario hash
              · Strategy hash · Result hash · Score · Owner · Version
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
function FlowItem({
  index,
  title,
  description,
  code,
  icon,
  active,
}: {
  index: number;
  title: string;
  description: string;
  code: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <>
      {index > 0 && (
        <IconArrowRight
          size={20}
          className={`flow-arrow ${active ? "active" : ""}`}
        />
      )}
      <section className={`panel flow-node ${active ? "active" : ""}`}>
        <div className="node-top">
          {icon}
          <span>0{index + 1}</span>
        </div>
        <h2>{title}</h2>
        <p>{description}</p>
        <code>{code}</code>
      </section>
    </>
  );
}
const demoRows = [
  {
    name: "solstice.sol",
    address: "7aK4…m9Qp",
    score: 9726,
    pnl: 18243,
    scenario: "Whale Sell",
    initial: "S",
  },
  {
    name: "liquidity.zen",
    address: "4mR2…x8Vt",
    score: 9451,
    pnl: 14682,
    scenario: "Whale Sell",
    initial: "L",
  },
  {
    name: "Your demo trader",
    address: "8xK4…v9Qp",
    score: 9184,
    pnl: 9834,
    scenario: "Whale Sell",
    initial: "Y",
  },
  {
    name: "quantum.sol",
    address: "9dG5…k2Ls",
    score: 8996,
    pnl: 8462,
    scenario: "Whale Sell",
    initial: "Q",
  },
  {
    name: "mint.condition",
    address: "2wP8…n6Bx",
    score: 8810,
    pnl: 7205,
    scenario: "Whale Sell",
    initial: "M",
  },
  {
    name: "delta.neutral",
    address: "5sT1…r3Fc",
    score: 8642,
    pnl: 5631,
    scenario: "Whale Sell",
    initial: "D",
  },
  {
    name: "blocksmith",
    address: "6hJ9…a7Xe",
    score: 8507,
    pnl: 4189,
    scenario: "Whale Sell",
    initial: "B",
  },
  {
    name: "spread.operator",
    address: "3cN6…z4Wu",
    score: 8312,
    pnl: 2974,
    scenario: "Whale Sell",
    initial: "O",
  },
];
export function Leaderboard() {
  const [tab, setTab] = useState("Weekly");
  const [remaining, setRemaining] = useState(
    3 * 86400 + 14 * 3600 + 27 * 60 + 42
  );
  useEffect(() => {
    const timer = window.setInterval(
      () => setRemaining((value) => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, []);
  const clock = [
    Math.floor(remaining / 86400),
    Math.floor(remaining / 3600) % 24,
    Math.floor(remaining / 60) % 60,
    remaining % 60,
  ];
  const rows =
    tab === "All time"
      ? demoRows.map((r, i) => ({
          ...r,
          score: Math.min(10000, r.score + 100 - i * 5),
          scenario: "Stable Market",
        }))
      : demoRows;
  return (
    <section className="page-shell" aria-label="Leaderboard">
      <div className="workspace-top">
        <span>
          <strong>Good strategies deserve a stage.</strong> · Compete under
          identical conditions.
        </span>
        <span className="tag warning">DEMO RANKINGS</span>
      </div>
      <div className="context-banner tournament-banner">
        <div>
          <IconTrophy className="tournament-icon" size={28} />
          <p className="eyebrow">WEEKLY TOURNAMENT · SEASON 07 · DEMO</p>
          <h1>The Liquidity Gauntlet</h1>
          <p className="tip">
            $5,000 simulated prize pool · Whale Sell challenge · Top 100 qualify
          </p>
        </div>
        <div>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            DEMO ROUND ENDS IN
          </p>
          <div className="countdown">
            {clock.map((value, i) => (
              <div key={i}>
                <b>{String(value).padStart(2, "0")}</b>
                <small>{["DAYS", "HRS", "MIN", "SEC"][i]}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
      <section className="panel rankings">
        <PanelHeading eyebrow="THE BEST OF THE LAB" title="Global rankings">
          <div className="rank-tabs">
            {["Weekly", "All time", "Friends"].map((label) => (
              <button
                key={label}
                className={tab === label ? "active" : ""}
                aria-pressed={tab === label}
                onClick={() => setTab(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </PanelHeading>
        {tab === "Friends" ? (
          <div className="empty-state" style={{ padding: 70 }}>
            <IconUsers size={32} />
            <h3
              style={{
                fontSize: 16,
                color: "var(--foreground)",
                marginBottom: 8,
              }}
            >
              Build your trading circle
            </h3>
            Friend rankings will appear when social competitions are connected.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="rank-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Trader</th>
                  <th>Score</th>
                  <th>Best scenario</th>
                  <th>Net P&L</th>
                  <th>Proof (demo)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr className={i === 2 ? "you" : ""} key={row.name}>
                    <td>
                      {i < 3 ? (
                        <span className="rank-medal">{i + 1}</span>
                      ) : (
                        <span className="mono muted" style={{ paddingLeft: 9 }}>
                          {i + 1}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="trader">
                        <span className="avatar">{row.initial}</span>
                        <div>
                          <strong>{row.name}</strong>
                          <small
                            className="mono muted"
                            style={{
                              display: "block",
                              fontSize: 9,
                              marginTop: 4,
                            }}
                          >
                            {row.address}
                          </small>
                        </div>
                        {i === 2 && (
                          <span className="tag profit">YOU · DEMO</span>
                        )}
                      </div>
                    </td>
                    <td className="mono profit">
                      {row.score.toLocaleString("en-US")}
                    </td>
                    <td>{row.scenario}</td>
                    <td className="mono profit">+{money(row.pnl)}</td>
                    <td>
                      <span
                        className="tag profit"
                        title="Illustrative badge; not an on-chain proof"
                      >
                        <IconShieldCheck size={12} />
                        VERIFIED · DEMO
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="sample-note">
          <IconRocket size={12} style={{ display: "inline" }} />
          Preview with sample traders, scores, proof badges and a simulated
          countdown. Real result indexing and tournament rewards are not
          connected.
        </p>
      </section>
    </section>
  );
}
