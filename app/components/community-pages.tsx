"use client";
import { useEffect, useMemo, useState } from "react";
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
  IconShieldCheck,
  IconTrophy,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { AlertModal, PanelHeading } from "./terminal-ui";
import { useCluster } from "./cluster-context";
import { ellipsify } from "../lib/explorer";
import {
  clearLocalRuns,
  createRpcLeaderboardRepository,
  getSupportedScenarioHashes,
  LOCAL_RUNS_UPDATED_EVENT,
  listLocalRuns,
  rankRecords,
  type LeaderboardEntry,
  type LeaderboardPeriod,
  type LocalSimulationRun,
} from "../lib/leaderboard";
import { getResultRegistryProgramAddress } from "../lib/results/registry";
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
export function Leaderboard({ active = true }: { active?: boolean }) {
  const [tab, setTab] = useState<"global" | "friends">("global");
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [localRuns, setLocalRuns] = useState<LocalSimulationRun[]>([]);
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const { cluster } = useCluster();
  const programAddress = getResultRegistryProgramAddress();
  const localBest = useMemo(() => [...localRuns].sort((a, b) => b.commitment.totalScore - a.commitment.totalScore).slice(0, 5), [localRuns]);
  const refresh = async () => {
    setLocalRuns(listLocalRuns());
    if (!programAddress || cluster !== "devnet") return;
    setLoading(true);
    setError("");
    try {
      const [records, hashes] = await Promise.all([
        createRpcLeaderboardRepository({ programAddress, cluster: "devnet" }).listRecords(),
        getSupportedScenarioHashes(),
      ]);
      setRows(rankRecords({ records, period, scenarioHashes: hashes, cluster: "devnet" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load devnet rankings.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [active, period, cluster, programAddress]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const syncLocalRuns = () => setLocalRuns(listLocalRuns());
    window.addEventListener(LOCAL_RUNS_UPDATED_EVENT, syncLocalRuns);
    return () => window.removeEventListener(LOCAL_RUNS_UPDATED_EVENT, syncLocalRuns);
  }, []);
  return (
    <section className="page-shell" aria-label="Leaderboard">
      <div className="workspace-top">
        <span>
          <strong>Compare your strategy runs.</strong> · Global entries are public wallet commitments on Solana devnet.
        </span>
        <span className="tag warning">DEVNET</span>
      </div>
      <div className="context-banner tournament-banner">
        <div>
          <div className="leaderboard-kicker">
            <IconTrophy className="tournament-icon" size={18} stroke={2.2} />
            <p className="eyebrow">Wallet-committed simulation results</p>
          </div>
          <h1>Strategy leaderboard</h1>
          <p className="tip">
            Best result per wallet across Stable Market, Whale Sell, and Flash Crash.
          </p>
        </div>
      </div>
      <section className="panel rankings" style={{ marginBottom: 16 }}>
        <PanelHeading title="Your local runs">
          <button className="btn ghost" onClick={() => setConfirmingClear(true)} disabled={!localRuns.length}>Clear history</button>
        </PanelHeading>
        {localBest.length ? <div className="table-scroll"><table className="rank-table"><thead><tr><th>Scenario</th><th>Score</th><th>P&L</th><th>Status</th><th>Completed</th></tr></thead><tbody>{localBest.map((run) => <tr key={run.id}><td>{run.scenarioId.replaceAll("-", " ")}</td><td className="mono profit">{run.commitment.totalScore.toLocaleString()}</td><td className="mono">{(run.commitment.pnlBps / 100).toFixed(2)}%</td><td><span className="tag">{run.status}</span></td><td className="mono muted">{new Date(run.completedAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <div className="empty-state">Complete a Strategy Lab session to save your first private local result.</div>}
      </section>
      <section className="panel rankings">
        <PanelHeading eyebrow="THE BEST OF THE LAB" title="Global rankings">
          <div className="rank-tabs">
            <button className={tab === "global" && period === "weekly" ? "active" : ""} onClick={() => { setTab("global"); setPeriod("weekly"); }}>Weekly</button>
            <button className={tab === "global" && period === "all-time" ? "active" : ""} onClick={() => { setTab("global"); setPeriod("all-time"); }}>All time</button>
            <button className={tab === "friends" ? "active" : ""} onClick={() => setTab("friends")}>Friends · soon</button>
            <button className="icon-button leaderboard-refresh" aria-label="Refresh rankings" onClick={() => void refresh()}><IconRefresh size={19} stroke={2.25} /></button>
          </div>
        </PanelHeading>
        {tab === "friends" ? (
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
            Friend rankings are coming later. SpreadForge does not yet store profiles or friend lists.
          </div>
        ) : !programAddress ? <div className="empty-state" style={{ padding: 50 }}>The Result Registry is not configured. Your local browser history is still available above.</div>
        : cluster !== "devnet" ? <div className="empty-state" style={{ padding: 50 }}>Switch to Solana devnet to view global wallet-committed results.</div>
        : loading ? <LeaderboardSkeleton />
        : error ? <div className="empty-state" style={{ padding: 50 }} role="alert">{error}</div>
        : !rows.length ? <div className="empty-state" style={{ padding: 50 }}>No matching devnet commitments exist for this period yet.</div>
        : (
          <div className="table-scroll">
            <table className="rank-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Wallet</th>
                  <th>Score</th>
                  <th>Best scenario</th>
                  <th>Net P&L</th>
                  <th>Drawdown</th>
                  <th>Proof</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.resultAddress}>
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
                        <span className="avatar">{row.walletAddress.slice(0, 1)}</span>
                        <div>
                          <strong>{ellipsify(row.walletAddress)}</strong>
                          <small
                            className="mono muted"
                            style={{
                              display: "block",
                              fontSize: 9,
                              marginTop: 4,
                            }}
                          >
                            {new Date(row.submittedAt * 1000).toLocaleString()}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td className="mono profit">
                      {row.score.toLocaleString("en-US")}
                    </td>
                    <td>{row.scenarioName}</td>
                    <td className={`mono ${row.pnlBps >= 0 ? "profit" : "loss"}`}>{row.pnlBps >= 0 ? "+" : ""}{(row.pnlBps / 100).toFixed(2)}%</td>
                    <td className="mono">{(row.maxDrawdownBps / 100).toFixed(2)}%</td>
                    <td>
                      <a className="btn ghost" href={row.proofUrl} target="_blank" rel="noreferrer">View commitment</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {confirmingClear && (
        <AlertModal
          title="Clear local history?"
          confirmLabel="Clear history"
          onClose={() => setConfirmingClear(false)}
          onConfirm={() => {
            clearLocalRuns();
            setLocalRuns([]);
          }}
        >
          <p>This permanently removes all saved Strategy Lab runs from this browser. It does not remove any results already committed to devnet.</p>
        </AlertModal>
      )}
    </section>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="table-scroll leaderboard-skeleton" aria-busy="true" aria-label="Loading devnet rankings">
      <table className="rank-table">
        <thead>
          <tr>
            <th>Rank</th><th>Wallet</th><th>Score</th><th>Best scenario</th><th>Net P&amp;L</th><th>Drawdown</th><th>Proof</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }, (_, index) => (
            <tr key={index}>
              <td><span className="skeleton-line skeleton-rank" /></td>
              <td><div className="trader"><span className="skeleton-avatar" /><div><span className="skeleton-line skeleton-wallet" /><span className="skeleton-line skeleton-time" /></div></div></td>
              <td><span className="skeleton-line skeleton-score" /></td>
              <td><span className="skeleton-line skeleton-scenario" /></td>
              <td><span className="skeleton-line skeleton-score" /></td>
              <td><span className="skeleton-line skeleton-score" /></td>
              <td><span className="skeleton-line skeleton-proof" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="sr-only">Loading devnet result records.</span>
    </div>
  );
}
