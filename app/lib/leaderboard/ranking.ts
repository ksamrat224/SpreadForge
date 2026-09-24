import { getExplorerUrl } from "../explorer";
import { canonicalizeScenario, hashCanonical } from "../results/commitment";
import { SCENARIOS, type ScenarioId } from "../simulation";
import type { ClusterMoniker } from "../solana-client";
import type { CommittedResultRecord, LeaderboardEntry, LeaderboardPeriod } from "./types";
import { LEADERBOARD_SCHEMA_VERSION } from "./types";

export async function getSupportedScenarioHashes(): Promise<Record<string, ScenarioId>> {
  const pairs = await Promise.all(
    (Object.values(SCENARIOS) as (typeof SCENARIOS)[ScenarioId][]).map(async (scenario) => [
      await hashCanonical(canonicalizeScenario(scenario)),
      scenario.id,
    ] as const)
  );
  return Object.fromEntries(pairs);
}

export function startOfUtcWeek(timestampMs: number) {
  const date = new Date(timestampMs);
  const day = (date.getUTCDay() + 6) % 7;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day);
}

function compare(a: CommittedResultRecord, b: CommittedResultRecord) {
  return b.totalScore - a.totalScore || b.pnlBps - a.pnlBps ||
    a.maxDrawdownBps - b.maxDrawdownBps || a.submittedAt - b.submittedAt ||
    a.address.localeCompare(b.address);
}

export function rankRecords({
  records,
  period,
  scenarioHashes,
  cluster,
  now = Date.now(),
}: {
  records: CommittedResultRecord[];
  period: LeaderboardPeriod;
  scenarioHashes: Record<string, ScenarioId>;
  cluster: ClusterMoniker;
  now?: number;
}): LeaderboardEntry[] {
  const weekStart = startOfUtcWeek(now) / 1000;
  const eligible = records.filter((record) =>
    record.schemaVersion === LEADERBOARD_SCHEMA_VERSION &&
    !!scenarioHashes[record.scenarioHash] &&
    (period === "all-time" || record.submittedAt >= weekStart)
  );
  const best = new Map<string, CommittedResultRecord>();
  for (const record of eligible) {
    const previous = best.get(record.authority);
    if (!previous || compare(record, previous) < 0) best.set(record.authority, record);
  }
  return [...best.values()].sort(compare).map((record, index) => {
    const scenarioId = scenarioHashes[record.scenarioHash];
    return {
      rank: index + 1,
      walletAddress: record.authority,
      score: record.totalScore,
      pnlBps: record.pnlBps,
      maxDrawdownBps: record.maxDrawdownBps,
      fills: record.fills,
      scenarioId,
      scenarioName: SCENARIOS[scenarioId].name,
      submittedAt: record.submittedAt,
      resultAddress: record.address,
      proofUrl: getExplorerUrl(`/address/${record.address}`, cluster),
    };
  });
}
