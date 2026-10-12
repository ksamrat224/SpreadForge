"use client";

import { useCallback, useEffect, useState } from "react";
import {
  findFusdMintPda,
  getClaimFusdInstructionAsync,
  getCreateSyndicateInstructionAsync,
  getDepositInstructionAsync,
} from "../../generated/forge_syndicates";
import {
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
} from "@solana/kit";
import { useCluster } from "../../components/cluster-context";
import { useWallet } from "../wallet/context";
import { useSendTransaction } from "./use-send-transaction";
import {
  getSyndicatesProgramAddress,
  listSyndicates,
  type SyndicateSummary,
} from "../syndicates/client";

export function useSyndicates(active: boolean) {
  const { cluster } = useCluster();
  const { signer } = useWallet();
  const { send } = useSendTransaction();
  const programAddress = getSyndicatesProgramAddress();
  const [items, setItems] = useState<SyndicateSummary[]>([]);
  const [status, setStatus] = useState<
    "disabled" | "loading" | "ready" | "error"
  >("disabled");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!active || !programAddress || cluster !== "devnet") {
      setStatus("disabled");
      return;
    }
    setStatus("loading");
    try {
      setItems(await listSyndicates(programAddress, cluster));
      setStatus("ready");
      setError(null);
    } catch (reason) {
      setStatus("error");
      setError(
        reason instanceof Error ? reason.message : "Could not read syndicates."
      );
    }
  }, [active, cluster, programAddress]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const claim = useCallback(async () => {
    if (!signer || !programAddress) return "Connect a devnet wallet first.";
    setBusy("Claiming 10,000 fUSD");
    try {
      const [fusdMint] = await findFusdMintPda({ programAddress });
      await send({
        instructions: [
          await getClaimFusdInstructionAsync(
            { authority: signer, fusdMint },
            { programAddress }
          ),
        ],
      });
      await refresh();
      return null;
    } catch (reason) {
      return reason instanceof Error ? reason.message : "fUSD claim failed.";
    } finally {
      setBusy(null);
    }
  }, [programAddress, refresh, send, signer]);

  const create = useCallback(
    async (name: string) => {
      if (!signer || !programAddress) return "Connect a devnet wallet first.";
      const normalized = name.trim();
      if (!normalized || new TextEncoder().encode(normalized).length > 32)
        return "Use a name between 1 and 32 bytes.";
      setBusy("Creating syndicate");
      try {
        const [fusdMint] = await findFusdMintPda({ programAddress });
        const nonce = BigInt(Date.now());
        const encoded = new Uint8Array(32);
        encoded.set(new TextEncoder().encode(normalized));
        await send({
          instructions: [
            await getCreateSyndicateInstructionAsync(
              { trader: signer, fusdMint, nonce, name: encoded },
              { programAddress }
            ),
          ],
        });
        await refresh();
        return null;
      } catch (reason) {
        return reason instanceof Error
          ? reason.message
          : "Syndicate creation failed.";
      } finally {
        setBusy(null);
      }
    },
    [programAddress, refresh, send, signer]
  );

  const deposit = useCallback(
    async (syndicate: SyndicateSummary, amountMicro: bigint) => {
      if (!signer || !programAddress) return "Connect a devnet wallet first.";
      if (amountMicro <= 0n) return "Enter an amount greater than zero.";
      setBusy(`Backing ${syndicate.name}`);
      try {
        const [fusdMint] = await findFusdMintPda({ programAddress });
        const tokenProgram = address(
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        );
        const encodeAddress = getAddressEncoder();
        const [depositorAta] = await getProgramDerivedAddress({
          programAddress: address(
            "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
          ),
          seeds: [
            encodeAddress.encode(signer.address),
            encodeAddress.encode(tokenProgram),
            encodeAddress.encode(fusdMint),
          ],
        });
        await send({
          instructions: [
            await getDepositInstructionAsync(
              {
                depositor: signer,
                syndicate: syndicate.address,
                depositorAta,
                vault: syndicate.vault,
                amount: amountMicro,
              },
              { programAddress }
            ),
          ],
        });
        await refresh();
        return null;
      } catch (reason) {
        return reason instanceof Error ? reason.message : "Deposit failed.";
      } finally {
        setBusy(null);
      }
    },
    [programAddress, refresh, send, signer]
  );

  return {
    programAddress,
    items,
    status,
    error,
    busy,
    refresh,
    claim,
    create,
    deposit,
  };
}
