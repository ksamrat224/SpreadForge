import { describe, expect, it } from "vitest";
import { rankRecords, startOfUtcWeek } from "./ranking";
import type { CommittedResultRecord } from "./types";

const hash = "a".repeat(64);
const monday = Date.UTC(2026, 8, 21, 0, 0, 0) / 1000;
const record = (overrides: Partial<CommittedResultRecord> = {}): CommittedResultRecord => ({
  address: "record-a",
  authority: "wallet-a",
  scenarioHash: hash,
  totalScore: 5000,
  pnlBps: 120,
  maxDrawdownBps: 40,
  fills: 3,
  schemaVersion: 2,
  submittedAt: monday + 10,
  ...overrides,
});

describe("leaderboard ranking", () => {
  it("starts weeks on Monday at UTC midnight", () => {
    expect(startOfUtcWeek(Date.UTC(2026, 8, 27, 23, 0))).toBe(monday * 1000);
  });

  it("keeps a wallet's best result and applies score, P&L, risk, time, then PDA", () => {
    const rows = rankRecords({
      records: [
        record(),
        record({ address: "record-b", authority: "wallet-b", pnlBps: 130 }),
        record({ address: "record-c", authority: "wallet-a", totalScore: 5100 }),
      ],
      period: "all-time",
      scenarioHashes: { [hash]: "stable-market" },
      cluster: "devnet",
      now: monday * 1000,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ walletAddress: "wallet-a", score: 5100, rank: 1 });
    expect(rows[1]).toMatchObject({ walletAddress: "wallet-b", rank: 2 });
  });

  it("excludes unsupported, legacy, and previous-week records", () => {
    const rows = rankRecords({
      records: [
        record(),
        record({ address: "legacy", schemaVersion: 1 }),
        record({ address: "other", scenarioHash: "b".repeat(64) }),
        record({ address: "old", authority: "wallet-old", submittedAt: monday - 1 }),
      ],
      period: "weekly",
      scenarioHashes: { [hash]: "stable-market" },
      cluster: "devnet",
      now: monday * 1000 + 1000,
    });
    expect(rows.map((row) => row.resultAddress)).toEqual(["record-a"]);
  });
});
