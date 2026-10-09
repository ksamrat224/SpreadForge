"use client";

import { IconExternalLink } from "@tabler/icons-react";
import { money } from "./terminal-ui";
import { useCluster } from "./cluster-context";
import { ellipsify } from "../lib/explorer";
import type { usePaperChain } from "../lib/hooks/use-paper-chain";

type PaperChain = ReturnType<typeof usePaperChain>;

const STATUS_LABEL: Record<PaperChain["status"], string> = {
  unavailable: "Unavailable",
  disconnected: "Wallet not connected",
  loading: "Looking up account…",
  none: "No account yet",
  settled: "Settled on devnet",
  delegated: "Live on MagicBlock",
  error: "Needs attention",
};

/**
 * Status and lifecycle controls for the wallet-owned on-chain paper account:
 * open (and delegate), settle back to devnet, or resume on MagicBlock.
 */
export function PaperChainPanel({
  chain,
  canMirrorWallet,
  walletSolLabel,
  solPriceCents,
  onOpen,
}: {
  chain: PaperChain;
  canMirrorWallet: boolean;
  walletSolLabel: string;
  solPriceCents: number | null;
  onOpen: (funding: "fixed" | "wallet") => void;
}) {
  const { getExplorerUrl } = useCluster();
  const idle = !chain.busy && chain.status !== "loading";
  const canOpen = chain.available && idle;
  const signatureUrl = chain.lastSignature
    ? chain.lastSignature.erEndpoint
      ? `https://explorer.solana.com/tx/${chain.lastSignature.signature}?cluster=custom&customUrl=${encodeURIComponent(chain.lastSignature.erEndpoint)}`
      : getExplorerUrl(`/tx/${chain.lastSignature.signature}`)
    : null;

  return (
    <section
      className="wallet-practice panel"
      aria-label="On-chain paper account"
    >
      <div>
        <p className="eyebrow">ON-CHAIN PAPER ACCOUNT · MAGICBLOCK</p>
        <h2>Trade with your connected wallet</h2>
        <p>
          Each trade is a transaction your wallet signs, executed fee-free on a
          MagicBlock Ephemeral Rollup. Balances are simulated and prices are
          wallet-committed references; settling commits the account to devnet.
        </p>
      </div>
      <div className="wallet-practice-stats">
        <span>
          <small>STATUS</small>
          <b>{chain.busy ?? STATUS_LABEL[chain.status]}</b>
        </span>
        <span>
          <small>ACCOUNT</small>
          <b>
            {chain.address ? (
              <a
                href={getExplorerUrl(`/address/${chain.address}`)}
                target="_blank"
                rel="noreferrer"
              >
                {ellipsify(chain.address)} <IconExternalLink size={11} />
              </a>
            ) : (
              "—"
            )}
          </b>
        </span>
        <span>
          <small>ROLLUP</small>
          <b>
            {chain.erEndpoint
              ? new URL(chain.erEndpoint).hostname.split(".")[0]
              : "—"}
          </b>
        </span>
        {chain.status === "delegated" ? (
          <button
            className="btn ghost"
            type="button"
            disabled={!idle}
            onClick={() => void chain.settle()}
          >
            Settle to devnet
          </button>
        ) : chain.status === "settled" ? (
          <button
            className="btn primary"
            type="button"
            disabled={!canOpen}
            onClick={() => void chain.resume()}
          >
            Resume on MagicBlock
          </button>
        ) : null}
        {(chain.status === "none" ||
          chain.status === "settled" ||
          chain.status === "delegated") && (
          <>
            <button
              className={`btn ${chain.status === "none" ? "primary" : "ghost"}`}
              type="button"
              disabled={!canOpen}
              onClick={() => onOpen("fixed")}
            >
              {chain.status === "none"
                ? "Open with 10,000 USDC"
                : "New account · 10,000 USDC"}
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={!canOpen || !canMirrorWallet}
              title={
                solPriceCents
                  ? `Mirrors ${walletSolLabel} at ${money(solPriceCents)}`
                  : "Waiting for a live SOL price"
              }
              onClick={() => onOpen("wallet")}
            >
              Mirror wallet SOL
            </button>
          </>
        )}
        {chain.status === "error" && (
          <button
            className="btn ghost"
            type="button"
            onClick={() => void chain.refresh()}
          >
            Retry
          </button>
        )}
      </div>
      <small className="control-hint" role={chain.error ? "alert" : undefined}>
        {chain.error ??
          chain.unavailableReason ??
          (chain.status === "delegated"
            ? "Every trade opens a wallet approval. Limit quotes that cross the market also ask you to sign the fill."
            : "Opening signs one devnet transaction that creates and delegates the account (≈0.008 SOL rent and a refundable delegation deposit).")}
        {signatureUrl && (
          <>
            {" "}
            <a href={signatureUrl} target="_blank" rel="noreferrer">
              Last transaction <IconExternalLink size={11} />
            </a>
          </>
        )}
      </small>
    </section>
  );
}
