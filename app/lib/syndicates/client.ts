import { isAddress, type Address, type ReadonlyUint8Array } from "@solana/kit";
import {
  getSyndicateDecoder,
  getSyndicateSize,
  SYNDICATE_DISCRIMINATOR,
} from "../../generated/forge_syndicates";
import { createSolanaClient, type ClusterMoniker } from "../solana-client";

export type SyndicateSummary = {
  address: Address;
  trader: Address;
  vault: Address;
  name: string;
  status: "open" | "live";
  vaultMicro: bigint;
  totalShares: bigint;
  backers: number;
  sessions: number;
  totalFeesMicro: bigint;
  maxDrawdownPercent: number;
};

export function getSyndicatesProgramAddress(): Address | null {
  const configured = process.env.NEXT_PUBLIC_FORGE_SYNDICATES_PROGRAM_ID;
  return configured && isAddress(configured) ? configured : null;
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function sameDiscriminator(bytes: Uint8Array) {
  return SYNDICATE_DISCRIMINATOR.every(
    (value, index) => bytes[index] === value
  );
}

function decodeName(bytes: ReadonlyUint8Array) {
  const end = bytes.indexOf(0);
  return new TextDecoder().decode(bytes.slice(0, end < 0 ? undefined : end));
}

export async function listSyndicates(
  programAddress: Address,
  cluster: ClusterMoniker
): Promise<SyndicateSummary[]> {
  const client = createSolanaClient(cluster);
  const accounts = await client.rpc
    .getProgramAccounts(programAddress, { encoding: "base64" })
    .send();
  const decoder = getSyndicateDecoder();
  const decoded = accounts.flatMap((item) => {
    try {
      const bytes = fromBase64(item.account.data[0]);
      if (
        item.account.owner !== programAddress ||
        bytes.length !== getSyndicateSize() ||
        !sameDiscriminator(bytes)
      )
        return [];
      return [{ address: item.pubkey, data: decoder.decode(bytes) }];
    } catch {
      return [];
    }
  });
  return Promise.all(
    decoded.map(async ({ address, data }) => {
      let vaultMicro = 0n;
      try {
        const balance = await client.rpc
          .getTokenAccountBalance(data.vault)
          .send();
        vaultMicro = BigInt(balance.value.amount);
      } catch {
        // A malformed/unavailable vault must not hide the durable syndicate.
      }
      return {
        address,
        trader: data.trader,
        vault: data.vault,
        name: decodeName(data.name) || "Unnamed syndicate",
        status: data.status === 1 ? ("live" as const) : ("open" as const),
        vaultMicro,
        totalShares: data.totalShares,
        backers: data.backerCount,
        sessions: data.sessionCount,
        totalFeesMicro: data.totalFees,
        maxDrawdownPercent: data.maxDrawdownBps / 100,
      };
    })
  );
}
