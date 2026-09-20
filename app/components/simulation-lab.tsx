"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SimulationLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("whale-sell");
  const [strategy, setStrategy] = useState<StrategyConfig>(DEFAULT_STRATEGY);
  const scenario = SCENARIOS[scenarioId];
  const [state, setState] = useState<SimulationState>(() =>
    createSimulation(scenario, strategy)
  );
  const runtime = useRef(new LocalSimulationRuntime());
  const [running, setRunning] = useState(false);
  const finished = state.tick >= scenario.durationTicks;
  const breakdown = useMemo(
    () => scoreRun(state, strategy, scenario.durationTicks),
    [state, strategy, scenario.durationTicks]
  );
  const pnlCents = state.equityCents - state.startingEquityCents;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(
      () =>
        void runtime.current.step().then((next) => {
          if (next.tick >= scenario.durationTicks) setRunning(false);
          setState(next);
        }),
      180
    );
    return () => window.clearInterval(timer);
  }, [running, scenario, strategy]);
  const reset = () => {
    setRunning(false);
    void runtime.current.start({ scenario, strategy }).then(setState);
  };
  function selectScenario(nextScenarioId: ScenarioId) {
    setRunning(false);
    setScenarioId(nextScenarioId);
    void runtime.current
      .start({ scenario: SCENARIOS[nextScenarioId], strategy })
      .then(setState);
  }
  function update<K extends keyof StrategyConfig>(key: K, value: number) {
    if (!running) {
      const next = { ...strategy, [key]: value };
      setStrategy(next);
      void runtime.current.start({ scenario, strategy: next }).then(setState);
    }
  }
  function startOrResume() {
    if (state.tick === 0) {
      void runtime.current.start({ scenario, strategy }).then(setState);
    }
    setRunning((value) => !value);
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_240px]">
      <aside className="rounded-2xl border border-white/10 bg-[#12151d]/90 p-5">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#14f195]">
          Strategy
        </p>
        <h2 className="mt-2 text-xl font-semibold">Quote controls</h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Set a two-sided SOL/USDC market-making strategy. All balances and
          fills are simulated.
        </p>
        <label className="mt-6 block text-xs font-medium text-white/70">
          Challenge
          <select
            value={scenarioId}
            disabled={running}
            onChange={(event) =>
              selectScenario(event.target.value as ScenarioId)
            }
            className="mt-2 w-full rounded-lg border border-white/10 bg-[#1a1f2b] px-3 py-2.5 text-sm disabled:opacity-50"
          >
            {Object.values(SCENARIOS).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
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
            className="flex-1 rounded-lg bg-[#14f195] px-3 py-2.5 text-sm font-bold text-[#07120e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running
              ? "Pause"
              : finished
                ? "Complete"
                : state.tick
                  ? "Resume"
                  : "Start simulation"}
          </button>
          <button
            onClick={reset}
            className="rounded-lg border border-white/15 px-3 py-2.5 text-sm text-white/75"
          >
            Reset
          </button>
        </div>
      </aside>
      <div className="min-w-0 rounded-2xl border border-white/10 bg-[#12151d]/90 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#a17aff]">
              Live simulation · {scenario.name}
            </p>
            <h2 className="mt-2 text-2xl font-semibold">SOL/USDC market lab</h2>
          </div>
          <div className="rounded-full border border-[#14f195]/25 bg-[#14f195]/10 px-3 py-1.5 text-xs font-medium text-[#79ffc3]">
            SIMULATED · LOCAL FALLBACK
          </div>
        </div>
        <div className="mt-8 rounded-xl border border-white/10 bg-[#0b0e14] p-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-white/45">Reference price</p>
              <p className="mt-1 font-mono text-4xl font-semibold">
                {money(state.referencePriceCents)}
              </p>
            </div>
            <p className="font-mono text-sm text-white/45">
              Tick {state.tick}/{scenario.durationTicks}
            </p>
          </div>
          <div className="relative mt-10 h-40 overflow-hidden rounded-lg bg-[linear-gradient(180deg,rgba(161,122,255,.10),transparent)]">
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/15" />
            <div
              className="absolute inset-x-0 bottom-6 h-px bg-[#14f195] shadow-[0_0_14px_2px_rgba(20,241,149,.5)]"
              style={{
                transform: `translateY(${-Math.min(70, Math.max(-70, (state.referencePriceCents - scenario.startingPriceCents) / 5))}px)`,
              }}
            />
            {scenario.events.map((event) => (
              <div
                key={event.tick}
                className="absolute top-3 h-[118px] border-l border-dashed border-[#a17aff]/60"
                style={{
                  left: `${(event.tick / scenario.durationTicks) * 100}%`,
                }}
              >
                <span className="ml-2 whitespace-nowrap text-[10px] text-[#c7b5ff]">
                  {event.label}
                </span>
              </div>
            ))}
            <div className="absolute bottom-2 left-2 text-[11px] text-white/35">
              Your bid {money(state.bidCents)}
            </div>
            <div className="absolute bottom-2 right-2 text-[11px] text-white/35">
              Your ask {money(state.askCents)}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric
            label="Bid / Ask"
            value={`${money(state.bidCents)} / ${money(state.askCents)}`}
          />
          <Metric label="Fills" value={String(state.fills.length)} />
          <Metric
            label="Inventory"
            value={`${(state.baseMilliSol / 1000).toFixed(1)} SOL`}
          />
          <Metric
            label="Max drawdown"
            value={`${(state.maxDrawdownBps / 100).toFixed(2)}%`}
          />
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-[#0b0e14] p-4">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-white/40">
            What happened
          </p>
          <div className="mt-3 space-y-2">
            {state.activity
              .slice()
              .reverse()
              .slice(0, 4)
              .map((item, index) => (
                <p className="text-sm text-white/65" key={`${item}-${index}`}>
                  {item}
                </p>
              ))}
          </div>
        </div>
      </div>
      <aside className="rounded-2xl border border-white/10 bg-[#12151d]/90 p-5">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#14f195]">
          Session metrics
        </p>
        <div className="mt-5 space-y-5">
          <div>
            <p className="text-xs text-white/45">Net simulated P&L</p>
            <p
              className={`mt-1 font-mono text-2xl font-semibold ${pnlCents >= 0 ? "text-[#79ffc3]" : "text-[#ff8790]"}`}
            >
              {pnlCents >= 0 ? "+" : ""}
              {money(pnlCents)}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/45">Current score</p>
            <p className="mt-1 font-mono text-3xl font-semibold">
              {breakdown.total.toLocaleString()}
              <span className="text-sm font-normal text-white/40">
                {" "}
                / 10,000
              </span>
            </p>
          </div>
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs text-white/45">Score quality</p>
            <div className="mt-3 space-y-2 text-xs text-white/65">
              <ScoreRow label="Liquidity" value={breakdown.liquidity} />
              <ScoreRow label="Spread" value={breakdown.spreadEfficiency} />
              <ScoreRow label="Inventory" value={breakdown.inventoryControl} />
              <ScoreRow label="Drawdown" value={breakdown.drawdownControl} />
            </div>
          </div>
          {finished && (
            <button
              disabled
              className="w-full rounded-lg border border-[#a17aff]/40 bg-[#a17aff]/10 px-3 py-2.5 text-sm font-medium text-[#d4c8ff]"
            >
              Connect wallet to verify
            </button>
          )}
        </div>
      </aside>
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
      <span className="flex justify-between text-xs font-medium text-white/70">
        <span>{label}</span>
        <span className="font-mono text-[#79ffc3]">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-[#14f195] disabled:opacity-50"
      />
    </label>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[.03] p-3">
      <p className="text-[11px] uppercase tracking-wide text-white/40">
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-sm text-white/85">{value}</p>
    </div>
  );
}
function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/10">
        <div
          className="h-full rounded bg-[#a17aff]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
