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
  IconShieldCheck,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { PanelHeading } from "./terminal-ui";
import { useCluster } from "./cluster-context";
import { ellipsify } from "../lib/explorer";
import {
  createRpcPaperLeaderboardRepository,
  createRpcRankedRunRepository,
  rankSettledRuns,
  type LeaderboardEntry,
  type LeaderboardPeriod,
  type PaperLeaderboardSnapshot,
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
      <header className="page-header">
        <div>
          <p className="eyebrow">MAGICBLOCK · EPHEMERAL ROLLUPS · DEMO</p>
          <h1>Fast by design. Verifiable by default.</h1>
          <p className="page-lede">
            Explore the journey from an ephemeral session to a permanent Solana
            record. High-frequency state transitions, one compact result
            commitment.
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
            <IconRefresh size={16} />
          ) : (
            <IconPlayerPlay size={16} />
          )}
          {running && step < 5
            ? "Simulating…"
            : step === 5
              ? "Replay session"
              : "Simulate session"}
        </button>
      </header>
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
            icon={<Icon size={20} stroke={1.6} />}
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
  const [section, setSection] = useState<"strategy" | "paper">("strategy");
  const [strategyTab, setStrategyTab] = useState<"global" | "friends">(
    "global"
  );
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paperBoard, setPaperBoard] = useState<PaperLeaderboardSnapshot | null>(
    null
  );
  const [paperLoading, setPaperLoading] = useState(false);
  const [paperError, setPaperError] = useState("");
  const { cluster } = useCluster();
  const programAddress = getResultRegistryProgramAddress();
  const refreshStrategy = async () => {
    if (!programAddress || cluster !== "devnet") return;
    setLoading(true);
    setError("");
    try {
      const records = await createRpcRankedRunRepository({
        programAddress,
        cluster: "devnet",
      }).listSettledRuns();
      setRows(
        rankSettledRuns({
          records,
          period,
          cluster: "devnet",
        })
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not load devnet rankings."
      );
    } finally {
      setLoading(false);
    }
  };
  const refreshPaper = async () => {
    if (!programAddress || cluster !== "devnet") return;
    setPaperLoading(true);
    setPaperError("");
    try {
      setPaperBoard(
        await createRpcPaperLeaderboardRepository({
          programAddress,
          cluster: "devnet",
        }).list()
      );
    } catch (reason) {
      setPaperError(
        reason instanceof Error
          ? reason.message
          : "Could not load paper-trading rankings."
      );
    } finally {
      setPaperLoading(false);
    }
  };
  useEffect(() => {
    if (!active || section !== "strategy") return;
    const timer = window.setTimeout(() => void refreshStrategy(), 0);
    return () => window.clearTimeout(timer);
  }, [active, section, period, cluster, programAddress]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!active || section !== "paper") return;
    const initial = window.setTimeout(() => void refreshPaper(), 0);
    const timer = window.setInterval(() => void refreshPaper(), 15_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [active, section, cluster, programAddress]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="page-shell" aria-label="Leaderboard">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {section === "strategy"
              ? "Program-calculated settled strategy runs"
              : "Oracle-priced on-chain paper portfolios"}
          </p>
          <h1>
            {section === "strategy"
              ? "Strategy leaderboard"
              : "Paper trading leaderboard"}
          </h1>
          <p className="page-lede">
            {section === "strategy"
              ? "Compare your strategy runs. Best settled on-chain run per wallet across all three challenges."
              : "Compare live paper portfolios. Ranked by live total return from fresh, verified Pyth prices."}{" "}
            Rankings are read from Solana devnet.
          </p>
        </div>
        <span className="tag warning">DEVNET</span>
      </header>
      <div className="rank-tabs section-tabs" aria-label="Leaderboard type">
        <button
          className={section === "strategy" ? "active" : ""}
          onClick={() => setSection("strategy")}
        >
          Strategy simulations
        </button>
        <button
          className={section === "paper" ? "active" : ""}
          onClick={() => setSection("paper")}
        >
          Paper trading
        </button>
      </div>
      {section === "strategy" ? (
        <>
          <section className="panel rankings">
            <PanelHeading eyebrow="SETTLED RANKED RUNS" title="Global rankings">
              <div className="rank-tabs">
                <button
                  className={
                    strategyTab === "global" && period === "weekly"
                      ? "active"
                      : ""
                  }
                  onClick={() => {
                    setStrategyTab("global");
                    setPeriod("weekly");
                  }}
                >
                  Weekly
                </button>
                <button
                  className={
                    strategyTab === "global" && period === "all-time"
                      ? "active"
                      : ""
                  }
                  onClick={() => {
                    setStrategyTab("global");
                    setPeriod("all-time");
                  }}
                >
                  All time
                </button>
                <button
                  className={strategyTab === "friends" ? "active" : ""}
                  onClick={() => setStrategyTab("friends")}
                >
                  Friends · soon
                </button>
                <button
                  className="icon-button leaderboard-refresh"
                  aria-label="Refresh strategy rankings"
                  onClick={() => void refreshStrategy()}
                >
                  <IconRefresh size={17} />
                </button>
              </div>
            </PanelHeading>
            {strategyTab === "friends" ? (
              <div className="empty-state roomy">
                <IconUsers size={20} />
                <h3>Build your trading circle</h3>
                Friend rankings are coming later. SpreadForge does not yet store
                profiles or friend lists.
              </div>
            ) : !programAddress ? (
              <div className="empty-state roomy">
                The Result Registry is not configured.
              </div>
            ) : cluster !== "devnet" ? (
              <div className="empty-state roomy">
                Switch to Solana devnet to view settled strategy runs.
              </div>
            ) : loading ? (
              <LeaderboardSkeleton />
            ) : error ? (
              <div className="empty-state roomy" role="alert">
                {error}
              </div>
            ) : !rows.length ? (
              <div className="empty-state roomy">
                No settled devnet ranked runs exist for this period yet.
              </div>
            ) : (
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
                            <span className="rank-plain">{i + 1}</span>
                          )}
                        </td>
                        <td>
                          <div className="trader">
                            <span className="avatar">
                              {row.walletAddress.slice(0, 1)}
                            </span>
                            <div>
                              <strong>{ellipsify(row.walletAddress)}</strong>
                              <small className="trader-time">
                                {new Date(
                                  row.submittedAt * 1000
                                ).toLocaleString()}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td className="mono profit">
                          {row.score.toLocaleString("en-US")}
                        </td>
                        <td>{row.scenarioName}</td>
                        <td
                          className={`mono ${row.pnlBps >= 0 ? "profit" : "loss"}`}
                        >
                          {row.pnlBps >= 0 ? "+" : ""}
                          {(row.pnlBps / 100).toFixed(2)}%
                        </td>
                        <td className="mono">
                          {(row.maxDrawdownBps / 100).toFixed(2)}%
                        </td>
                        <td>
                          <a
                            className="btn ghost small"
                            href={row.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View run
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="panel rankings">
          <PanelHeading
            eyebrow="LIVE DEVNET VALUATION"
            title="Paper-trading rankings"
          >
            <button
              className="icon-button leaderboard-refresh"
              aria-label="Refresh paper-trading rankings"
              onClick={() => void refreshPaper()}
            >
              <IconRefresh size={17} />
            </button>
          </PanelHeading>
          {!programAddress ? (
            <div className="empty-state roomy">
              The Result Registry is not configured.
            </div>
          ) : cluster !== "devnet" ? (
            <div className="empty-state roomy">
              Switch to Solana devnet to view paper-trading rankings.
            </div>
          ) : paperLoading && !paperBoard ? (
            <PaperLeaderboardSkeleton />
          ) : paperError ? (
            <div className="empty-state roomy" role="alert">
              {paperError}
            </div>
          ) : !paperBoard?.entries.length ? (
            <div className="empty-state roomy">
              No traded portfolios with fresh oracle prices are ranked yet.
            </div>
          ) : (
            <div className="table-scroll">
              <table className="rank-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Wallet</th>
                    <th>Return</th>
                    <th>Equity</th>
                    <th>Realized P&amp;L</th>
                    <th>Trades</th>
                    <th>Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {paperBoard.entries.map((row, index) => (
                    <tr key={row.walletAddress}>
                      <td>
                        {index < 3 ? (
                          <span className="rank-medal">{index + 1}</span>
                        ) : (
                          <span className="rank-plain">{index + 1}</span>
                        )}
                      </td>
                      <td>
                        <div className="trader">
                          <span className="avatar">
                            {row.walletAddress.slice(0, 1)}
                          </span>
                          <strong>{ellipsify(row.walletAddress)}</strong>
                        </div>
                      </td>
                      <td
                        className={`mono ${row.returnBps >= 0 ? "profit" : "loss"}`}
                      >
                        {row.returnBps >= 0 ? "+" : ""}
                        {(row.returnBps / 100).toFixed(2)}%
                      </td>
                      <td className="mono">
                        {formatPaperUsd(row.equityCents)}
                      </td>
                      <td
                        className={`mono ${row.realizedPnlCents >= 0 ? "profit" : "loss"}`}
                      >
                        {row.realizedPnlCents >= 0 ? "+" : ""}
                        {formatPaperUsd(row.realizedPnlCents)}
                      </td>
                      <td className="mono">{row.tradeCount}</td>
                      <td className="mono muted">
                        {new Date(row.lastActivityAt * 1000).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!!paperBoard?.excludedUnpricedPortfolios && (
            <p className="sample-note">
              {paperBoard.excludedUnpricedPortfolios} traded{" "}
              {paperBoard.excludedUnpricedPortfolios === 1
                ? "portfolio is"
                : "portfolios are"}{" "}
              temporarily unranked because one or more held assets lack a fresh
              verified price.
            </p>
          )}
        </section>
      )}
    </section>
  );
}

function LeaderboardSkeleton() {
  return (
    <div
      className="table-scroll leaderboard-skeleton"
      aria-busy="true"
      aria-label="Loading devnet rankings"
    >
      <table className="rank-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Wallet</th>
            <th>Score</th>
            <th>Best scenario</th>
            <th>Net P&amp;L</th>
            <th>Drawdown</th>
            <th>Proof</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }, (_, index) => (
            <tr key={index}>
              <td>
                <span className="skeleton-line skeleton-rank" />
              </td>
              <td>
                <div className="trader">
                  <span className="skeleton-avatar" />
                  <div>
                    <span className="skeleton-line skeleton-wallet" />
                    <span className="skeleton-line skeleton-time" />
                  </div>
                </div>
              </td>
              <td>
                <span className="skeleton-line skeleton-score" />
              </td>
              <td>
                <span className="skeleton-line skeleton-scenario" />
              </td>
              <td>
                <span className="skeleton-line skeleton-score" />
              </td>
              <td>
                <span className="skeleton-line skeleton-score" />
              </td>
              <td>
                <span className="skeleton-line skeleton-proof" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="sr-only">Loading devnet result records.</span>
    </div>
  );
}

function PaperLeaderboardSkeleton() {
  return (
    <div
      className="table-scroll leaderboard-skeleton"
      aria-busy="true"
      aria-label="Loading paper-trading rankings"
    >
      <table className="rank-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Wallet</th>
            <th>Return</th>
            <th>Equity</th>
            <th>Realized P&amp;L</th>
            <th>Trades</th>
            <th>Last activity</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }, (_, index) => (
            <tr key={index}>
              <td>
                <span className="skeleton-line skeleton-rank" />
              </td>
              <td>
                <div className="trader">
                  <span className="skeleton-avatar" />
                  <span className="skeleton-line skeleton-wallet" />
                </div>
              </td>
              <td>
                <span className="skeleton-line skeleton-score" />
              </td>
              <td>
                <span className="skeleton-line skeleton-score" />
              </td>
              <td>
                <span className="skeleton-line skeleton-score" />
              </td>
              <td>
                <span className="skeleton-line skeleton-score" />
              </td>
              <td>
                <span className="skeleton-line skeleton-time" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatPaperUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
