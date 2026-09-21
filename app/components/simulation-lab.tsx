"use client";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  IconSettings,
  IconPlayerPlay,
  IconPlayerPause,
  IconRefresh,
  IconBolt,
  IconCrown,
  IconShieldCheck,
  IconArrowUpRight,
  IconBrandDatabricks,
  IconGauge,
  IconCheck,
} from "@tabler/icons-react";
import {
  DEFAULT_STRATEGY,
  createSimulation,
  stepSimulation,
  SCENARIOS,
  type ScenarioId,
  type SimulationState,
  type StrategyConfig,
  type Scenario,
} from "../lib/simulation";
import { scoreRun } from "../lib/simulation/score";
import {
  createResultCommitment,
  type ResultCommitment,
} from "../lib/results/commitment";
import {
  Metric,
  Modal,
  PanelHeading,
  ScoreBar,
  money,
  signedMoney,
} from "./terminal-ui";

export const CHALLENGE_META = {
  "stable-market": {
    level: "Beginner",
    volatility: "LOW",
    tone: "profit",
    tip: "Keep your quotes tight and your inventory balanced in a calm market.",
    description:
      "Find your rhythm. Provide steady liquidity in a calm, two-sided market.",
  },
  "whale-sell": {
    level: "Intermediate",
    volatility: "EVENT",
    tone: "warning",
    tip: "Build inventory headroom before the whale sell at tick 32.",
    description:
      "A large sell order hits at tick 32. Can your inventory limits absorb the shock?",
  },
  "flash-crash": {
    level: "Advanced",
    volatility: "EXTREME",
    tone: "loss",
    tip: "Protect your inventory through the crash at tick 20 and the recovery that follows.",
    description:
      "Survive a sudden 12% crash, then navigate two sharp recovery waves.",
  },
};
const dimensions = [
  ["liquidity", "Liquidity uptime", 30, 90],
  ["spreadEfficiency", "Spread efficiency", 25, 80],
  ["inventoryControl", "Inventory control", 20, 85],
  ["drawdownControl", "Drawdown control", 15, 75],
  ["pnl", "Net P&L contribution", 10, 80],
] as const;
const tier = (score: number) =>
  score >= 8500
    ? "Diamond"
    : score >= 7000
      ? "Platinum"
      : score >= 5500
        ? "Gold"
        : "Developing";

type ChartView =
  | "line"
  | "area"
  | "candles"
  | "ohlc"
  | "heikin"
  | "depth"
  | "spread"
  | "inventory"
  | "pnl"
  | "drawdown";

const CHART_OPTIONS: Array<{ value: ChartView; label: string; group: string }> =
  [
    { value: "line", label: "Line", group: "Price" },
    { value: "area", label: "Area", group: "Price" },
    { value: "candles", label: "Candles", group: "Price" },
    { value: "ohlc", label: "OHLC bars", group: "Price" },
    { value: "heikin", label: "Heikin-Ashi", group: "Price" },
    { value: "depth", label: "Order book depth", group: "Analytics" },
    { value: "spread", label: "Bid / ask spread", group: "Analytics" },
    { value: "inventory", label: "Inventory", group: "Analytics" },
    { value: "pnl", label: "P&L / equity", group: "Analytics" },
    { value: "drawdown", label: "Drawdown", group: "Analytics" },
  ];

export function ChallengeDrawer({
  selected,
  onSelect,
  onClose,
}: {
  selected: ScenarioId;
  onSelect: (id: ScenarioId) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Choose your challenge" onClose={onClose} drawer>
      <p className="eyebrow">Learn in 3 steps</p>
      <div className="guide-steps">
        {[
          ["Configure", "Set quote and risk parameters."],
          ["Simulate", "React to deterministic market events."],
          ["Debrief", "Study your score and result commitment."],
        ].map(([name, description], i) => (
          <div key={name}>
            <b>0{i + 1}</b>
            <strong>{name}</strong>
            <p>{description}</p>
          </div>
        ))}
      </div>
      <p className="eyebrow">Your next market</p>
      {(["stable-market", "whale-sell", "flash-crash"] as ScenarioId[]).map(
        (id) => (
          <button
            key={id}
            className={`challenge-card ${selected === id ? "selected" : ""}`}
            onClick={() => {
              onSelect(id);
              onClose();
            }}
          >
            <span className={`tag ${CHALLENGE_META[id].tone}`}>
              {CHALLENGE_META[id].level.toUpperCase()}
            </span>
            {selected === id && <IconCheck size={17} />}
            <h3>{SCENARIOS[id].name}</h3>
            <p>{CHALLENGE_META[id].description}</p>
            <div className="card-meta">
              <span>60 TICKS</span>
              <span>{CHALLENGE_META[id].volatility} VOLATILITY</span>
            </div>
          </button>
        )
      )}
      <button
        className="btn sandbox"
        onClick={() => {
          onSelect("stable-market");
          onClose();
        }}
      >
        <IconSettings size={15} /> Configure a sandbox strategy
      </button>
      <p className="control-hint">
        Sandbox opens Stable Market with fully adjustable strategy parameters.
      </p>
    </Modal>
  );
}

export function SimulationLab({
  initialScenario = "whale-sell",
  onScenarioChange,
  active = true,
}: {
  initialScenario?: ScenarioId;
  onScenarioChange?: (id: ScenarioId) => void;
  active?: boolean;
}) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>(initialScenario);
  const [strategy, setStrategy] = useState<StrategyConfig>(DEFAULT_STRATEGY);
  const scenario = SCENARIOS[scenarioId];
  const [state, setState] = useState(() =>
    createSimulation(scenario, DEFAULT_STRATEGY)
  );
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [dismissed, setDismissed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [chartView, setChartView] = useState<ChartView>("line");
  const finished = state.tick >= scenario.durationTicks;
  const breakdown = scoreRun(state, strategy, scenario.durationTicks);
  const meta = CHALLENGE_META[scenarioId];
  const pnl = state.equityCents - state.startingEquityCents;
  useEffect(() => {
    if (!running || finished || !active) return;
    const timer = window.setInterval(
      () =>
        setState((previous) => stepSimulation(previous, scenario, strategy)),
      400 / speed
    );
    return () => window.clearInterval(timer);
  }, [running, finished, scenario, strategy, speed, active]);
  function reset(nextScenario = scenario, nextStrategy = strategy) {
    setRunning(false);
    setDismissed(false);
    setState(createSimulation(nextScenario, nextStrategy));
  }
  function select(id: ScenarioId) {
    setScenarioId(id);
    onScenarioChange?.(id);
    reset(SCENARIOS[id]);
  }
  function update(key: keyof StrategyConfig, value: number) {
    const next = { ...strategy, [key]: value };
    setStrategy(next);
    reset(scenario, next);
  }
  const volume =
    state.fills.reduce((sum, fill) => sum + fill.sizeMilliSol, 0) / 1000;
  const change =
    (state.referencePriceCents / scenario.startingPriceCents - 1) * 100;
  const history = state.priceHistoryCents;
  const returns = history
    .slice(1)
    .map((price, i) => (price - history[i]) / history[i]);
  const mean = returns.reduce((a, b) => a + b, 0) / Math.max(1, returns.length);
  const volatility = Math.sqrt(
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) /
      Math.max(1, returns.length)
  );
  const varCents = Math.round(
    (state.baseMilliSol / 1000) * state.referencePriceCents * volatility * 1.645
  );
  return (
    <section className="workspace" aria-label="Strategy Lab">
      <div className="workspace-top">
        <span>
          <strong>Learn. Simulate. Compete.</strong> · Solana DeFi Market-Making
          Laboratory
        </span>
        <span className="mono">DETERMINISTIC ENGINE / V1.0</span>
      </div>
      <div className="context-banner">
        <div>
          <p className="eyebrow">
            ACTIVE CHALLENGE · {meta.level.toUpperCase()}
          </p>
          <h1>{scenario.name}</h1>
          <p className="tip">
            <IconBolt size={14} />
            {meta.tip}
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
          <PanelHeading eyebrow="PARAMETERS" title="Quote & Risk">
            <IconSettings size={17} />
          </PanelHeading>
          <div className="control-body">
            <label className="field">
              Scenario
              <select
                aria-label="Scenario"
                value={scenarioId}
                disabled={running && !finished}
                onChange={(e) => select(e.target.value as ScenarioId)}
              >
                {(
                  ["stable-market", "whale-sell", "flash-crash"] as ScenarioId[]
                ).map((id) => (
                  <option key={id} value={id}>
                    {SCENARIOS[id].name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <Control
                label="Spread"
                value={strategy.spreadBps}
                display={`${(strategy.spreadBps / 100).toFixed(2)}%`}
                min={10}
                max={100}
                step={1}
                ends={["0.10%", "1.00%"]}
                disabled={running && !finished}
                onChange={(v) => update("spreadBps", v)}
              />
              <div className="spread-viz">
                <span className="profit">BID {money(state.bidCents)}</span>
                <i style={{ width: `${strategy.spreadBps / 3}px` }} />
                <span className="loss">ASK {money(state.askCents)}</span>
              </div>
            </div>
            <div>
              <Control
                label="Order size"
                value={strategy.orderSizeMilliSol}
                display={`${(strategy.orderSizeMilliSol / 1000).toFixed(1)} SOL`}
                min={500}
                max={10000}
                step={500}
                ends={["0.5 SOL", "10 SOL"]}
                disabled={running && !finished}
                onChange={(v) => update("orderSizeMilliSol", v)}
              />
            </div>
            <div>
              <Control
                label="Max inventory"
                value={strategy.maxInventoryMilliSol}
                display={`${strategy.maxInventoryMilliSol / 1000} SOL`}
                min={100000}
                max={160000}
                step={1000}
                ends={["100 SOL", "160 SOL"]}
                disabled={running && !finished}
                onChange={(v) => update("maxInventoryMilliSol", v)}
              />
              <div className="headroom">
                <i
                  style={{
                    width: `${(state.baseMilliSol / strategy.maxInventoryMilliSol) * 100}%`,
                  }}
                />
              </div>
              <p className="control-hint">
                {(
                  (strategy.maxInventoryMilliSol - state.baseMilliSol) /
                  1000
                ).toFixed(1)}{" "}
                SOL available headroom
              </p>
            </div>
            <div>
              <Control
                label="Refresh cycle"
                value={strategy.refreshTicks}
                display={`${strategy.refreshTicks} ticks`}
                min={1}
                max={10}
                step={1}
                ends={["1 tick", "10 ticks"]}
                disabled={running && !finished}
                onChange={(v) => update("refreshTicks", v)}
              />
            </div>
            <div className="speed">
              <span className="eyebrow">Simulation speed</span>
              <div className="segmented">
                {[1, 2, 5].map((value) => (
                  <button
                    key={value}
                    className={speed === value ? "active" : ""}
                    aria-pressed={speed === value}
                    onClick={() => setSpeed(value)}
                  >
                    {value}×
                  </button>
                ))}
              </div>
            </div>
            <div className="action-row">
              <button
                className="btn primary"
                disabled={finished}
                onClick={() => setRunning(!running)}
              >
                {running && !finished ? (
                  <IconPlayerPause size={15} />
                ) : (
                  <IconPlayerPlay size={15} />
                )}
                {finished
                  ? "Complete"
                  : running
                    ? "Pause"
                    : state.tick
                      ? "Resume"
                      : "Start Challenge"}
              </button>
              <button
                className="icon-button"
                onClick={() => reset()}
                aria-label="Reset simulation"
              >
                <IconRefresh size={16} />
              </button>
            </div>
          </div>
          <div className="control-footnote">
            <IconShieldCheck size={13} />
            Simulated funds. Real learning.
          </div>
        </aside>
        <div className="market-column">
          <section className="panel">
            <div className="market-header">
              <div>
                <div className="market-pair">
                  <span className="pair-icon">◎</span>
                  <div>
                    <h2>SOL / USDC</h2>
                    <small>DETERMINISTIC MARKET · SIMULATED</small>
                  </div>
                </div>
                <div className="price-readout">
                  <strong>{money(state.referencePriceCents, 3)}</strong>
                  <span className={`change-badge ${change < 0 ? "loss" : ""}`}>
                    {change >= 0 ? "+" : ""}
                    {change.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="market-extremes">
                <div>
                  <small>SESSION HIGH</small>
                  <b>{money(Math.max(...history))}</b>
                </div>
                <div>
                  <small>SESSION LOW</small>
                  <b>{money(Math.min(...history))}</b>
                </div>
              </div>
            </div>
            <div className="tick-row">
              <span>
                TICK <b>{String(state.tick).padStart(2, "0")}</b> /{" "}
                {scenario.durationTicks}
              </span>
              <div className="bar-track">
                <i
                  style={{
                    width: `${(state.tick / scenario.durationTicks) * 100}%`,
                  }}
                />
              </div>
              <b>
                {finished
                  ? "COMPLETE"
                  : running
                    ? "RUNNING"
                    : state.tick
                      ? "PAUSED"
                      : "IDLE"}
              </b>
            </div>
            <ChartSwitcher
              view={chartView}
              onViewChange={setChartView}
              state={state}
              scenario={scenario}
              strategy={strategy}
            />
          </section>
          <div className="hud-grid">
            <Metric
              label="YOUR BID"
              value={money(state.bidCents)}
              detail={`${Math.round(strategy.spreadBps / 2)} bps below`}
              tone="profit"
            />
            <Metric
              label="YOUR ASK"
              value={money(state.askCents)}
              detail={`${Math.round(strategy.spreadBps / 2)} bps above`}
              tone="loss"
            />
            <Metric
              label="TOTAL FILLS"
              value={state.fills.length}
              detail={`${volume.toFixed(1)} SOL volume`}
            />
            <Metric
              label="INVENTORY"
              value={`${(state.baseMilliSol / 1000).toFixed(1)} SOL`}
              detail={`${((strategy.maxInventoryMilliSol - state.baseMilliSol) / 1000).toFixed(1)} SOL headroom`}
              tone={
                state.baseMilliSol / strategy.maxInventoryMilliSol > 0.9
                  ? "loss"
                  : ""
              }
            />
          </div>
          <div className="bottom-grid">
            <DepthLadder state={state} strategy={strategy} />
            <section className="panel terminal">
              <PanelHeading title="Execution feed">
                <span className="live">
                  <i />
                  {running && !finished ? "LIVE" : "LOCAL"}
                </span>
              </PanelHeading>
              <div
                className="terminal-lines"
                role="log"
                aria-label="Execution activity"
              >
                {state.activity
                  .slice()
                  .reverse()
                  .map((line, i) => (
                    <div className="terminal-line" key={`${state.tick}-${i}`}>
                      <time>
                        00:00:
                        {String(Math.max(0, state.tick - i)).padStart(2, "0")}
                      </time>
                      <span
                        className={
                          /Bought|Sold/.test(line)
                            ? "terminal-fill"
                            : /Whale|crash/.test(line)
                              ? "warning"
                              : ""
                        }
                      >
                        {line}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        </div>
        <aside className="score-column">
          <section className="panel pnl-card">
            <p className="eyebrow">NET SIMULATED P&L</p>
            <strong className={pnl >= 0 ? "profit" : "loss"}>
              {signedMoney(pnl)}
            </strong>
            <small className={pnl >= 0 ? "profit" : "loss"}>
              <IconArrowUpRight size={13} />
              {((pnl / state.startingEquityCents) * 100).toFixed(2)}%{" "}
              <span className="muted">session return</span>
            </small>
          </section>
          <section className="panel score-card">
            <p className="eyebrow">
              STRATEGY SCORE <IconGauge size={12} style={{ float: "right" }} />
            </p>
            <div
              className="score-ring"
              style={
                { "--score": `${breakdown.total / 100}%` } as CSSProperties
              }
            >
              <div>
                <strong>{breakdown.total.toLocaleString("en-US")}</strong>
                <small>/ 10,000</small>
              </div>
            </div>
            <span className="tier-badge">
              <IconCrown size={12} />
              {tier(breakdown.total).toUpperCase()} PACE
            </span>
          </section>
          <section className="panel breakdown">
            <div className="breakdown-heading">
              <p className="eyebrow">SCORE QUALITY</p>
              <span>WEIGHTED</span>
            </div>
            {dimensions.map(([key, label, weight, target]) => (
              <ScoreBar
                key={key}
                label={label}
                value={breakdown[key]}
                weight={weight}
                target={target}
              />
            ))}
          </section>
          <div className="panel risk-grid">
            <Metric
              label="MAX DRAWDOWN"
              value={`${(state.maxDrawdownBps / 100).toFixed(2)}%`}
              detail="Limit 8.00%"
              tone="warning"
            />
            <Metric
              label="VALUE AT RISK"
              value={money(varCents)}
              detail="95% · 1 tick estimate"
            />
          </div>
        </aside>
      </div>
      {active && finished && !dismissed && (
        <Modal title="Session debrief" onClose={() => setDismissed(true)}>
          <Results
            scenario={scenario}
            strategy={strategy}
            state={state}
            breakdown={breakdown}
            pnlCents={pnl}
            onAgain={() => reset()}
            onChallenges={() => {
              setDismissed(true);
              setDrawer(true);
            }}
          />
        </Modal>
      )}
      {finished && dismissed && (
        <button
          className="btn"
          style={{ marginTop: 12 }}
          onClick={() => setDismissed(false)}
        >
          <IconCrown size={15} />
          View results
        </button>
      )}
      {active && drawer && (
        <ChallengeDrawer
          selected={scenarioId}
          onSelect={select}
          onClose={() => setDrawer(false)}
        />
      )}
    </section>
  );
}

function Control({
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
        onChange={(e) => onChange(Number(e.target.value))}
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

function replaySnapshots(
  scenario: Scenario,
  strategy: StrategyConfig,
  tick: number
) {
  const snapshots = [createSimulation(scenario, strategy)];
  while (snapshots[snapshots.length - 1].tick < tick) {
    snapshots.push(
      stepSimulation(snapshots[snapshots.length - 1], scenario, strategy)
    );
  }
  return snapshots;
}

function ChartSwitcher({
  view,
  onViewChange,
  state,
  scenario,
  strategy,
}: {
  view: ChartView;
  onViewChange: (view: ChartView) => void;
  state: SimulationState;
  scenario: Scenario;
  strategy: StrategyConfig;
}) {
  const snapshots = useMemo(
    () => replaySnapshots(scenario, strategy, state.tick),
    [scenario, strategy, state.tick]
  );
  const option = CHART_OPTIONS.find((item) => item.value === view)!;
  const isPrice = option.group === "Price";
  const isAlternativePrice = ["area", "candles", "ohlc", "heikin"].includes(
    view
  );

  return (
    <>
      <div className="chart-toolbar">
        <div>
          <span className="eyebrow">Market visualizer</span>
          <strong>{option.label}</strong>
        </div>
        <label className="chart-select">
          <span className="sr-only">Chart view</span>
          <select
            aria-label="Chart view"
            value={view}
            onChange={(event) => onViewChange(event.target.value as ChartView)}
          >
            {["Price", "Analytics"].map((group) => (
              <optgroup key={group} label={group}>
                {CHART_OPTIONS.filter((item) => item.group === group).map(
                  (item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  )
                )}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      {view === "line" ? (
        <PriceChart state={state} scenario={scenario} />
      ) : isAlternativePrice ? (
        <PriceStyleChart
          view={view as "area" | "candles" | "ohlc" | "heikin"}
          state={state}
        />
      ) : (
        <AnalyticsChart
          view={view as "depth" | "spread" | "inventory" | "pnl" | "drawdown"}
          snapshots={snapshots}
          state={state}
          strategy={strategy}
        />
      )}
      <div className="chart-legend">
        {view === "depth" ? (
          <>
            <span className="profit">
              <i className="legend-dot" /> Bids
            </span>
            <span className="loss">
              <i className="legend-dot" /> Asks
            </span>
            <span>cumulative simulated liquidity</span>
          </>
        ) : isPrice ? (
          <>
            <span className="primary">
              <i className="legend-dot" /> SOL / USDC
            </span>
            <span className="profit">
              <i className="legend-dot" /> Buy fill
            </span>
            <span className="loss">
              <i className="legend-dot" /> Sell fill
            </span>
          </>
        ) : (
          <span>Derived from this deterministic simulation run</span>
        )}
      </div>
    </>
  );
}

function useChartViewport(total: number) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ x: number; offset: number } | null>(null);
  const windowSize = Math.max(8, Math.min(total, Math.round(total / zoom)));
  const maxOffset = Math.max(0, total - windowSize);
  const start = Math.max(0, maxOffset - Math.min(maxOffset, offset));
  const end = Math.min(total, start + windowSize);
  const onWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    setZoom((current) =>
      Math.max(
        1,
        Math.min(
          Math.max(1, total / 8),
          current * (event.deltaY < 0 ? 1.25 : 0.8)
        )
      )
    );
  };
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    drag.current = { x: event.clientX, offset };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const width = Math.max(
      1,
      event.currentTarget.getBoundingClientRect().width
    );
    const movedBars = Math.round(
      ((drag.current.x - event.clientX) / width) * windowSize
    );
    setOffset(
      Math.max(0, Math.min(maxOffset, drag.current.offset + movedBars))
    );
  };
  const finishDrag = () => {
    drag.current = null;
  };
  return {
    start,
    end,
    zoom,
    reset: () => {
      setZoom(1);
      setOffset(0);
    },
    zoomIn: () =>
      setZoom((current) => Math.min(Math.max(1, total / 8), current * 1.25)),
    zoomOut: () => setZoom((current) => Math.max(1, current * 0.8)),
    svgEvents: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
    },
  };
}

function ChartNavigation({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="chart-navigation" aria-label="Chart navigation">
      <button type="button" onClick={onZoomIn} aria-label="Zoom in chart">
        +
      </button>
      <button type="button" onClick={onZoomOut} aria-label="Zoom out chart">
        −
      </button>
      <button type="button" onClick={onReset} disabled={zoom === 1}>
        Fit
      </button>
      <span>Scroll to zoom · drag to pan</span>
    </div>
  );
}

function PriceStyleChart({
  view,
  state,
}: {
  view: Exclude<
    ChartView,
    "line" | "depth" | "spread" | "inventory" | "pnl" | "drawdown"
  >;
  state: SimulationState;
}) {
  const values = state.priceHistoryCents;
  const viewport = useChartViewport(values.length);
  const visibleValues = values.slice(viewport.start, viewport.end);
  const candles = useMemo(() => {
    const result: Array<{
      open: number;
      high: number;
      low: number;
      close: number;
    }> = [];
    const bucketSize = Math.max(1, Math.ceil(visibleValues.length / 32));
    for (let index = 0; index < visibleValues.length; index += bucketSize) {
      const chunk = visibleValues.slice(index, index + bucketSize);
      const open = chunk[0];
      const close = chunk[chunk.length - 1];
      const observedHigh = Math.max(...chunk);
      const observedLow = Math.min(...chunk);
      // The simulator publishes one reference price per tick rather than a
      // full exchange OHLC bar. Keep its actual open/close, then expose a
      // small deterministic intratick range so every candle has readable wicks.
      const wickSize = Math.max(
        2,
        Math.ceil(Math.abs(close - open) * 0.4),
        Math.ceil((observedHigh - observedLow) * 0.25)
      );
      result.push({
        open,
        high: observedHigh + wickSize,
        low: observedLow - wickSize,
        close,
      });
    }
    if (view !== "heikin") return result;
    return result.map((candle, index) => {
      const previous = result[index - 1];
      const close = Math.round(
        (candle.open + candle.high + candle.low + candle.close) / 4
      );
      const open = previous
        ? Math.round((previous.open + previous.close) / 2)
        : Math.round((candle.open + candle.close) / 2);
      return {
        open,
        close,
        high: Math.max(candle.high, open, close),
        low: Math.min(candle.low, open, close),
      };
    });
  }, [visibleValues, view]);
  const flattened = candles.flatMap((candle) => [candle.high, candle.low]);
  const min = Math.min(...flattened) - 15;
  const max = Math.max(...flattened) + 15;
  const y = (value: number) =>
    195 - ((value - min) / Math.max(1, max - min)) * 175;
  const x = (index: number) => ((index + 0.5) / candles.length) * 720;
  const points = visibleValues
    .map(
      (value, index) =>
        `${(index / Math.max(1, visibleValues.length - 1)) * 720},${y(value)}`
    )
    .join(" ");
  const name =
    view === "area"
      ? "Area price chart"
      : view === "candles"
        ? "Candlestick price chart"
        : view === "ohlc"
          ? "OHLC price chart"
          : "Heikin-Ashi price chart";

  return (
    <div className="price-chart alternative-chart">
      <svg
        viewBox="0 0 720 210"
        preserveAspectRatio="none"
        role="img"
        aria-label={name}
        className="interactive-chart"
        {...viewport.svgEvents}
      >
        {view === "area" && (
          <polygon points={`0,210 ${points} 720,210`} className="chart-area" />
        )}
        {view === "area" ? (
          <polyline
            points={points}
            className="chart-line"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          candles.map((candle, index) => {
            const center = x(index);
            const rising = candle.close >= candle.open;
            const top = y(Math.max(candle.open, candle.close));
            const height = Math.max(
              2,
              Math.abs(y(candle.open) - y(candle.close))
            );
            const className = rising ? "candle-up" : "candle-down";
            return (
              <g key={index} className={className}>
                <line
                  x1={center}
                  x2={center}
                  y1={y(candle.high)}
                  y2={y(candle.low)}
                  className="candle-wick"
                  vectorEffect="non-scaling-stroke"
                />
                {view === "ohlc" ? (
                  <>
                    <line
                      x1={center - 8}
                      x2={center}
                      y1={y(candle.open)}
                      y2={y(candle.open)}
                      className="candle-wick"
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={center}
                      x2={center + 8}
                      y1={y(candle.close)}
                      y2={y(candle.close)}
                      className="candle-wick"
                      vectorEffect="non-scaling-stroke"
                    />
                  </>
                ) : (
                  <rect
                    x={center - Math.min(10, 220 / candles.length)}
                    y={top}
                    width={Math.min(20, 440 / candles.length)}
                    height={height}
                    className="candle-body"
                  />
                )}
              </g>
            );
          })
        )}
      </svg>
      <div className="price-axis">
        <span>{money(max)}</span>
        <span>{money((max + min) / 2)}</span>
        <span>{money(min)}</span>
      </div>
      <ChartTimeAxis />
      <ChartNavigation
        zoom={viewport.zoom}
        onZoomIn={viewport.zoomIn}
        onZoomOut={viewport.zoomOut}
        onReset={viewport.reset}
      />
    </div>
  );
}

function ChartTimeAxis() {
  return (
    <div className="time-axis">
      {[0, 10, 20, 30, 40, 50, 60].map((tick) => (
        <span key={tick}>T{tick.toString().padStart(2, "0")}</span>
      ))}
    </div>
  );
}

function AnalyticsChart({
  view,
  snapshots,
  state,
  strategy,
}: {
  view: "depth" | "spread" | "inventory" | "pnl" | "drawdown";
  snapshots: SimulationState[];
  state: SimulationState;
  strategy: StrategyConfig;
}) {
  if (view === "depth") return <DepthChart state={state} strategy={strategy} />;
  const series = snapshots.map((snapshot) => {
    if (view === "spread") return (snapshot.askCents - snapshot.bidCents) * 100;
    if (view === "inventory") return snapshot.baseMilliSol / 1000;
    if (view === "pnl")
      return (snapshot.equityCents - snapshot.startingEquityCents) / 100;
    return (
      -(
        (snapshot.peakEquityCents - snapshot.equityCents) /
        snapshot.peakEquityCents
      ) * 100
    );
  });
  const label =
    view === "spread"
      ? "Bid / ask spread (basis points)"
      : view === "inventory"
        ? "Inventory (SOL)"
        : view === "pnl"
          ? "P&L / equity chart"
          : "Drawdown chart";
  return <SeriesChart values={series} label={label} tone={view} />;
}

function SeriesChart({
  values,
  label,
  tone,
}: {
  values: number[];
  label: string;
  tone: string;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const floor = min === max ? min - 1 : min;
  const ceiling = min === max ? max + 1 : max;
  const y = (value: number) =>
    195 - ((value - floor) / (ceiling - floor)) * 175;
  const points = values
    .map(
      (value, index) =>
        `${(index / Math.max(1, values.length - 1)) * 720},${y(value)}`
    )
    .join(" ");
  return (
    <div className={`price-chart analytics-chart ${tone}`}>
      <svg
        viewBox="0 0 720 210"
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
      >
        <line
          x1="0"
          x2="720"
          y1={y(0)}
          y2={y(0)}
          className="chart-baseline"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={points}
          className="chart-line"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="price-axis">
        <span>{ceiling.toFixed(2)}</span>
        <span>{((ceiling + floor) / 2).toFixed(2)}</span>
        <span>{floor.toFixed(2)}</span>
      </div>
      <ChartTimeAxis />
    </div>
  );
}

function DepthChart({
  state,
  strategy,
}: {
  state: SimulationState;
  strategy: StrategyConfig;
}) {
  const levels = [1, 2, 3, 4, 5];
  return (
    <div className="price-chart depth-chart">
      <svg
        viewBox="0 0 720 210"
        preserveAspectRatio="none"
        role="img"
        aria-label="Order book depth chart"
      >
        <line
          x1="360"
          x2="360"
          y1="10"
          y2="200"
          className="chart-baseline"
          vectorEffect="non-scaling-stroke"
        />
        {levels.map((level) => {
          const size = Math.round((strategy.orderSizeMilliSol / 1000) * level);
          const width = level * 55;
          const y = 200 - level * 34;
          return (
            <g key={level}>
              <rect
                x={360 - width}
                y={y}
                width={width}
                height={25}
                className="depth-bid"
              />
              <rect
                x="360"
                y={y}
                width={width}
                height={25}
                className="depth-ask"
              />
              <text x={350 - width} y={y + 16} className="depth-label">
                {size} SOL
              </text>
              <text x={370 + width - 8} y={y + 16} className="depth-label">
                {size} SOL
              </text>
            </g>
          );
        })}
        <text x="274" y="205" className="depth-price">
          BID {money(state.bidCents)}
        </text>
        <text x="377" y="205" className="depth-price">
          ASK {money(state.askCents)}
        </text>
      </svg>
      <ChartTimeAxis />
    </div>
  );
}

export function PriceChart({
  state,
  scenario,
}: {
  state: SimulationState;
  scenario: Scenario;
}) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const values = state.priceHistoryCents;
  const min = Math.min(...values, ...state.fills.map((f) => f.priceCents)) - 15;
  const max = Math.max(...values, ...state.fills.map((f) => f.priceCents)) + 15;
  const y = (v: number) => 195 - ((v - min) / (max - min)) * 175;
  const x = (t: number) => (t / scenario.durationTicks) * 720;
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <div className="price-chart">
      <svg
        viewBox="0 0 720 210"
        preserveAspectRatio="none"
        role="img"
        aria-label="Deterministic SOL price chart"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHover(
            Math.max(
              0,
              Math.min(
                values.length - 1,
                Math.round(
                  ((e.clientX - rect.left) / rect.width) *
                    scenario.durationTicks
                )
              )
            )
          );
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity=".28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1="0"
          y1="105"
          x2="720"
          y2="105"
          stroke="var(--border)"
          strokeDasharray="4 5"
          vectorEffect="non-scaling-stroke"
        />
        <polygon
          points={`0,210 ${points} ${x(values.length - 1)},210`}
          fill={`url(#${id})`}
        />
        {scenario.events.map((event) => (
          <g key={event.tick}>
            <line
              x1={x(event.tick)}
              x2={x(event.tick)}
              y1="20"
              y2="210"
              className="chart-event"
              vectorEffect="non-scaling-stroke"
            />
            <text x={x(event.tick) + 5} y={12} className="event-label">
              {event.label === "Whale sell-off"
                ? "WHALE SELL"
                : event.label.toUpperCase()}{" "}
              · T{event.tick}
            </text>
            {state.tick >= event.tick && (
              <circle
                cx={x(event.tick)}
                cy={y(values[event.tick])}
                r="4"
                className="event-dot"
              />
            )}
          </g>
        ))}
        <polyline
          points={points}
          className="chart-line"
          vectorEffect="non-scaling-stroke"
        />
        {state.fills.map((fill) => (
          <circle
            key={`${fill.tick}-${fill.side}`}
            cx={x(fill.tick)}
            cy={y(fill.priceCents)}
            r="4"
            className={fill.side === "buy" ? "fill-buy" : "fill-sell"}
          >
            <title>
              {fill.side === "buy" ? "Buy" : "Sell"} fill at{" "}
              {money(fill.priceCents)}
            </title>
          </circle>
        ))}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1="0"
            y2="210"
            stroke="var(--muted-foreground)"
            strokeDasharray="2 3"
          />
        )}
      </svg>
      <div className="price-axis">
        <span>{money(max)}</span>
        <span>{money((max + min) / 2)}</span>
        <span>{money(min)}</span>
      </div>
      <div className="time-axis">
        {[0, 10, 20, 30, 40, 50, 60].map((t) => (
          <span key={t}>T{t.toString().padStart(2, "0")}</span>
        ))}
      </div>
      {hover !== null && (
        <div className="chart-tooltip">
          T{hover} · {money(values[hover])}
        </div>
      )}
    </div>
  );
}

function DepthLadder({
  state,
  strategy,
}: {
  state: SimulationState;
  strategy: StrategyConfig;
}) {
  const gap = Math.max(1, state.askCents - state.bidCents);
  return (
    <section className="panel orderbook">
      <PanelHeading title="Depth ladder">
        <IconBrandDatabricks size={15} />
      </PanelHeading>
      <div className="book-labels">
        <span>PRICE (USDC)</span>
        <span>SIZE (SOL)</span>
        <span>TOTAL</span>
      </div>
      {[3, 2, 1].map((n) => (
        <div className="book-row ask" key={n}>
          <i style={{ width: `${n * 28}%` }} />
          <span>{money(state.askCents + (n - 1) * gap)}</span>
          <span>{((strategy.orderSizeMilliSol / 1000) * n).toFixed(2)}</span>
          <span>
            {(((strategy.orderSizeMilliSol / 1000) * n * (n + 1)) / 2).toFixed(
              2
            )}
          </span>
        </div>
      ))}
      <div className="book-mid">
        <span>
          {money(state.referencePriceCents)}{" "}
          <IconArrowUpRight size={12} style={{ display: "inline" }} />
        </span>
        <small>ILLUSTRATIVE DEPTH</small>
      </div>
      {[1, 2, 3].map((n) => (
        <div className="book-row bid" key={n}>
          <i style={{ width: `${n * 28}%` }} />
          <span>{money(state.bidCents - (n - 1) * gap)}</span>
          <span>{((strategy.orderSizeMilliSol / 1000) * n).toFixed(2)}</span>
          <span>
            {(((strategy.orderSizeMilliSol / 1000) * n * (n + 1)) / 2).toFixed(
              2
            )}
          </span>
        </div>
      ))}
    </section>
  );
}

export function Results({
  scenario,
  strategy,
  state,
  breakdown,
  pnlCents,
  onAgain,
  onChallenges,
}: {
  scenario: Scenario;
  strategy: StrategyConfig;
  state: SimulationState;
  breakdown: ReturnType<typeof scoreRun>;
  pnlCents: number;
  verified?: boolean;
  onAgain: () => void;
  onChallenges: () => void;
}) {
  const [commitment, setCommitment] = useState<ResultCommitment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function verify() {
    setBusy(true);
    setError("");
    try {
      setCommitment(
        await createResultCommitment({
          scenario,
          strategy,
          state,
          score: breakdown,
        })
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not prepare commitment."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="result-content">
      <div className="result-glow" />
      <div className="result-crown">
        <IconCrown size={27} />
      </div>
      <p className="eyebrow profit">CHALLENGE COMPLETE</p>
      <h3>{tier(breakdown.total)} Market Maker</h3>
      <p className="muted">
        {scenario.name} · {state.tick} ticks settled locally
      </p>
      <div className="final-score">
        <p className="eyebrow">FINAL SCORE</p>
        <strong>{breakdown.total.toLocaleString("en-US")}</strong>
        <small>/ 10,000 · {signedMoney(pnlCents)} simulated P&L</small>
      </div>
      <div className="result-dimensions">
        {dimensions.map(([key, label]) => (
          <ScoreBar key={key} label={label} value={breakdown[key]} />
        ))}
      </div>
      <div className="lesson">
        <strong>
          <IconBolt size={14} />
          KEY QUANT LESSON
        </strong>
        <p>
          {state.maxDrawdownBps > 200
            ? "The price shock exposed your held inventory. Try a lower inventory cap or smaller orders, then compare drawdown on the same scenario."
            : state.fills.length < 4
              ? "Few orders filled. Try a faster refresh cycle and rerun the identical market to compare participation."
              : "You maintained active quotes through this market. Compare order sizes to see how inventory exposure changes your P&L."}
        </p>
      </div>
      <div className="action-row">
        <button className="btn primary" onClick={onAgain}>
          <IconRefresh size={15} />
          Run again
        </button>
        <button
          className="btn"
          onClick={() => void verify()}
          disabled={busy || !!commitment}
        >
          <IconShieldCheck size={15} />
          {busy
            ? "Hashing…"
            : commitment
              ? "Commitment prepared"
              : "Verify on Solana"}
        </button>
      </div>
      <p className="control-hint">
        Local commitment preview · no on-chain transaction is sent.
      </p>
      {commitment && (
        <div className="commitment" aria-live="polite">
          <p className="profit">
            <IconCheck size={13} style={{ display: "inline" }} />
            Result hashed locally · awaiting devnet submission
          </p>
          <dl>
            <dt>Strategy hash</dt>
            <dd>{commitment.strategyHash}</dd>
            <dt>Result hash</dt>
            <dd>{commitment.resultHash}</dd>
          </dl>
        </div>
      )}
      {error && (
        <p role="alert" className="loss">
          {error}
        </p>
      )}
      <button
        className="btn ghost wide"
        style={{ marginTop: 10 }}
        onClick={onChallenges}
      >
        Try another challenge
      </button>
    </section>
  );
}
