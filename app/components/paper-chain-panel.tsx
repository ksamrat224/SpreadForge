"use client";

import { IconExternalLink, IconInfoCircle } from "@tabler/icons-react";
import { useCluster } from "./cluster-context";
import { InfoTooltip } from "./terminal-ui";
import type { usePaperChain } from "../lib/hooks/use-paper-chain";

type PaperChain = ReturnType<typeof usePaperChain>;
const shortAddress = (value: string) =>
  `${value.slice(0, 4)}…${value.slice(-4)}`;
const STATUS_LABEL: Record<PaperChain["status"], string> = {
  unavailable: "Unavailable",
  disconnected: "Wallet not connected",
  loading: "Loading portfolio…",
  none: "No portfolio yet",
  ready: "Live on devnet",
  error: "Needs attention",
};

/** Wallet-signed devnet portfolio controls. There is no local or ER ledger. */
export function PaperChainPanel({ chain }: { chain: PaperChain }) {
  const { getExplorerUrl } = useCluster();
  const idle = !chain.busy && chain.status !== "loading";
  const signatureUrl = chain.lastSignature
    ? getExplorerUrl(`/tx/${chain.lastSignature.signature}`)
    : null;
  const tone =
    chain.busy || chain.status === "loading" ? "pending" : chain.status;
  // Errors and "why is this unavailable" stay visible; routine notes do not.
  const notice = chain.error ?? chain.unavailableReason;
  return (
    <section
      className="wallet-practice panel"
      aria-label="On-chain paper portfolio"
    >
      <div className="wallet-practice-main">
        <div>
          <p className="eyebrow">DEVNET PAPER PORTFOLIO</p>
          <h2>Trade with virtual $10,000</h2>
        </div>
      </div>
      <div className="wallet-practice-stats">
        <span>
          <small>STATUS</small>
          <b className={`chain-status ${tone}`}>
            <i />
            {chain.busy ?? STATUS_LABEL[chain.status]}
          </b>
        </span>
        <span>
          <small>PORTFOLIO</small>
          <b>
            {chain.address ? (
              <a
                href={getExplorerUrl(`/address/${chain.address}`)}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddress(chain.address)} <IconExternalLink size={12} />
              </a>
            ) : (
              "—"
            )}
          </b>
        </span>
        {chain.status === "none" && (
          <button
            className="btn primary"
            type="button"
            disabled={!chain.available || !idle}
            onClick={() => void chain.open()}
          >
            Open $10,000 portfolio
          </button>
        )}
        {chain.status === "error" && (
          <button
            className="btn"
            type="button"
            onClick={() => void chain.refresh()}
          >
            Retry
          </button>
        )}
        <InfoTooltip label="About the paper portfolio">
          <p className="control-hint">
            Every buy and sell is wallet-approved, priced by a verified oracle,
            and recorded permanently on Solana devnet.
          </p>
          <p className="control-hint">
            {chain.status === "ready"
              ? "Every order opens a devnet wallet approval and updates your on-chain portfolio."
              : "Opening a portfolio is a one-time devnet transaction."}
          </p>
        </InfoTooltip>
      </div>
      {(notice || signatureUrl) && (
        <small
          className="control-hint"
          role={chain.error ? "alert" : undefined}
        >
          {notice && <IconInfoCircle size={14} />}
          <span>
            {notice}
            {signatureUrl && (
              <>
                {notice && " "}
                <a href={signatureUrl} target="_blank" rel="noreferrer">
                  Last transaction <IconExternalLink size={12} />
                </a>
              </>
            )}
          </span>
        </small>
      )}
    </section>
  );
}
