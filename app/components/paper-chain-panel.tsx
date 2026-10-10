"use client";

import { IconExternalLink } from "@tabler/icons-react";
import { useCluster } from "./cluster-context";
import type { usePaperChain } from "../lib/hooks/use-paper-chain";

type PaperChain = ReturnType<typeof usePaperChain>;
const shortAddress = (value: string) => `${value.slice(0, 4)}…${value.slice(-4)}`;
const STATUS_LABEL: Record<PaperChain["status"], string> = {
  unavailable: "Unavailable", disconnected: "Wallet not connected", loading: "Loading portfolio…", none: "No portfolio yet", ready: "Live on devnet", error: "Needs attention",
};

/** Wallet-signed devnet portfolio controls. There is no local or ER ledger. */
export function PaperChainPanel({ chain }: { chain: PaperChain }) {
  const { getExplorerUrl } = useCluster();
  const idle = !chain.busy && chain.status !== "loading";
  const signatureUrl = chain.lastSignature ? getExplorerUrl(`/tx/${chain.lastSignature.signature}`) : null;
  return <section className="wallet-practice panel" aria-label="On-chain paper portfolio">
    <div>
      <p className="eyebrow">DEVNET PAPER PORTFOLIO</p>
      <h2>Trade with virtual $10,000</h2>
      <p>Every buy and sell is wallet-approved, priced by a verified oracle, and recorded permanently on Solana devnet.</p>
    </div>
    <div className="wallet-practice-stats">
      <span><small>STATUS</small><b>{chain.busy ?? STATUS_LABEL[chain.status]}</b></span>
      <span><small>PORTFOLIO</small><b>{chain.address ? <a href={getExplorerUrl(`/address/${chain.address}`)} target="_blank" rel="noreferrer">{shortAddress(chain.address)} <IconExternalLink size={11} /></a> : "—"}</b></span>
      {chain.status === "none" && <button className="btn primary" type="button" disabled={!chain.available || !idle} onClick={() => void chain.open()}>Open $10,000 portfolio</button>}
      {chain.status === "error" && <button className="btn ghost" type="button" onClick={() => void chain.refresh()}>Retry</button>}
    </div>
    <small className="control-hint" role={chain.error ? "alert" : undefined}>{chain.error ?? chain.unavailableReason ?? (chain.status === "ready" ? "Every order opens a devnet wallet approval and updates your on-chain portfolio." : "Opening a portfolio is a one-time devnet transaction.")}{signatureUrl && <> <a href={signatureUrl} target="_blank" rel="noreferrer">Last transaction <IconExternalLink size={11} /></a></>}</small>
  </section>;
}
