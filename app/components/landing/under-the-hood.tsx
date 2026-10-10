"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBolt,
  IconShieldCheck,
  IconWallet,
} from "@tabler/icons-react";
import AnimatedContent from "../reactbits/AnimatedContent";
import DecryptedText from "../reactbits/DecryptedText";
import {
  createResultCommitment,
  type ResultCommitment,
} from "../../lib/results/commitment";
import { REPLAY_RUN, ReplayTerminal } from "./replay-terminal";
import { usd } from "./scenario-runs";

const run = REPLAY_RUN;
const steps = [
  { Icon: IconWallet, title: "Delegate", detail: "Scoped session PDA" },
  { Icon: IconBolt, title: "Execute", detail: "Ephemeral Rollup ticks" },
  { Icon: IconShieldCheck, title: "Settle", detail: "Result Registry PDA" },
];
const stats = [
  ["50 ms", "ROLLUP BLOCK TIME"],
  ["0 FEE", "PER ROLLUP TICK"],
  ["164 B", "ON-CHAIN RESULT"],
];

export function UnderTheHood() {
  const [commitment, setCommitment] = useState<ResultCommitment | null>(null);
  useEffect(() => {
    createResultCommitment(run).then(setCommitment, () => setCommitment(null));
  }, []);

  return (
    <section id="magicblock" className="landing-section landing-rule">
      <div className="landing-container">
        <div className="landing-hood">
          <div>
            <p className="landing-eyebrow">UNDER THE HOOD / MAGICBLOCK</p>
            <h2 className="landing-h2 landing-hood-title">
              <span>Fast decisions.</span>
              <span>Lasting proof.</span>
            </h2>
            <p className="landing-hood-lede">
              Sessions are built to run on a MagicBlock Ephemeral Rollup, where
              ticks are fast and free, then settle one compact, hashed result on
              Solana.
            </p>
            <Link href="/app" className="landing-link">
              Explore the architecture
              <IconArrowRight size={16} />
            </Link>
            <dl className="landing-hood-stats">
              {stats.map(([value, label]) => (
                <div key={label}>
                  <dt>{value}</dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <AnimatedContent distance={40} threshold={0.15}>
            <div className="landing-panel landing-sandbox">
              <div className="landing-sandbox-head">
                <span>
                  <i className="landing-dot" aria-hidden="true" />
                  SEEDED REPLAY · {run.scenario.name.toUpperCase()}
                </span>
                <span>
                  SOL / USDC · {usd(run.state.priceHistoryCents.at(-1) ?? 0)}
                </span>
              </div>
              <div className="landing-sandbox-body">
                <ReplayTerminal />
              </div>
              <ol className="landing-sandbox-steps">
                {steps.map(({ Icon, title, detail }) => (
                  <li key={title}>
                    <Icon size={18} />
                    <span>
                      <b>{title}</b>
                      <small>{detail}</small>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="landing-sandbox-foot">
                <span className="mono text-[10px] tracking-[0.12em] text-muted-foreground">
                  SCORE {run.score.total.toLocaleString("en-US")} ·{" "}
                  {run.state.fills.length} FILLS · SIMULATED BALANCES
                </span>
                <Link href="/app" className="landing-link">
                  Open full lab
                  <IconArrowRight size={16} />
                </Link>
              </div>
            </div>
          </AnimatedContent>
        </div>

        <div className="landing-proof">
          <div className="landing-panel landing-proof-card">
            <p className="landing-eyebrow">
              RESULT COMMITMENT / {run.scenario.name.toUpperCase()}
            </p>
            <p className="landing-proof-note">
              Computed in your browser just now from the scenario, strategy and
              final state.
            </p>
            <dl className="landing-hashes">
              {(
                [
                  ["scenario_hash", commitment?.scenarioHash],
                  ["strategy_hash", commitment?.strategyHash],
                  ["result_hash", commitment?.resultHash],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="mono">{label}</dt>
                  <dd className="mono" title={value}>
                    {value ? (
                      <DecryptedText
                        text={`${value.slice(0, 16)}…${value.slice(-8)}`}
                        animateOn="view"
                        sequential
                        speed={18}
                        revealDirection="start"
                        characters="0123456789abcdef"
                        encryptedClassName="text-muted-foreground"
                      />
                    ) : (
                      <span className="text-muted-foreground">hashing…</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="landing-honesty landing-proof-card">
            <IconAlertTriangle
              size={20}
              className="text-[color:var(--warning)]"
            />
            <h3>Honest about what is proven</h3>
            <p>
              Results are <b>wallet-committed</b>, never Solana-computed. Anyone
              can re-run the deterministic simulation from the committed inputs
              and compare the hashes.
            </p>
            <p>
              The MagicBlock session path is built and tested, with its devnet
              rollout in progress. Balances, fills and P&L are always simulated.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
