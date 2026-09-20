"use client";
import { useState } from "react";
import Image from "next/image";
import {
  IconWallet,
  IconCopy,
  IconCheck,
  IconArrowUpRight,
  IconShieldCheck,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useWallet } from "../lib/wallet/context";
import { useBalance } from "../lib/hooks/use-balance";
import { lamportsToSolString } from "../lib/lamports";
import { useCluster } from "./cluster-context";
import { Modal, Metric } from "./terminal-ui";
export function WalletButton() {
  const { connectors, connect, disconnect, wallet, status, error } =
    useWallet();
  const { cluster, getExplorerUrl } = useCluster();
  const balance = useBalance(wallet?.account.address);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const address = wallet?.account.address;
  const connected = status === "connected" && !!address;
  async function copy() {
    try {
      await navigator.clipboard.writeText(address!);
      setCopied(true);
    } catch {
      toast.error("Could not copy address.");
    }
  }
  return (
    <>
      <button
        className={`btn wallet-trigger ${connected ? "" : "primary"}`}
        onClick={() => setOpen(true)}
      >
        {connected ? (
          <>
            <span className="status-dot" />
            <span className="mono">
              {address.slice(0, 4)}…{address.slice(-4)}
            </span>
          </>
        ) : (
          <>
            <IconWallet size={15} />
            Connect
          </>
        )}
      </button>
      {open && (
        <Modal
          title={connected ? "Your wallet" : "Connect a wallet"}
          onClose={() => setOpen(false)}
        >
          {connected ? (
            <>
              <div className="wallet-address">
                <code>{address}</code>
                <button
                  className="icon-button"
                  aria-label="Copy wallet address"
                  onClick={() => void copy()}
                >
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </button>
              </div>
              <div className="wallet-balance">
                <Metric
                  label={`SOL ${cluster.toUpperCase()}`}
                  value={
                    balance.lamports === null
                      ? "Loading…"
                      : `${lamportsToSolString(balance.lamports, 4)} SOL`
                  }
                  detail="Balance on the selected network"
                />
              </div>
              <p className="wallet-intro">
                <IconShieldCheck size={14} style={{ display: "inline" }} />
                Wallet connected. Practice funds are simulated and separate from
                this balance. No delegated session key is active.
              </p>
              <a
                className="btn wide"
                href={getExplorerUrl(`/address/${address}`)}
                target="_blank"
                rel="noopener noreferrer"
              >
                View in explorer
                <IconArrowUpRight size={14} />
              </a>
              <button
                className="btn wide sell"
                style={{ marginTop: 10 }}
                onClick={() => void disconnect()}
              >
                Disconnect wallet
              </button>
            </>
          ) : (
            <>
              <p className="wallet-intro">
                Connect to identify your runs. Your wallet keeps your keys; you
                can practice every challenge without connecting.
              </p>
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  className="wallet-choice"
                  disabled={status === "connecting"}
                  onClick={() => void connect(connector.id)}
                >
                  {connector.icon ? (
                    <Image src={connector.icon} alt="" width={30} height={30} unoptimized />
                  ) : (
                    <span className="wallet-placeholder">
                      {connector.name[0]}
                    </span>
                  )}
                  <strong>{connector.name}</strong>
                  <span className="tag profit">Detected</span>
                </button>
              ))}
              {["Phantom", "Solflare", "Backpack", "Torus"]
                .filter(
                  (name) =>
                    !connectors.some(
                      (c) => c.name.toLowerCase() === name.toLowerCase()
                    )
                )
                .map((name) => (
                  <div key={name} className="wallet-choice">
                    <span className="wallet-placeholder">{name[0]}</span>
                    <strong>{name}</strong>
                    <span className="tag">Not detected</span>
                  </div>
                ))}
              {status === "connecting" && (
                <p role="status" className="control-hint">
                  Requesting approval… Check your wallet.
                </p>
              )}
              {error != null && (
                <p role="alert" className="loss" style={{ marginTop: 14 }}>
                  {error instanceof Error ? error.message : String(error)}
                </p>
              )}
              <p className="control-hint" style={{ marginTop: 20 }}>
                Use a Wallet Standard compatible browser wallet to connect.
              </p>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
