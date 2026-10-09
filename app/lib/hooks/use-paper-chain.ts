"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccountRole,
  createSolanaRpc,
  type Address,
  type Instruction,
} from "@solana/kit";
import {
  findPaperPda,
  getDelegatePaperAccountInstructionAsync,
  getOpenPaperAccountInstruction,
  getPaperTradeInstruction,
  getSettlePaperAccountInstruction,
} from "../../generated/result_registry";
import { useCluster } from "../../components/cluster-context";
import { useWallet } from "../wallet/context";
import { useSendTransaction } from "./use-send-transaction";
import { getClusterUrl } from "../solana-client";
import { getMagicBlockConfig } from "../magicblock/config";
import { getDelegationStatus } from "../magicblock/router";
import {
  canSignForRollup,
  DELEGATION_PROGRAM_ADDRESS,
  describeProgramError,
  PAPER_FUNDING,
  PAPER_SIDE,
  PAPER_SOURCE,
  paperAccountToSnapshot,
  paperAssetIndex,
  pickValidator,
  readPaperAccount,
  sendWalletSignedToRollup,
  waitFor,
} from "../magicblock/paper-account";
import { getResultRegistryProgramAddress } from "../results/registry";
import type {
  PaperAsset,
  PaperChainSnapshot,
  Side,
  Trade,
} from "../simulation/paper";

export type PaperChainStatus =
  | "unavailable"
  | "disconnected"
  | "loading"
  | "none"
  | "settled"
  | "delegated"
  | "error";

export type PaperChainState = {
  status: PaperChainStatus;
  address: Address | null;
  nonce: bigint | null;
  erEndpoint: string | null;
  snapshot: PaperChainSnapshot | null;
  busy: string | null;
  error: string | null;
  /** Latest wallet-signed transaction, and the ER that ran it if not devnet. */
  lastSignature: { signature: string; erEndpoint: string | null } | null;
};

export type PaperChainTrade = {
  asset: PaperAsset;
  side: Side;
  source: Trade["source"];
  priceCents: number;
  sizeMilliAsset: number;
  priceAtMs: number;
};

const INITIAL: PaperChainState = {
  status: "unavailable",
  address: null,
  nonce: null,
  erEndpoint: null,
  snapshot: null,
  busy: null,
  error: null,
  lastSignature: null,
};
const NONCE_PAGE = 10;

/**
 * Wallet-owned on-chain paper account. The wallet signs every transaction:
 * opening and delegation on devnet, each trade on the MagicBlock Ephemeral
 * Rollup, and settlement back to devnet.
 */
export function usePaperChain(enabled: boolean) {
  const { cluster } = useCluster();
  const { wallet, signer } = useWallet();
  const { send } = useSendTransaction();
  const programAddress = getResultRegistryProgramAddress();
  const magicBlock = getMagicBlockConfig();
  const baseUrl = getClusterUrl(cluster);
  const authority = wallet?.account.address ?? null;
  const supported =
    cluster === "devnet" && !!programAddress && magicBlock.enabled;
  const [state, setState] = useState<PaperChainState>(INITIAL);
  const generation = useRef(0);

  const unavailableReason = !programAddress
    ? "Set NEXT_PUBLIC_RESULT_REGISTRY_PROGRAM_ID to the deployed registry."
    : !magicBlock.enabled
      ? "Set NEXT_PUBLIC_MAGICBLOCK_ENABLED=true to trade on MagicBlock."
      : cluster !== "devnet"
        ? "On-chain paper trading runs on devnet. Switch the cluster to devnet."
        : !authority || !signer
          ? "Connect a devnet wallet to open an on-chain paper account."
          : !canSignForRollup(signer)
            ? "This wallet can only sign-and-send. MagicBlock trades need a wallet that supports signTransaction."
            : null;

  /** Reads the account from wherever it currently lives. */
  const load = useCallback(
    async (address: Address) => {
      const base = await readPaperAccount(baseUrl, address);
      if (!base)
        return { status: "none" as const, erEndpoint: null, snapshot: null };
      if (base.owner === DELEGATION_PROGRAM_ADDRESS) {
        const delegation = await getDelegationStatus(address, magicBlock);
        if (!delegation.isDelegated || !delegation.erEndpoint)
          throw new Error(
            "The paper account is delegated but MagicBlock has not routed it yet."
          );
        const er = await readPaperAccount(delegation.erEndpoint, address);
        if (!er?.account)
          throw new Error("The rollup has not loaded this paper account yet.");
        return {
          status: "delegated" as const,
          erEndpoint: delegation.erEndpoint,
          snapshot: paperAccountToSnapshot(er.account),
        };
      }
      if (!base.account)
        throw new Error("The paper account could not be decoded.");
      return {
        status: "settled" as const,
        erEndpoint: null,
        snapshot: paperAccountToSnapshot(base.account),
      };
    },
    [baseUrl, magicBlock]
  );

  /** Finds this wallet's newest paper account; nonces are opened sequentially. */
  const findLatest = useCallback(async () => {
    if (!authority || !programAddress) return null;
    const rpc = createSolanaRpc(baseUrl);
    let latest: { nonce: bigint; address: Address } | null = null;
    for (let start = 0n; ; start += BigInt(NONCE_PAGE)) {
      const page = await Promise.all(
        Array.from({ length: NONCE_PAGE }, async (_, i) => {
          const nonce = start + BigInt(i);
          const [address] = await findPaperPda(
            { authority, nonce },
            { programAddress }
          );
          return { nonce, address };
        })
      );
      const { value } = await rpc
        .getMultipleAccounts(
          page.map((item) => item.address),
          {
            encoding: "base64",
            dataSlice: { offset: 0, length: 0 },
          }
        )
        .send();
      for (let i = 0; i < page.length; i++) {
        if (!value[i]) return latest;
        latest = page[i];
      }
    }
  }, [authority, baseUrl, programAddress]);

  const refresh = useCallback(async () => {
    const run = ++generation.current;
    if (!enabled) return;
    if (unavailableReason) {
      setState({
        ...INITIAL,
        status: authority ? "unavailable" : "disconnected",
        error: unavailableReason,
      });
      return;
    }
    setState((current) => ({
      ...current,
      status: current.address ? current.status : "loading",
      error: null,
    }));
    try {
      const latest = await findLatest();
      if (run !== generation.current) return;
      if (!latest) {
        setState({ ...INITIAL, status: "none" });
        return;
      }
      const loaded = await load(latest.address);
      if (run !== generation.current) return;
      setState((current) => ({
        ...current,
        ...loaded,
        address: latest.address,
        nonce: latest.nonce,
        error: null,
      }));
    } catch (error) {
      if (run !== generation.current) return;
      setState((current) => ({
        ...current,
        status: "error",
        error: describeProgramError(error),
      }));
    }
  }, [authority, enabled, findLatest, load, unavailableReason]);

  useEffect(() => {
    // Deferred so the first render is not a synchronous state cascade.
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  /**
   * Runs one wallet-approved step, keeping the UI busy until it settles.
   * Resolves to null on success, or to the error message shown to the user.
   */
  const run = useCallback(
    async (
      label: string,
      step: () => Promise<PaperChainState["lastSignature"]>
    ) => {
      setState((current) => ({ ...current, busy: label, error: null }));
      try {
        const signature = await step();
        setState((current) => ({
          ...current,
          busy: null,
          lastSignature: signature ?? current.lastSignature,
        }));
        return null;
      } catch (error) {
        const message = describeProgramError(error);
        setState((current) => ({ ...current, busy: null, error: message }));
        return message;
      }
    },
    []
  );

  const delegateInstruction = useCallback(
    async (nonce: bigint): Promise<Instruction> => {
      const validator = await pickValidator(magicBlock);
      const instruction = await getDelegatePaperAccountInstructionAsync(
        // The program owns the account; the owner slot must be the deployed ID.
        { authority: signer!, ownerProgram: programAddress!, nonce },
        { programAddress: programAddress! }
      );
      return {
        ...instruction,
        accounts: [
          ...instruction.accounts,
          {
            address: validator.identity as Address,
            role: AccountRole.READONLY,
          },
        ],
      };
    },
    [magicBlock, programAddress, signer]
  );

  /** Waits for the router to report delegation, then reloads from the ER. */
  const awaitDelegated = useCallback(
    async (address: Address, nonce: bigint) => {
      const loaded = await waitFor(async () => {
        const result = await load(address);
        return result.status === "delegated" ? result : null;
      }, "Delegation was submitted but MagicBlock has not picked it up yet. Refresh in a moment.");
      setState((current) => ({ ...current, ...loaded, address, nonce }));
    },
    [load]
  );

  const open = useCallback(
    (funding: "fixed" | "wallet", solPriceCents = 0, priceAtMs = 0) =>
      run("Opening paper account", async () => {
        if (!signer || !authority || !programAddress)
          throw new Error(unavailableReason ?? "Unavailable.");
        const latest = await findLatest();
        const nonce = latest ? latest.nonce + 1n : 0n;
        const [address] = await findPaperPda(
          { authority, nonce },
          { programAddress }
        );
        const signature = await send({
          instructions: [
            getOpenPaperAccountInstruction(
              {
                authority: signer,
                paper: address,
                nonce,
                fundingSource: PAPER_FUNDING[funding],
                solPriceCents: BigInt(solPriceCents),
                priceAtMs: BigInt(priceAtMs),
              },
              { programAddress }
            ),
            await delegateInstruction(nonce),
          ],
        });
        await awaitDelegated(address, nonce);
        return { signature, erEndpoint: null };
      }),
    [
      authority,
      awaitDelegated,
      delegateInstruction,
      findLatest,
      programAddress,
      run,
      send,
      signer,
      unavailableReason,
    ]
  );

  const resume = useCallback(
    () =>
      run("Delegating to MagicBlock", async () => {
        if (!state.address || state.nonce === null)
          throw new Error("No paper account to resume.");
        const signature = await send({
          instructions: [await delegateInstruction(state.nonce)],
        });
        await awaitDelegated(state.address, state.nonce);
        return { signature, erEndpoint: null };
      }),
    [awaitDelegated, delegateInstruction, run, send, state.address, state.nonce]
  );

  const trade = useCallback(
    (order: PaperChainTrade) =>
      run("Waiting for wallet approval", async () => {
        if (!signer || !programAddress || !state.address || !state.erEndpoint)
          throw new Error(
            "Delegate the paper account to MagicBlock before trading."
          );
        const signature = await sendWalletSignedToRollup({
          erEndpoint: state.erEndpoint,
          signer,
          instructions: [
            getPaperTradeInstruction(
              {
                authority: signer,
                paper: state.address,
                asset: paperAssetIndex(order.asset),
                side: PAPER_SIDE[order.side],
                source: PAPER_SOURCE[order.source],
                priceCents: BigInt(order.priceCents),
                sizeMilli: BigInt(order.sizeMilliAsset),
                priceAtMs: BigInt(Math.round(order.priceAtMs)),
              },
              { programAddress }
            ),
          ],
        });
        const loaded = await load(state.address);
        setState((current) => ({ ...current, ...loaded }));
        return { signature, erEndpoint: state.erEndpoint };
      }),
    [load, programAddress, run, signer, state.address, state.erEndpoint]
  );

  const settle = useCallback(
    () =>
      run("Settling to devnet", async () => {
        if (!signer || !programAddress || !state.address || !state.erEndpoint)
          throw new Error("The paper account is not delegated.");
        const address = state.address;
        const erEndpoint = state.erEndpoint;
        const signature = await sendWalletSignedToRollup({
          erEndpoint: state.erEndpoint,
          signer,
          instructions: [
            getSettlePaperAccountInstruction(
              { authority: signer, paper: address },
              { programAddress }
            ),
          ],
        });
        // Undelegation lands on devnet asynchronously after the ER commit.
        const loaded = await waitFor(async () => {
          const result = await load(address);
          return result.status === "settled" ? result : null;
        }, "Settlement was committed but devnet has not received it yet. Refresh in a moment.");
        setState((current) => ({ ...current, ...loaded }));
        return { signature, erEndpoint };
      }),
    [load, programAddress, run, signer, state.address, state.erEndpoint]
  );

  return {
    ...(enabled ? state : INITIAL),
    available: enabled && supported && !unavailableReason,
    unavailableReason,
    open,
    resume,
    trade,
    settle,
    refresh,
  };
}
