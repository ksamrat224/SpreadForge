"use client";

import { useState } from "react";
import {
  IconBolt,
  IconCoin,
  IconLock,
  IconPlus,
  IconRefresh,
  IconShieldCheck,
  IconUsersGroup,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useSyndicates } from "../lib/hooks/use-syndicates";
import type { SyndicateSummary } from "../lib/syndicates/client";
import { formatFusd } from "../lib/syndicates/economics";

const short = (value: string) => `${value.slice(0, 4)}…${value.slice(-4)}`;

export function SyndicatesWorkspace({ active = true }: { active?: boolean }) {
  const syndicates = useSyndicates(active);
  const [name, setName] = useState("");
  const [backing, setBacking] = useState<SyndicateSummary | null>(null);
  const [backAmount, setBackAmount] = useState("100");

  async function claim() {
    const error = await syndicates.claim();
    if (error) toast.error(error);
    else toast.success("10,000 practice fUSD claimed on devnet.");
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const error = await syndicates.create(name);
    if (error) toast.error(error);
    else {
      setName("");
      toast.success("Syndicate created on Solana devnet.");
    }
  }

  async function deposit(event: React.FormEvent) {
    event.preventDefault();
    if (!backing) return;
    const amount = Number(backAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid fUSD amount.");
      return;
    }
    const amountMicro = BigInt(Math.round(amount * 1_000_000));
    const error = await syndicates.deposit(backing, amountMicro);
    if (error) toast.error(error);
    else {
      setBacking(null);
      toast.success(`Backed ${backing.name} with ${formatFusd(amountMicro)}.`);
    }
  }

  const unavailable = !syndicates.programAddress;
  return (
    <section
      className="page-shell syndicates-workspace"
      aria-label="Syndicates"
    >
      <div className="workspace-top">
        <span>
          <strong>Back skill, not hype.</strong> · Shared simulated capital with
          verifiable risk.
        </span>
        <span className="tag">MAGICBLOCK ER · DEVNET</span>
      </div>

      <section className="syndicate-hero panel">
        <div>
          <p className="eyebrow">FORGE SYNDICATES</p>
          <h1>Trade together. Settle transparently.</h1>
          <p>
            Back a trader with practice fUSD, watch executed SOL and ETH
            positions live, and share the result after a ten-minute Ephemeral
            Rollup session.
          </p>
          <div className="syndicate-principles">
            <span>
              <IconLock size={14} /> Capital locked on Solana
            </span>
            <span>
              <IconBolt size={14} /> Trades executed on ER
            </span>
            <span>
              <IconShieldCheck size={14} /> Fixed risk limits
            </span>
          </div>
        </div>
        <div className="syndicate-token-card">
          <span className="token-mark">
            <IconCoin size={25} />
          </span>
          <div>
            <small>PRACTICE ASSET</small>
            <strong>Forge USD</strong>
            <em>fUSD · 6 decimals · no real value</em>
          </div>
          <button
            className="btn primary"
            type="button"
            disabled={unavailable || !!syndicates.busy}
            onClick={() => void claim()}
          >
            {syndicates.busy ?? "Claim 10,000 fUSD"}
          </button>
        </div>
      </section>

      {unavailable && (
        <div className="notice" role="status">
          <span>
            Syndicates are implemented but not enabled for this deployment.
            Deploy the dedicated program, initialize fUSD, and set{" "}
            <code>NEXT_PUBLIC_FORGE_SYNDICATES_PROGRAM_ID</code>.
          </span>
        </div>
      )}
      {syndicates.error && (
        <div className="notice" role="alert">
          <span>{syndicates.error}</span>
          <button
            className="btn ghost notice-action"
            onClick={() => void syndicates.refresh()}
          >
            <IconRefresh size={14} /> Retry
          </button>
        </div>
      )}

      <div className="syndicate-layout">
        <section className="panel syndicate-directory">
          <div className="portfolio-section-heading">
            <div>
              <p className="eyebrow">DISCOVER</p>
              <h2>Trading syndicates</h2>
            </div>
            <small>
              {syndicates.items.length} on-chain pool
              {syndicates.items.length === 1 ? "" : "s"}
            </small>
          </div>
          {syndicates.status === "loading" ? (
            <div className="syndicate-empty">
              <span className="status-dot" />
              <p>Reading syndicates from devnet…</p>
            </div>
          ) : syndicates.items.length ? (
            <div className="syndicate-list">
              {syndicates.items.map((item) => (
                <article key={item.address}>
                  <div className="syndicate-identity">
                    <span>
                      <IconUsersGroup size={19} />
                    </span>
                    <div>
                      <strong>{item.name}</strong>
                      <small>Trader {short(item.trader)}</small>
                    </div>
                  </div>
                  <span
                    className={`signal-badge ${item.status === "live" ? "strong-up" : "neutral"}`}
                  >
                    {item.status === "live"
                      ? "LIVE ON ER"
                      : "ACCEPTING BACKERS"}
                  </span>
                  <dl>
                    <div>
                      <dt>CAPITAL</dt>
                      <dd>{formatFusd(item.vaultMicro)}</dd>
                    </div>
                    <div>
                      <dt>BACKERS</dt>
                      <dd>{item.backers}</dd>
                    </div>
                    <div>
                      <dt>SESSIONS</dt>
                      <dd>{item.sessions}</dd>
                    </div>
                    <div>
                      <dt>MAX DRAWDOWN</dt>
                      <dd>{item.maxDrawdownPercent.toFixed(2)}%</dd>
                    </div>
                  </dl>
                  <button
                    className="btn ghost"
                    disabled={item.status === "live" || !!syndicates.busy}
                    onClick={() => setBacking(item)}
                  >
                    {item.status === "live" ? "Session locked" : "Back trader"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="syndicate-empty">
              <IconUsersGroup size={28} />
              <h3>No syndicates yet</h3>
              <p>
                The first trader can create a pool after the devnet program is
                initialized.
              </p>
            </div>
          )}
        </section>

        <aside className="panel syndicate-launcher">
          <div className="portfolio-section-heading">
            <div>
              <p className="eyebrow">TRADER DESK</p>
              <h2>Create a syndicate</h2>
            </div>
          </div>
          <form onSubmit={create}>
            <label className="field">
              <span className="field-label">Syndicate name</span>
              <input
                aria-label="Syndicate name"
                maxLength={32}
                placeholder="e.g. Delta Forge"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <div className="syndicate-terms">
              <span>
                <b>10 min</b>
                <small>SESSION</small>
              </span>
              <span>
                <b>10%</b>
                <small>PERFORMANCE FEE</small>
              </span>
              <span>
                <b>20%</b>
                <small>MAX DRAWDOWN</small>
              </span>
              <span>
                <b>40%</b>
                <small>PER-ASSET CAP</small>
              </span>
            </div>
            <button
              className="btn primary"
              disabled={unavailable || !name.trim() || !!syndicates.busy}
            >
              <IconPlus size={15} /> {syndicates.busy ?? "Create on devnet"}
            </button>
            <p>
              Shares are non-transferable. Deposits stay in a program-controlled
              SPL vault and lock while a session is active.
            </p>
          </form>
        </aside>
      </div>

      {backing && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="dialog syndicate-backing"
            role="dialog"
            aria-modal="true"
            aria-labelledby="back-syndicate-title"
          >
            <p className="eyebrow">TRANSACTION PREVIEW</p>
            <h2 id="back-syndicate-title">Back {backing.name}</h2>
            <p>
              Your practice fUSD moves into this syndicate&apos;s Solana vault.
              You receive non-transferable shares at the current pool rate.
            </p>
            <form onSubmit={deposit}>
              <label className="field">
                <span className="field-label">Amount in fUSD</span>
                <input
                  aria-label="Amount in fUSD"
                  inputMode="decimal"
                  min="0.000001"
                  step="0.000001"
                  value={backAmount}
                  onChange={(event) => setBackAmount(event.target.value)}
                />
              </label>
              <dl>
                <div>
                  <dt>Destination</dt>
                  <dd>{short(backing.vault)}</dd>
                </div>
                <div>
                  <dt>Asset</dt>
                  <dd>Practice fUSD</dd>
                </div>
                <div>
                  <dt>Withdrawal</dt>
                  <dd>Open between sessions</dd>
                </div>
              </dl>
              <div className="action-row">
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => setBacking(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn primary"
                  disabled={!backAmount || !!syndicates.busy}
                >
                  {syndicates.busy ?? "Approve deposit"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <section
        className="syndicate-flow panel"
        aria-label="Syndicate settlement flow"
      >
        {[
          [
            "01",
            "BACK",
            "Deposit practice fUSD and receive proportional internal shares.",
          ],
          [
            "02",
            "TRADE",
            "A scoped signer trades synthetic SOL and ETH through MagicBlock ER.",
          ],
          [
            "03",
            "FREEZE",
            "Risk limits or the ten-minute deadline stop new positions.",
          ],
          [
            "04",
            "SETTLE",
            "The committed result mints or burns fUSD and applies the high-water fee.",
          ],
        ].map(([step, title, body]) => (
          <div key={step}>
            <span>{step}</span>
            <strong>{title}</strong>
            <p>{body}</p>
          </div>
        ))}
      </section>
    </section>
  );
}
