import type { ScenarioId, StrategyConfig } from "../simulation";
import type { ResultCommitment } from "../results/commitment";

export const LEADERBOARD_SCHEMA_VERSION = 2;
export const LOCAL_RUN_LIMIT = 100;

export type LeaderboardPeriod = "all-time" | "weekly";
export type LocalRunStatus = "local" | "submitting" | "committed" | "failed";

export type LocalSimulationRun = {
  id: string;
  completedAt: string;
  scenarioId: ScenarioId;
  scenarioVersion: number;
  strategy: StrategyConfig;
  commitment: ResultCommitment;
  status: LocalRunStatus;
  resultAddress?: string;
  signature?: string;
  error?: string;
};

export type CommittedResultRecord = {
  address: string;
  authority: string;
  scenarioHash: string;
  totalScore: number;
  pnlBps: number;
  maxDrawdownBps: number;
  fills: number;
  schemaVersion: number;
  submittedAt: number;
};

export type LeaderboardEntry = {
  rank: number;
  walletAddress: string;
  score: number;
  pnlBps: number;
  maxDrawdownBps: number;
  fills: number;
  scenarioId: ScenarioId;
  scenarioName: string;
  submittedAt: number;
  resultAddress: string;
  proofUrl: string;
};

export type LeaderboardRepository = {
  listRecords: () => Promise<CommittedResultRecord[]>;
};
