"use client";
import { useEffect, useState } from "react";
import {
  IconWallet,
  IconKey,
  IconBolt,
  IconArrowsExchange,
  IconDatabase,
  IconAlertTriangle,
} from "@tabler/icons-react";
import AnimatedContent from "../reactbits/AnimatedContent";
import DecryptedText from "../reactbits/DecryptedText";
import SpotlightCard from "../reactbits/SpotlightCard";
import { SectionHeading } from "./section-heading";
import { SCENARIO_RUNS } from "./scenario-runs";
import {
  createResultCommitment,
  type ResultCommitment,
} from "../../lib/results/commitment";

const flow = [
  {
    Icon: IconWallet,
    title: "Wallet",
    body: "You authorise a session with any Wallet Standard wallet on devnet.",
  },
  {
    Icon: IconKey,
    title: "Scoped session",
    body: "A bounded session PDA is delegated with an in-memory, scoped signer.",
  },
  {
    Icon: IconBolt,
    title: "Ephemeral Rollup",
    body: "High-frequency session updates execute on a MagicBlock ER found through the router.",
  },
  {
    Icon: IconArrowsExchange,
    title: "Commit & undelegate",
    body: "The final state commits back and the account returns to the base layer.",
  },
  {
    Icon: IconDatabase,
    title: "Result Registry",
    body: "A 164-byte immutable PDA stores the hashes, score, P&L, drawdown and fills.",
  },
];

const run = SCENARIO_RUNS["whale-sell"];

export function Verification() {
  const [commitment, setCommitment] = useState<ResultCommitment | null>(null);
  useEffect(() => {
    createResultCommitment(run).then(setCommitment, () => setCommitment(null));
  }, []);

  return (
    <section id="verify" className="landing-section">
      <div className="landing-container">
        <SectionHeading
          align="center"
          eyebrow="SOLANA + MAGICBLOCK"
          title="Fast by design. Verifiable by default."
          description="Execution happens where it is fast. Only a compact, hashed summary is written where it is permanent."
        />

        <ol className="landing-flow mt-16">
          {flow.map(({ Icon, title, body }, i) => (
            <li key={title} className="h-full">
              <AnimatedContent
                distance={40}
                delay={i * 0.12}
                threshold={0.15}
                className="h-full"
              >
                <div className="landing-flow-item">
                  <span className="landing-flow-icon">
                    <Icon size={22} />
                  </span>
                  <span className="mono text-[10px] tracking-[0.18em] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </AnimatedContent>
            </li>
          ))}
        </ol>

        <div className="mt-14 grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          <AnimatedContent distance={40} threshold={0.15}>
            <SpotlightCard
              spotlightColor="#2de2b0"
              intensity={0.12}
              className="landing-spot h-full"
            >
              <p className="mono text-[11px] tracking-[0.18em] text-primary">
                RESULT COMMITMENT · {run.scenario.name.toUpperCase()} · DEFAULT
                STRATEGY
              </p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Computed in your browser just now from the canonical scenario,
                strategy and final state.
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
                    <dd className="mono">
                      {value ? (
                        <DecryptedText
                          text={value}
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
              <p className="mono mt-5 text-[11px] text-muted-foreground">
                PDA seeds: [&quot;result&quot;, authority, scenario_hash,
                run_nonce]
              </p>
            </SpotlightCard>
          </AnimatedContent>

          <AnimatedContent distance={40} delay={0.12} threshold={0.15}>
            <div className="landing-honesty h-full">
              <IconAlertTriangle
                size={20}
                className="text-[color:var(--warning)]"
              />
              <h3>Honest about what is proven</h3>
              <p>
                The registry is a durable, wallet-owned commitment layer, not an
                on-chain replay engine. Anyone can re-run the deterministic
                simulation from the committed inputs and compare hashes, but
                leaderboard entries are always labelled{" "}
                <b>wallet-committed simulation results</b>, never
                Solana-computed scores.
              </p>
              <p>
                Balances, fills and P&L are simulated. SpreadForge never trades,
                swaps or custodies real assets. Faucet SOL is used only for
                devnet fees.
              </p>
            </div>
          </AnimatedContent>
        </div>
      </div>
    </section>
  );
}
