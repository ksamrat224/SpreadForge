import type { Address } from "@solana/kit";
import {
  findRankedRunPda,
  getRankedRunDecoder,
  getRankedRunDiscriminatorBytes,
  getRankedRunSize,
} from "../../generated/result_registry";
import { getExplorerUrl } from "../explorer";
import {
  RANKED_RUN_SCHEMA_VERSION,
  RANKED_RUN_TICKS,
} from "../magicblock/ranked-run";
import { SCENARIOS, type ScenarioId } from "../simulation";
import { createSolanaClient, type ClusterMoniker } from "../solana-client";
import { startOfUtcWeek } from "./ranking";
import type { LeaderboardEntry, LeaderboardPeriod } from "./types";

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export type SettledRankedRecord = {
  address: Address;
  authority: Address;
  scenarioId: ScenarioId;
  score: number;
  equityCents: bigint;
  startingEquityCents: bigint;
  maxDrawdownBps: number;
  fills: number;
  finalizedAt: number;
};

export async function decodeSettledRankedRecord({
  address,
  owner,
  data,
  programAddress,
}: {
  address: Address;
  owner: string;
  data: Uint8Array;
  programAddress: Address;
}): Promise<SettledRankedRecord | null> {
  const discriminator = getRankedRunDiscriminatorBytes();
  if (
    owner !== programAddress ||
    data.length !== getRankedRunSize() ||
    !discriminator.every((byte, index) => data[index] === byte)
  )
    return null;
  try {
    const run = getRankedRunDecoder().decode(data);
    const [expectedAddress] = await findRankedRunPda(
      { authority: run.authority, runNonce: run.runNonce },
      { programAddress }
    );
    if (
      address !== expectedAddress ||
      run.status !== 2 ||
      run.schemaVersion !== RANKED_RUN_SCHEMA_VERSION ||
      run.tick !== RANKED_RUN_TICKS ||
      run.durationTicks !== RANKED_RUN_TICKS ||
      run.finalizedAt <= 0n ||
      run.startedAt <= 0n ||
      run.finalScore > 10_000 ||
      run.startingEquityCents <= 0n ||
      run.finalizedAt > BigInt(Number.MAX_SAFE_INTEGER)
    )
      return null;
    const scenarioId: ScenarioId | undefined = (
      ["stable-market", "whale-sell", "flash-crash"] as const
    )[run.scenarioId];
    if (!scenarioId) return null;
    return {
      address,
      authority: run.authority,
      scenarioId,
      score: run.finalScore,
      equityCents: run.equityCents,
      startingEquityCents: run.startingEquityCents,
      maxDrawdownBps: run.maxDrawdownBps,
      fills: run.fillCount,
      finalizedAt: Number(run.finalizedAt),
    };
  } catch {
    return null;
  }
}

export function rankSettledRuns({
  records,
  period,
  cluster = "devnet",
  now = Date.now(),
}: {
  records: SettledRankedRecord[];
  period: LeaderboardPeriod;
  cluster?: ClusterMoniker;
  now?: number;
}): LeaderboardEntry[] {
  const weekStart = startOfUtcWeek(now) / 1000;
  const eligible = records.filter(
    (record) => period === "all-time" || record.finalizedAt >= weekStart
  );
  const pnlBps = (record: SettledRankedRecord) =>
    Number(
      ((record.equityCents - record.startingEquityCents) * 10_000n) /
        record.startingEquityCents
    );
  const compare = (a: SettledRankedRecord, b: SettledRankedRecord) =>
    b.score - a.score ||
    pnlBps(b) - pnlBps(a) ||
    a.maxDrawdownBps - b.maxDrawdownBps ||
    a.finalizedAt - b.finalizedAt ||
    a.address.localeCompare(b.address);
  const best = new Map<Address, SettledRankedRecord>();
  for (const record of eligible) {
    const previous = best.get(record.authority);
    if (!previous || compare(record, previous) < 0)
      best.set(record.authority, record);
  }
  return [...best.values()].sort(compare).map((record, index) => ({
    rank: index + 1,
    walletAddress: record.authority,
    score: record.score,
    pnlBps: pnlBps(record),
    maxDrawdownBps: record.maxDrawdownBps,
    fills: record.fills,
    scenarioId: record.scenarioId,
    scenarioName: SCENARIOS[record.scenarioId].name,
    submittedAt: record.finalizedAt,
    resultAddress: record.address,
    proofUrl: getExplorerUrl(`/address/${record.address}`, cluster),
  }));
}

export function createRpcRankedRunRepository({
  programAddress,
  cluster = "devnet",
}: {
  programAddress: Address;
  cluster?: ClusterMoniker;
}) {
  return {
    async listSettledRuns(): Promise<SettledRankedRecord[]> {
      const client = createSolanaClient(cluster);
      const accounts = await client.rpc
        .getProgramAccounts(programAddress, { encoding: "base64" })
        .send();
      const decoded = await Promise.all(
        accounts.map((item) => {
          try {
            return decodeSettledRankedRecord({
              address: item.pubkey,
              owner: item.account.owner,
              data: fromBase64(item.account.data[0]),
              programAddress,
            });
          } catch {
            return null;
          }
        })
      );
      return decoded.filter(
        (record): record is SettledRankedRecord => record !== null
      );
    },
  };
}
