"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "../lib/wallet/context";
import {
  createResultCommitment,
  type ResultCommitment,
} from "../lib/results/commitment";
import {
  DEFAULT_STRATEGY,
  createSimulation,
  LocalSimulationRuntime,
  SCENARIOS,
  type ScenarioId,
  type SimulationState,
  type StrategyConfig,
} from "../lib/simulation";
import { scoreRun } from "../lib/simulation/score";

type View = "onboarding" | "lab" | "results";
const ONBOARDING_KEY = "spreadforge-onboarding-complete";
const money = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SimulationLab() {
  const [view, setView] = useState<View>("onboarding");
  const [scenarioId, setScenarioId] = useState<ScenarioId>("whale-sell");
  const [strategy, setStrategy] = useState<StrategyConfig>(DEFAULT_STRATEGY);
  const scenario = SCENARIOS[scenarioId];
  const [state, setState] = useState<SimulationState>(() =>
    createSimulation(scenario, strategy)
  );
  const runtime = useRef(new LocalSimulationRuntime());
  const [running, setRunning] = useState(false);
  const { status } = useWallet();
  const finished = state.tick >= scenario.durationTicks;
  const breakdown = useMemo(
    () => scoreRun(state, strategy, scenario.durationTicks),
    [state, strategy, scenario.durationTicks]
  );
  const pnlCents = state.equityCents - state.startingEquityCents;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (localStorage.getItem(ONBOARDING_KEY) === "true") setView("lab");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(
      () =>
        void runtime.current.step().then((next) => {
          setState(next);
          if (next.tick >= scenario.durationTicks) {
            setRunning(false);
            setView("results");
          }
        }),
      180
    );
    return () => window.clearInterval(timer);
  }, [running, scenario.durationTicks]);

  const reset = () => {
    setRunning(false);
    void runtime.current.start({ scenario, strategy }).then(setState);
  };
  const chooseScenario = (nextId: ScenarioId) => {
    setRunning(false);
    setScenarioId(nextId);
    void runtime.current
      .start({ scenario: SCENARIOS[nextId], strategy })
      .then(setState);
  };
  const begin = (nextId = scenarioId) => {
    chooseScenario(nextId);
    localStorage.setItem(ONBOARDING_KEY, "true");
    setView("lab");
    window.setTimeout(
      () => document.getElementById("challenge-controls")?.focus(),
      0
    );
  };
  const update = <K extends keyof StrategyConfig>(key: K, value: number) => {
    if (!running) {
      const next = { ...strategy, [key]: value };
      setStrategy(next);
      void runtime.current.start({ scenario, strategy: next }).then(setState);
    }
  };
  const startOrResume = () => {
    if (state.tick === 0)
      void runtime.current.start({ scenario, strategy }).then(setState);
    setRunning((value) => !value);
  };

  if (view === "onboarding")
    return (
      <Onboarding
        selected={scenarioId}
        onSelect={chooseScenario}
        onBegin={begin}
      />
    );
  if (view === "results")
    return (
      <Results
        scenario={scenario}
        strategy={strategy}
        state={state}
        breakdown={breakdown}
        pnlCents={pnlCents}
        verified={status === "connected"}
        onAgain={() => {
          reset();
          setView("lab");
        }}
        onChallenges={() => setView("onboarding")}
      />
    );

  return (
    <section className="space-y-5" aria-label="Strategy Lab">
      <div
        id="challenges"
        className="rounded-2xl border border-warning/20 bg-warning-soft px-5 py-4 text-sm text-foreground"
      >
        <strong>Challenge:</strong> {scenario.name}.{" "}
        {scenario.id === "whale-sell"
          ? "A large sell-off tests whether your inventory limit protects you."
          : "Keep two-sided liquidity without taking unnecessary risk."}
      </div>
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_260px]">
        <aside
          id="challenge-controls"
          tabIndex={-1}
          className="rounded-2xl border bg-card p-5 shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">
            1. Choose your strategy
          </p>
          <h2 className="mt-2 text-xl font-bold">Quote controls</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Set the rules for your simulated market maker.
          </p>
          <label className="mt-6 block text-sm font-medium">
            Challenge
            <select
              value={scenarioId}
              disabled={running}
              onChange={(event) =>
                chooseScenario(event.target.value as ScenarioId)
              }
              className="mt-2 min-h-11 w-full rounded-lg border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <option value="stable-market">Stable Market</option>
              <option value="whale-sell">Whale Sell</option>
            </select>
          </label>
          <Control
            label="Spread"
            value={(strategy.spreadBps / 100).toFixed(2)}
            suffix="%"
            min={10}
            max={100}
            step={5}
            disabled={running}
            onChange={(value) => update("spreadBps", value)}
          />
          <Control
            label="Order size"
            value={(strategy.orderSizeMilliSol / 1000).toFixed(1)}
            suffix=" SOL"
            min={500}
            max={10_000}
            step={500}
            disabled={running}
            onChange={(value) => update("orderSizeMilliSol", value)}
          />
          <Control
            label="Max inventory"
            value={(strategy.maxInventoryMilliSol / 1000).toFixed(0)}
            suffix=" SOL"
            min={100_000}
            max={160_000}
            step={5_000}
            disabled={running}
            onChange={(value) => update("maxInventoryMilliSol", value)}
          />
          <div className="mt-7 flex gap-2">
            <button
              onClick={startOrResume}
              disabled={finished}
              className="min-h-11 flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? "Pause" : state.tick ? "Resume" : "Start challenge"}
            </button>
            <button
              onClick={reset}
              className="min-h-11 rounded-lg border px-3 text-sm font-semibold text-foreground transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              Reset
            </button>
          </div>
        </aside>
        <main className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">
                2. Watch the market react
              </p>
              <h2 className="mt-2 text-xl font-bold">SOL / USDC</h2>
            </div>
            <span className="rounded-full bg-success-soft px-3 py-1.5 text-xs font-bold text-success">
              SIMULATED
            </span>
          </div>
          <div className="mt-7 flex items-end justify-between">
            <div>
              <p className="text-sm text-muted">Reference price</p>
              <p className="mt-1 font-mono text-4xl font-bold tracking-tight">
                {money(state.referencePriceCents)}
              </p>
            </div>
            <p className="rounded-lg bg-secondary px-3 py-2 font-mono text-sm text-secondary-foreground">
              Tick {state.tick}/{scenario.durationTicks}
            </p>
          </div>
          <PriceChart state={state} scenario={scenario} />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Your bid" value={money(state.bidCents)} />
            <Metric label="Your ask" value={money(state.askCents)} />
            <Metric label="Fills" value={String(state.fills.length)} />
            <Metric
              label="Inventory"
              value={`${(state.baseMilliSol / 1000).toFixed(1)} SOL`}
            />
          </div>
          <div className="mt-5 rounded-xl bg-secondary/60 p-4">
            <p className="text-xs font-bold uppercase tracking-[.12em] text-primary">
              What happened
            </p>
            <div className="mt-3 space-y-2">
              {state.activity
                .slice()
                .reverse()
                .slice(0, 3)
                .map((item, index) => (
                  <p className="text-sm text-muted" key={`${item}-${index}`}>
                    {item}
                  </p>
                ))}
            </div>
          </div>
        </main>
        <aside className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">
            3. Learn from the outcome
          </p>
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-sm text-muted">Net simulated P&L</p>
              <p
                className={`mt-1 font-mono text-2xl font-bold ${pnlCents >= 0 ? "text-success" : "text-destructive"}`}
              >
                {pnlCents >= 0 ? "+" : ""}
                {money(pnlCents)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">Current score</p>
              <p className="mt-1 font-mono text-3xl font-bold">
                {breakdown.total.toLocaleString()}
                <span className="text-sm font-normal text-muted">
                  {" "}
                  / 10,000
                </span>
              </p>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium">Score quality</p>
              <div className="mt-3 space-y-3">
                <ScoreRow label="Liquidity" value={breakdown.liquidity} />
                <ScoreRow label="Spread" value={breakdown.spreadEfficiency} />
                <ScoreRow
                  label="Inventory"
                  value={breakdown.inventoryControl}
                />
                <ScoreRow label="Drawdown" value={breakdown.drawdownControl} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Onboarding({
  selected,
  onSelect,
  onBegin,
}: {
  selected: ScenarioId;
  onSelect: (id: ScenarioId) => void;
  onBegin: (id?: ScenarioId) => void;
}) {
  return (
    <section
      id="challenges"
      className="mx-auto max-w-4xl rounded-3xl border bg-card p-6 shadow-sm sm:p-10"
    >
      <p className="text-sm font-bold uppercase tracking-[.16em] text-primary">
        Start here
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight">
        Learn in three simple steps.
      </h2>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {[
          ["1", "Choose a challenge", "Pick a market situation to practice."],
          ["2", "Set your strategy", "Control spread, size, and risk."],
          ["3", "See what changed", "Learn from fills, P&L, and score."],
        ].map(([number, title, text]) => (
          <div key={number} className="rounded-2xl bg-secondary/60 p-4">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {number}
            </span>
            <h3 className="mt-4 font-bold">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
          </div>
        ))}
      </div>
      <h3 className="mt-9 text-lg font-bold">Choose your first challenge</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {Object.values(SCENARIOS).map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`rounded-2xl border p-5 text-left transition focus-visible:ring-2 focus-visible:ring-ring ${selected === item.id ? "border-primary bg-accent" : "hover:bg-secondary"}`}
          >
            <span className="text-xs font-bold uppercase tracking-wide text-primary">
              {item.id === "stable-market" ? "Beginner" : "Intermediate"}
            </span>
            <h4 className="mt-2 text-lg font-bold">{item.name}</h4>
            <p className="mt-1 text-sm leading-6 text-muted">
              {item.id === "stable-market"
                ? "Keep balanced liquidity in a calm market."
                : "Survive a sudden sell-off without overloading inventory."}
            </p>
          </button>
        ))}
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => onBegin(selected)}
          className="min-h-11 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
        >
          Start challenge
        </button>
        <button
          onClick={() => onBegin(selected)}
          className="min-h-11 rounded-lg px-4 py-3 text-sm font-semibold text-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Skip guide
        </button>
      </div>
    </section>
  );
}

export function PriceChart({
  state,
  scenario,
}: {
  state: SimulationState;
  scenario: (typeof SCENARIOS)[ScenarioId];
}) {
  const values = state.priceHistoryCents;
  const min = Math.min(...values) - 15;
  const max = Math.max(...values) + 15;
  const range = Math.max(1, max - min);
  const points = values
    .map(
      (value, index) =>
        `${(index / Math.max(1, scenario.durationTicks)) * 100},${100 - ((value - min) / range) * 88 - 6}`
    )
    .join(" ");
  const y = (price: number) => `${100 - ((price - min) / range) * 88 - 6}%`;
  return (
    <div className="relative mt-7 h-64 overflow-hidden rounded-xl border bg-background p-3">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-label="Deterministic SOL price chart"
        role="img"
      >
        <line
          x1="0"
          y1="50"
          x2="100"
          y2="50"
          stroke="currentColor"
          className="text-border"
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          fill="none"
          points={points}
          stroke="currentColor"
          className="text-primary"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {scenario.events.map((event) => (
        <span
          key={event.tick}
          className="absolute top-3 border-l border-warning pl-1 text-[11px] font-bold text-warning"
          style={{ left: `${(event.tick / scenario.durationTicks) * 100}%` }}
        >
          {event.label}
        </span>
      ))}
      {state.fills.map((fill) => (
        <span
          key={`${fill.tick}-${fill.side}`}
          title={`${fill.side === "buy" ? "Buy" : "Sell"} fill at ${money(fill.priceCents)}`}
          className={`absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white ${fill.side === "buy" ? "bg-success" : "bg-destructive"}`}
          style={{
            left: `${(fill.tick / scenario.durationTicks) * 100}%`,
            top: y(fill.priceCents),
          }}
        >
          {fill.side === "buy" ? "B" : "S"}
        </span>
      ))}
    </div>
  );
}

export function Results({
  scenario,
  strategy,
  state,
  breakdown,
  pnlCents,
  verified,
  onAgain,
  onChallenges,
}: {
  scenario: (typeof SCENARIOS)[ScenarioId];
  strategy: StrategyConfig;
  state: SimulationState;
  breakdown: ReturnType<typeof scoreRun>;
  pnlCents: number;
  verified: boolean;
  onAgain: () => void;
  onChallenges: () => void;
}) {
  const [commitment, setCommitment] = useState<ResultCommitment | null>(null);
  const [commitmentError, setCommitmentError] = useState<string | null>(null);
  const insight =
    state.maxDrawdownBps > 200
      ? "Price movement caused meaningful drawdown. A lower inventory cap could reduce risk."
      : state.fills.length < 4
        ? "Your quotes captured few fills. A tighter spread may improve participation."
        : "You kept quotes active and captured multiple fills while managing inventory.";
  return (
    <section className="mx-auto max-w-3xl rounded-3xl border bg-card p-6 shadow-sm sm:p-10">
      <span className="inline-flex rounded-full bg-success-soft px-3 py-1.5 text-xs font-bold text-success">
        CHALLENGE COMPLETE
      </span>
      <h2 className="mt-4 text-3xl font-bold tracking-tight">
        You finished {scenario.name}.
      </h2>
      <p className="mt-2 text-muted">
        Here is what your simulated market-making strategy achieved.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total score" value={breakdown.total.toLocaleString()} />
        <Metric
          label="Net P&L"
          value={`${pnlCents >= 0 ? "+" : ""}${money(pnlCents)}`}
        />
        <Metric label="Fills" value={String(state.fills.length)} />
        <Metric
          label="Max drawdown"
          value={`${(state.maxDrawdownBps / 100).toFixed(2)}%`}
        />
      </div>
      <div className="mt-6 rounded-2xl bg-warning-soft p-5">
        <p className="text-sm font-bold text-warning">Key lesson</p>
        <p className="mt-2 leading-7 text-foreground">{insight}</p>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <ScoreRow label="Liquidity" value={breakdown.liquidity} />
        <ScoreRow
          label="Spread efficiency"
          value={breakdown.spreadEfficiency}
        />
        <ScoreRow
          label="Inventory control"
          value={breakdown.inventoryControl}
        />
        <ScoreRow label="Drawdown control" value={breakdown.drawdownControl} />
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onAgain}
          className="min-h-11 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Run again
        </button>
        <button
          onClick={onChallenges}
          className="min-h-11 rounded-lg border px-5 py-3 text-sm font-bold hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          Try another challenge
        </button>
        <button
          onClick={() => {
            setCommitmentError(null);
            void createResultCommitment({
              scenario,
              strategy,
              score: breakdown,
              state,
            })
              .then(setCommitment)
              .catch((error: unknown) =>
                setCommitmentError(
                  error instanceof Error
                    ? error.message
                    : "Could not prepare result verification."
                )
              );
          }}
          className="min-h-11 rounded-lg border border-primary/30 bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          Prepare verification
        </button>
      </div>
      <div
        className="mt-5 rounded-xl border border-dashed border-primary/30 bg-secondary/40 p-4"
        aria-live="polite"
      >
        <p className="text-sm font-bold">Solana result commitment</p>
        {commitment ? (
          <>
            <p className="mt-1 text-sm text-muted">
              Your deterministic result has been hashed locally. No wallet
              request or transaction has been sent.
            </p>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted">Strategy hash</dt>
                <dd className="mt-1 break-all font-mono text-foreground">
                  {commitment.strategyHash}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Result hash</dt>
                <dd className="mt-1 break-all font-mono text-foreground">
                  {commitment.resultHash}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">
            Prepare the canonical hashes that a future devnet transaction will
            store in the Result Registry PDA.
          </p>
        )}
        {commitmentError && (
          <p className="mt-2 text-sm text-destructive">{commitmentError}</p>
        )}
        <p className="mt-3 text-xs text-muted">
          {verified
            ? "Devnet registry deployment is still required before this result can be submitted."
            : "Connect a wallet after deployment to submit this result on devnet."}
        </p>
      </div>
    </section>
  );
}

function Control({
  label,
  value,
  suffix,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  suffix: string;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-5 block">
      <span className="flex justify-between text-sm font-medium">
        <span>{label}</span>
        <span className="font-mono text-primary">
          {value}
          {suffix}
        </span>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
    </label>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 truncate font-mono text-base font-bold">{value}</p>
    </div>
  );
}
function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono font-bold">{Math.round(value)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
