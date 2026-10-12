"use client";

import { useState, type CSSProperties } from "react";
import {
  IconBolt,
  IconChartAreaLine,
  IconChartCandle,
  IconChartLine,
  IconCrown,
  IconGauge,
  IconPlayerPlay,
  IconRefresh,
  IconShieldCheck,
} from "@tabler/icons-react";
import type { Address } from "@solana/kit";
import type { RankedRun } from "../generated/result_registry";
import {
  DEFAULT_STRATEGY,
  SCENARIOS,
  type ScenarioId,
  type StrategyConfig,
} from "../lib/simulation";
import { CHALLENGE_META } from "../lib/simulation/challenges";
import { useWallet } from "../lib/wallet/context";
import { getResultRegistryProgramAddress } from "../lib/results/registry";
import { getExplorerUrl } from "../lib/explorer";
import {
  isMagicBlockRankedRunsEnabled,
  startAndExecuteRankedRun,
} from "../lib/magicblock/ranked-run";
import { ChartViewPicker, type ChartViewOption } from "./chart-view-picker";
import { useCluster } from "./cluster-context";
import {
  InteractiveMarketChart,
  type PriceView,
} from "./interactive-market-chart";
import { RankedChallengeDrawer } from "./ranked-challenge-drawer";
import { SolanaLogo } from "./solana-logo";
import { ThemedSelect } from "./themed-select";
import { Metric, Modal, PanelHeading, money, signedMoney } from "./terminal-ui";

type Stage =
  "idle" | "approval" | "delegating" | "executing" | "settling" | "complete";
const CHART_OPTIONS: ChartViewOption<PriceView>[] = [
  { value: "line", label: "Line", group: "Price", Icon: IconChartLine },
  { value: "area", label: "Area", group: "Price", Icon: IconChartAreaLine },
  {
    value: "candles",
    label: "Tick candles",
    group: "Price",
    Icon: IconChartCandle,
  },
];

export function appendRankedSnapshot(
  previous: RankedRun[],
  next: RankedRun
): RankedRun[] {
  if (previous.at(-1)?.tick === next.tick)
    return [...previous.slice(0, -1), next];
  if (previous.some((snapshot) => snapshot.tick === next.tick)) return previous;
  return [...previous, next];
}

export function RankedStrategyLab({
  initialScenario = "whale-sell",
  onScenarioChange,
  onBusyChange,
  active = true,
}: {
  initialScenario?: ScenarioId;
  onScenarioChange?: (id: ScenarioId) => void;
  onBusyChange?: (busy: boolean) => void;
  active?: boolean;
}) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>(initialScenario);
  const [strategy, setStrategy] = useState<StrategyConfig>(DEFAULT_STRATEGY);
  const [stage, setStage] = useState<Stage>("idle");
  const [tick, setTick] = useState(0);
  const [runAddress, setRunAddress] = useState<Address | null>(null);
  const [run, setRun] = useState<RankedRun | null>(null);
  const [snapshots, setSnapshots] = useState<RankedRun[]>([]);
  const [activity, setActivity] = useState<number[]>([]);
  const [chartView, setChartView] = useState<PriceView>("line");
  const [debriefOpen, setDebriefOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState("");
  const { signer } = useWallet();
  const { cluster } = useCluster();
  const programAddress = getResultRegistryProgramAddress();
  const enabled =
    isMagicBlockRankedRunsEnabled() && cluster === "devnet" && !!programAddress;
  const busy = stage !== "idle" && stage !== "complete";
  const scenario = SCENARIOS[scenarioId];
  const meta = CHALLENGE_META[scenarioId];
  const latest = run ?? snapshots.at(-1) ?? null;
  const observedTick = snapshots.at(-1)?.tick ?? 0;
  const pnl = latest
    ? Number(latest.equityCents - latest.startingEquityCents)
    : null;
  const prices = snapshots.map((snapshot) =>
    Number(snapshot.referencePriceCents)
  );
  const samples = snapshots.map((snapshot) => ({
    time: snapshot.tick,
    value: Number(snapshot.referencePriceCents) / 100,
  }));
  const change =
    prices.length > 1 && prices[0] > 0
      ? (prices.at(-1)! / prices[0] - 1) * 100
      : null;

  function clearPresentation() {
    setRun(null);
    setRunAddress(null);
    setSnapshots([]);
    setActivity([]);
    setTick(0);
    setStage("idle");
    setError("");
    setDebriefOpen(false);
  }
  function selectScenario(id: ScenarioId) {
    if (busy) return;
    setScenarioId(id);
    onScenarioChange?.(id);
    clearPresentation();
  }
  function update(key: keyof StrategyConfig, value: number) {
    if (busy) return;
    setStrategy((previous) => ({ ...previous, [key]: value }));
    clearPresentation();
  }
  async function start() {
    if (!signer || !programAddress || !enabled || busy) return;
    clearPresentation();
    onBusyChange?.(true);
    try {
      const result = await startAndExecuteRankedRun({
        authority: signer,
        scenarioId,
        strategy,
        programAddress,
        onStage: (next, address) => {
          setStage(next);
          setRunAddress(address);
        },
        onTick: (next) => {
          setTick(next);
          setActivity((previous) => [...previous, next]);
        },
        onSnapshot: (snapshot) =>
          setSnapshots((previous) => appendRankedSnapshot(previous, snapshot)),
      });
      setRun(result.run);
      setStage("complete");
      setDebriefOpen(true);
    } catch (reason) {
      setStage("idle");
      setError(reason instanceof Error ? reason.message : "Ranked run failed.");
    } finally {
      onBusyChange?.(false);
    }
  }
  const stageText =
    stage === "idle"
      ? "Choose your parameters and approve a run with your wallet."
      : stage === "approval"
        ? "Waiting for wallet approval and devnet confirmation…"
        : stage === "delegating"
          ? "Resolving the delegated account through MagicBlock router…"
          : stage === "executing"
            ? `Executing tick ${tick} of 60 on the Ephemeral Rollup…`
            : stage === "settling"
              ? "Waiting for commit and undelegation on Solana devnet…"
              : "Settled and verified on Solana devnet.";

  return (
    <section className="workspace ranked-workspace" aria-label="Strategy Lab">
      <div className="workspace-top">
        <span>
          <strong>Learn. Simulate. Compete.</strong> · Solana DeFi Market-Making
          Laboratory
        </span>
        <span className="mono">MAGICBLOCK ER / DEVNET</span>
      </div>
      <div className="context-banner">
        <div>
          <p className="eyebrow">
            ACTIVE CHALLENGE · {meta.level.toUpperCase()}
          </p>
          <h1>{scenario.name}</h1>
          <p className="tip">
            <IconBolt size={14} aria-hidden="true" /> {meta.tip}
          </p>
        </div>
        <div className="banner-stats">
          <div>
            <strong>
              60 <span className="muted">TICKS</span>
            </strong>
            <small>SESSION LENGTH</small>
          </div>
          <div>
            <strong className={meta.tone}>{meta.volatility}</strong>
            <small>VOLATILITY</small>
          </div>
        </div>
      </div>
      <div className="lab-grid">
        <aside className="panel controls-panel">
          <PanelHeading eyebrow="PARAMETERS" title="Quote & Risk" />
          <div className="control-body">
            <div className="field">
              <span>Scenario</span>
              <ThemedSelect
                label="Scenario"
                value={scenarioId}
                disabled={busy}
                onChange={selectScenario}
                options={(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => ({
                  value: id,
                  label: SCENARIOS[id].name,
                  icon: <IconBolt size={14} aria-hidden="true" />,
                }))}
              />
            </div>
            <div>
              <Parameter
                label="Spread"
                value={strategy.spreadBps}
                display={`${(strategy.spreadBps / 100).toFixed(2)}%`}
                min={10}
                max={100}
                step={1}
                ends={["0.10%", "1.00%"]}
                disabled={busy}
                onChange={(value) => update("spreadBps", value)}
              />
              <div className="spread-viz">
                <span className="profit">
                  BID {latest ? money(Number(latest.bidCents)) : "—"}
                </span>
                <i style={{ width: `${strategy.spreadBps / 3}px` }} />
                <span className="loss">
                  ASK {latest ? money(Number(latest.askCents)) : "—"}
                </span>
              </div>
            </div>
            <Parameter
              label="Order size"
              value={strategy.orderSizeMilliSol}
              display={`${(strategy.orderSizeMilliSol / 1000).toFixed(1)} SOL`}
              min={500}
              max={10000}
              step={500}
              ends={["0.5 SOL", "10 SOL"]}
              disabled={busy}
              onChange={(value) => update("orderSizeMilliSol", value)}
            />
            <div>
              <Parameter
                label="Max inventory"
                value={strategy.maxInventoryMilliSol}
                display={`${strategy.maxInventoryMilliSol / 1000} SOL`}
                min={100000}
                max={160000}
                step={1000}
                ends={["100 SOL", "160 SOL"]}
                disabled={busy}
                onChange={(value) => update("maxInventoryMilliSol", value)}
              />
              <div className="headroom">
                <i
                  style={{
                    width: latest
                      ? `${Math.min(100, (Number(latest.baseMilli) / strategy.maxInventoryMilliSol) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
              <p className="control-hint">
                {latest
                  ? `${((strategy.maxInventoryMilliSol - Number(latest.baseMilli)) / 1000).toFixed(1)} SOL available headroom`
                  : "Inventory appears after the first account read."}
              </p>
            </div>
            <Parameter
              label="Refresh cycle"
              value={strategy.refreshTicks}
              display={`${strategy.refreshTicks} ticks`}
              min={1}
              max={10}
              step={1}
              ends={["1 tick", "10 ticks"]}
              disabled={busy}
              onChange={(value) => update("refreshTicks", value)}
            />
            <div className="action-row">
              <button
                className="btn primary"
                onClick={() => void start()}
                disabled={!enabled || !signer || busy}
                aria-busy={busy}
              >
                <IconPlayerPlay size={15} aria-hidden="true" />{" "}
                {busy ? "Running on-chain…" : "Start ranked run"}
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={clearPresentation}
                disabled={busy}
                aria-label="Clear run display"
              >
                <IconRefresh size={16} aria-hidden="true" />
              </button>
            </div>
            {!signer && (
              <p className="control-hint">
                Connect a wallet to approve a ranked run.
              </p>
            )}
            {!enabled && (
              <p className="control-hint" role="status">
                Ranked runs require devnet, a configured registry program, and
                the MagicBlock and ranked-run feature flags.
              </p>
            )}
            <p className="control-hint">
              One wallet approval funds the run and a temporary signer with
              0.001 devnet SOL. No real trading assets move.
            </p>
          </div>
          <div className="control-footnote">
            <IconShieldCheck size={13} aria-hidden="true" /> Program-calculated
            results only.
          </div>
        </aside>
        <div className="market-column">
          <section className="panel">
            <div className="market-header">
              <div>
                <div className="market-pair">
                  <span className="pair-icon">
                    <SolanaLogo size={24} />
                  </span>
                  <div>
                    <h2>SOL / USDC</h2>
                    <small>DETERMINISTIC MARKET · ON-CHAIN RUN</small>
                  </div>
                </div>
                <div className="price-readout">
                  <strong>
                    {latest
                      ? money(Number(latest.referencePriceCents), 3)
                      : "—"}
                  </strong>
                  {change !== null && (
                    <span
                      className={`change-badge ${change < 0 ? "loss" : ""}`}
                    >
                      {change >= 0 ? "+" : ""}
                      {change.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="market-extremes">
                <div>
                  <small>SESSION HIGH</small>
                  <b>{prices.length ? money(Math.max(...prices)) : "—"}</b>
                </div>
                <div>
                  <small>SESSION LOW</small>
                  <b>{prices.length ? money(Math.min(...prices)) : "—"}</b>
                </div>
              </div>
            </div>
            <div className="tick-row">
              <span>
                TICK <b>{String(tick).padStart(2, "0")}</b> / 60
              </span>
              <div className="bar-track">
                <i style={{ width: `${(tick / 60) * 100}%` }} />
              </div>
              <b>{stage.toUpperCase()}</b>
            </div>
            <div className="ranked-chart-shell">
              {samples.length ? (
                <InteractiveMarketChart
                  samples={samples}
                  view={chartView}
                  label="SOL / USDC run price"
                  ticks
                  intervals={[1, 2, 4, 8]}
                  toolbarStart={
                    <ChartViewPicker
                      view={chartView}
                      onViewChange={setChartView}
                      options={CHART_OPTIONS}
                      label="Ranked run chart view"
                      eyebrow="On-chain snapshots"
                    />
                  }
                />
              ) : (
                <>
                  <div className="market-chart-toolbar">
                    <ChartViewPicker
                      view={chartView}
                      onViewChange={setChartView}
                      options={CHART_OPTIONS}
                      label="Ranked run chart view"
                      eyebrow="On-chain snapshots"
                    />
                  </div>
                  <div className="ranked-chart-empty">
                    Live price chart begins with the first confirmed run
                    account. No browser-simulated prices.
                  </div>
                </>
              )}
            </div>
            <p className="ranked-chart-note" role="status">
              {stageText}{" "}
              {tick > observedTick &&
                "Waiting for the latest account snapshot."}
            </p>
            {error && (
              <p className="tip loss" role="alert">
                {error} Check the run account before starting another run.
              </p>
            )}
          </section>
          <div className="hud-grid">
            <Metric
              label="YOUR BID"
              value={latest?.hasBuyOrder ? money(Number(latest.bidCents)) : "—"}
              detail={
                latest?.hasBuyOrder ? "Active on ER" : "No active buy quote"
              }
              tone="profit"
            />
            <Metric
              label="YOUR ASK"
              value={
                latest?.hasSellOrder ? money(Number(latest.askCents)) : "—"
              }
              detail={
                latest?.hasSellOrder ? "Active on ER" : "No active sell quote"
              }
              tone="loss"
            />
            <Metric
              label="TOTAL FILLS"
              value={latest?.fillCount ?? "—"}
              detail="Program account count"
            />
            <Metric
              label="INVENTORY"
              value={
                latest
                  ? `${(Number(latest.baseMilli) / 1000).toFixed(1)} SOL`
                  : "—"
              }
              detail={
                latest
                  ? `${((strategy.maxInventoryMilliSol - Number(latest.baseMilli)) / 1000).toFixed(1)} SOL headroom`
                  : "Awaiting account"
              }
            />
          </div>
          <div className="bottom-grid">
            <section className="panel ranked-quotes">
              <PanelHeading
                eyebrow="PROGRAM ACCOUNT"
                title="Your live quotes"
              />
              <div className="ranked-quote-row">
                <span>BID</span>
                <strong className="profit">
                  {latest?.hasBuyOrder
                    ? money(Number(latest.bidCents))
                    : "Inactive"}
                </strong>
              </div>
              <div className="ranked-quote-row">
                <span>ASK</span>
                <strong className="loss">
                  {latest?.hasSellOrder
                    ? money(Number(latest.askCents))
                    : "Inactive"}
                </strong>
              </div>
              <p className="control-hint">
                These are your program quotes, not a market-wide order book.
              </p>
            </section>
            <section className="panel terminal">
              <PanelHeading title="Execution activity">
                <span className="live">
                  <i />
                  {busy ? "LIVE" : "DEVNET"}
                </span>
              </PanelHeading>
              <div
                className="terminal-lines"
                role="log"
                aria-label="Confirmed run activity"
              >
                {activity.length ? (
                  activity
                    .slice(-8)
                    .reverse()
                    .map((item) => {
                      const snapshot = snapshots.find(
                        (entry) => entry.tick === item
                      );
                      const previous = snapshots
                        .filter((entry) => entry.tick < item)
                        .at(-1);
                      const newFills =
                        snapshot && previous
                          ? snapshot.fillCount - previous.fillCount
                          : 0;
                      return (
                        <div className="terminal-line" key={item}>
                          <time>T{String(item).padStart(2, "0")}</time>
                          <span>
                            Tick {item} confirmed on MagicBlock ER
                            {newFills > 0
                              ? ` · +${newFills} program-reported fill${newFills === 1 ? "" : "s"} since last account read`
                              : snapshot
                                ? " · account read"
                                : ""}
                          </span>
                        </div>
                      );
                    })
                ) : (
                  <p className="control-hint">
                    Confirmed tick activity will appear here after you start a
                    run.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
        <aside className="score-column">
          <section className="panel pnl-card">
            <p className="eyebrow">NET SIMULATED P&L</p>
            <strong
              className={pnl === null ? "" : pnl >= 0 ? "profit" : "loss"}
            >
              {pnl === null ? "—" : signedMoney(pnl)}
            </strong>
            <small className={pnl !== null && pnl < 0 ? "loss" : "profit"}>
              {pnl !== null && latest && latest.startingEquityCents > 0n
                ? `${((pnl / Number(latest.startingEquityCents)) * 100).toFixed(2)}%`
                : "—"}{" "}
              <span className="muted">session return</span>
            </small>
          </section>
          <section className="panel score-card">
            <p className="eyebrow">
              STRATEGY SCORE{" "}
              <IconGauge
                size={12}
                style={{ float: "right" }}
                aria-hidden="true"
              />
            </p>
            <div
              className="score-ring"
              style={
                {
                  "--score": `${run ? run.finalScore / 100 : 0}%`,
                } as CSSProperties
              }
            >
              <div>
                <strong>
                  {run ? run.finalScore.toLocaleString("en-US") : "—"}
                </strong>
                <small>/ 10,000</small>
              </div>
            </div>
            <span className="tier-badge">
              <IconCrown size={12} aria-hidden="true" />{" "}
              {run ? "SETTLED SCORE" : "PENDING SETTLEMENT"}
            </span>
            {run && (
              <button
                className="btn primary score-results-button"
                onClick={() => setDebriefOpen(true)}
              >
                View results
              </button>
            )}
          </section>
          <section className="panel breakdown">
            <div className="breakdown-heading">
              <p className="eyebrow">ON-CHAIN RISK</p>
              <span>ACCOUNT DATA</span>
            </div>
            <RiskRow
              label="Equity"
              value={latest ? money(Number(latest.equityCents)) : "—"}
            />
            <RiskRow
              label="Inventory cost"
              value={latest ? money(Number(latest.inventoryCostCents)) : "—"}
            />
            <RiskRow
              label="Liquidity ticks"
              value={latest ? `${latest.liquidityTicks} / 60` : "—"}
            />
            <RiskRow
              label="Realized P&L"
              value={
                latest ? signedMoney(Number(latest.realizedPnlCents)) : "—"
              }
            />
          </section>
          <div className="panel risk-grid">
            <Metric
              label="MAX DRAWDOWN"
              value={
                latest ? `${(latest.maxDrawdownBps / 100).toFixed(2)}%` : "—"
              }
              detail="Program account"
              tone="warning"
            />
            <Metric
              label="RUN STATE"
              value={run ? "SETTLED" : busy ? "ACTIVE" : "READY"}
              detail={
                run ? "Base devnet verified" : "No score until settlement"
              }
            />
          </div>
          {runAddress && (
            <a
              className="ranked-run-link mono"
              href={getExplorerUrl(`/address/${runAddress}`, "devnet")}
              target="_blank"
              rel="noreferrer"
            >
              View run account {String(runAddress).slice(0, 4)}…
              {String(runAddress).slice(-4)}
            </a>
          )}
        </aside>
      </div>
      {active && run && debriefOpen && (
        <Modal
          title="Session debrief"
          onClose={() => setDebriefOpen(false)}
          scrollBody
        >
          <div className="ranked-debrief">
            <p className="eyebrow">SETTLED ON SOLANA DEVNET</p>
            <h3>{scenario.name}</h3>
            <div className="hud-grid">
              <Metric
                label="SCORE"
                value={`${run.finalScore.toLocaleString()} / 10,000`}
              />
              <Metric
                label="FINAL EQUITY"
                value={money(Number(run.equityCents))}
              />
              <Metric
                label="NET P&L"
                value={signedMoney(
                  Number(run.equityCents - run.startingEquityCents)
                )}
              />
              <Metric label="FILLS" value={run.fillCount} />
            </div>
            <p>
              Inventory: {(Number(run.baseMilli) / 1000).toFixed(3)} SOL ·
              Drawdown: {(run.maxDrawdownBps / 100).toFixed(2)}%
            </p>
            <p className="control-hint">
              Results come from the settled program account. Tick chart history
              is held only in this tab.
            </p>
            <div className="action-row">
              <button className="btn primary" onClick={clearPresentation}>
                New run
              </button>
              <button
                className="btn"
                onClick={() => {
                  setDebriefOpen(false);
                  setDrawerOpen(true);
                }}
              >
                Choose challenge
              </button>
            </div>
          </div>
        </Modal>
      )}
      {active && drawerOpen && (
        <RankedChallengeDrawer
          selected={scenarioId}
          onSelect={selectScenario}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </section>
  );
}

function RiskRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ranked-risk-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Parameter({
  label,
  value,
  display,
  min,
  max,
  step,
  ends,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  ends: [string, string];
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider-control">
      <span className="slider-label">
        <span>{label}</span>
        <b>{display}</b>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        style={
          {
            "--progress": `${((value - min) / (max - min)) * 100}%`,
          } as CSSProperties
        }
      />
      <span className="slider-range">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </span>
    </label>
  );
}
