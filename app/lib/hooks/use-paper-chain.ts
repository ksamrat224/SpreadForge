"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getProgramDerivedAddress, type Address } from "@solana/kit";
import { findPortfolioPda, getOpenPortfolioInstructionAsync, getTradePortfolioInstructionAsync } from "../../generated/result_registry";
import { useCluster } from "../../components/cluster-context";
import { useWallet } from "../wallet/context";
import { useSendTransaction } from "./use-send-transaction";
import { getClusterUrl } from "../solana-client";
import { getResultRegistryProgramAddress } from "../results/registry";
import { describeProgramError, getPythPriceUpdateAddress, paperAccountToSnapshot, paperAssetIndex, PAPER_SIDE, readPaperAccount } from "../magicblock/paper-account";
import type { PaperAsset, PaperChainSnapshot, Side, Trade } from "../simulation/paper";

export type PaperChainStatus = "unavailable" | "disconnected" | "loading" | "none" | "ready" | "error";
export type PaperChainState = { status: PaperChainStatus; address: Address | null; snapshot: PaperChainSnapshot | null; busy: string | null; error: string | null; lastSignature: { signature: string; erEndpoint: string | null } | null; };
export type PaperChainTrade = { asset: PaperAsset; side: Side; source: Trade["source"]; priceCents: number; sizeMilliAsset: number; priceAtMs: number; };
const INITIAL: PaperChainState = { status: "unavailable", address: null, snapshot: null, busy: null, error: null, lastSignature: null };
const DEFAULT_MAX_SLIPPAGE_BPS = 100;

/** Devnet account state is the portfolio ledger; the browser only reads it. */
export function usePaperChain(enabled = true) {
  const { cluster } = useCluster();
  const { wallet, signer } = useWallet();
  const { send } = useSendTransaction();
  const programAddress = getResultRegistryProgramAddress();
  const baseUrl = getClusterUrl(cluster);
  const authority = wallet?.account.address ?? null;
  const [state, setState] = useState<PaperChainState>(INITIAL);
  const generation = useRef(0);
  const unavailableReason = !programAddress ? "Set NEXT_PUBLIC_RESULT_REGISTRY_PROGRAM_ID to the deployed registry." : cluster !== "devnet" ? "Paper trading is available on devnet only." : !authority || !signer ? "Connect a devnet wallet to open your portfolio." : null;

  const portfolioAddress = useCallback(async () => {
    if (!authority || !programAddress) return null;
    const [address] = await findPortfolioPda({ authority }, { programAddress });
    return address;
  }, [authority, programAddress]);
  const refresh = useCallback(async () => {
    const run = ++generation.current;
    if (!enabled || unavailableReason) {
      setState({ ...INITIAL, status: authority ? "unavailable" : "disconnected", error: unavailableReason });
      return;
    }
    setState((current) => ({ ...current, status: current.address ? current.status : "loading", error: null }));
    try {
      const address = await portfolioAddress();
      if (!address) return;
      const account = await readPaperAccount(baseUrl, address);
      if (run !== generation.current) return;
      setState({ ...INITIAL, status: account ? "ready" : "none", address, snapshot: account ? paperAccountToSnapshot(account) : null });
    } catch (error) {
      if (run === generation.current) setState((current) => ({ ...current, status: "error", error: describeProgramError(error) }));
    }
  }, [authority, baseUrl, enabled, portfolioAddress, unavailableReason]);
  useEffect(() => { void refresh(); }, [refresh]);
  const run = useCallback(async (label: string, action: () => Promise<string>) => {
    setState((current) => ({ ...current, busy: label, error: null }));
    try {
      const signature = await action();
      await refresh();
      setState((current) => ({ ...current, busy: null, lastSignature: { signature, erEndpoint: null } }));
      return null;
    } catch (error) {
      const message = describeProgramError(error);
      setState((current) => ({ ...current, busy: null, error: message }));
      return message;
    }
  }, [refresh]);
  const open = useCallback(() => run("Opening $10,000 portfolio", async () => {
    if (!signer || !programAddress) throw new Error(unavailableReason ?? "Unavailable.");
    return send({ instructions: [await getOpenPortfolioInstructionAsync({ authority: signer }, { programAddress })] });
  }), [programAddress, run, send, signer, unavailableReason]);
  const trade = useCallback((order: PaperChainTrade) => run("Waiting for wallet approval", async () => {
    if (!signer || !programAddress || !state.address) throw new Error("Open your portfolio before trading.");
    const priceUpdate = getPythPriceUpdateAddress(order.asset);
    const asset = paperAssetIndex(order.asset);
    const [market] = await getProgramDerivedAddress({ programAddress, seeds: [new TextEncoder().encode("paper-market"), new Uint8Array([asset])] });
    const instruction = await getTradePortfolioInstructionAsync({ authority: signer, portfolio: state.address, market, priceUpdate, asset, side: PAPER_SIDE[order.side], sizeMilli: BigInt(order.sizeMilliAsset), expectedPriceCents: BigInt(order.priceCents), maxSlippageBps: DEFAULT_MAX_SLIPPAGE_BPS }, { programAddress });
    return send({ instructions: [instruction] });
  }), [programAddress, run, send, signer, state.address]);
  return { ...(enabled ? state : INITIAL), available: enabled && !unavailableReason, unavailableReason, open, trade, refresh };
}
