import { getResultRecordDecoder, getResultRecordSize } from "../../generated/result_registry";
import { createSolanaClient, type ClusterMoniker } from "../solana-client";
import type { Address } from "@solana/kit";
import type { CommittedResultRecord, LeaderboardRepository } from "./types";

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toHex(value: Uint8Array) {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createRpcLeaderboardRepository({
  programAddress,
  cluster = "devnet",
}: {
  programAddress: string;
  cluster?: ClusterMoniker;
}): LeaderboardRepository {
  return {
    async listRecords() {
      const client = createSolanaClient(cluster);
      const accounts = await client.rpc
        .getProgramAccounts(programAddress as Address, { encoding: "base64" })
        .send();
      return accounts.flatMap((item): CommittedResultRecord[] => {
        try {
          if (item.account.owner !== programAddress) return [];
          const bytes = fromBase64(item.account.data[0]);
          if (bytes.length !== getResultRecordSize()) return [];
          const record = getResultRecordDecoder().decode(bytes);
          return [{
            address: item.pubkey,
            authority: record.authority,
            scenarioHash: toHex(record.scenarioHash as Uint8Array),
            totalScore: record.totalScore,
            pnlBps: record.pnlBps,
            maxDrawdownBps: record.maxDrawdownBps,
            fills: record.fills,
            schemaVersion: record.schemaVersion,
            submittedAt: Number(record.submittedAt),
          }];
        } catch {
          return [];
        }
      });
    },
  };
}
