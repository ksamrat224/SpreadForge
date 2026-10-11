import { address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  findRankedRunPda,
  getRankedRunEncoder,
} from "../../generated/result_registry";
import {
  decodeSettledRankedRecord,
  rankSettledRuns,
  type SettledRankedRecord,
} from "./ranked-repository";

const PROGRAM = address("2EXN7tmfAekEn2Noq8j8AkVx9bTi96zuakHUKSsW4u9w");
const WALLET = address("11111111111111111111111111111111");

function encoded(status = 2, tick = 60) {
  return Uint8Array.from(
    getRankedRunEncoder().encode({
      authority: WALLET,
      sessionSigner: WALLET,
      runNonce: 7n,
      expiresAt: 2_000_000_000n,
      startedAt: 1_800_000_000n,
      finalizedAt: 1_800_000_010n,
      scenarioId: 1,
      schemaVersion: 1,
      status,
      bump: 255,
      tick,
      durationTicks: 60,
      spreadBps: 30,
      refreshTicks: 5,
      orderSizeMilli: 1000n,
      maxInventoryMilli: 120_000n,
      referencePriceCents: 15_000n,
      bidCents: 14_977n,
      askCents: 15_023n,
      baseMilli: 100_000n,
      quoteCents: 5_000_000n,
      inventoryCostCents: 1_500_000n,
      realizedPnlCents: 100n,
      equityCents: 6_500_000n,
      startingEquityCents: 6_000_000n,
      peakEquityCents: 6_600_000n,
      maxDrawdownBps: 30,
      fillCount: 8,
      liquidityTicks: 60,
      hasBuyOrder: false,
      hasSellOrder: false,
      finalScore: 8100,
    })
  );
}

describe("settled ranked-run leaderboard", () => {
  it("accepts only program-owned, correct-PDA, complete settled accounts", async () => {
    const [runAddress] = await findRankedRunPda(
      { authority: WALLET, runNonce: 7n },
      { programAddress: PROGRAM }
    );
    const read = (
      data: Uint8Array,
      owner: string = PROGRAM,
      address = runAddress
    ) =>
      decodeSettledRankedRecord({
        data,
        owner,
        address,
        programAddress: PROGRAM,
      });
    expect((await read(encoded()))?.score).toBe(8100);
    expect(await read(encoded(1))).toBeNull();
    expect(await read(encoded(2, 59))).toBeNull();
    expect(await read(encoded(), WALLET)).toBeNull();
    expect(await read(encoded(), PROGRAM, WALLET)).toBeNull();
    const malformed = encoded().slice();
    malformed[0] = 0;
    expect(await read(malformed)).toBeNull();
  });

  it("ranks the best run per wallet and applies the weekly cutoff", () => {
    const base: SettledRankedRecord = {
      address: WALLET,
      authority: WALLET,
      scenarioId: "whale-sell",
      score: 8000,
      equityCents: 6_600_000n,
      startingEquityCents: 6_000_000n,
      maxDrawdownBps: 20,
      fills: 5,
      finalizedAt: 1_800_000_000,
    };
    const other = {
      ...base,
      authority: PROGRAM,
      address: PROGRAM,
      score: 8100,
      finalizedAt: 1_800_000_100,
    };
    const worse = {
      ...base,
      address: address("Vote111111111111111111111111111111111111111"),
      score: 7000,
    };
    const ranked = rankSettledRuns({
      records: [base, worse, other],
      period: "all-time",
    });
    expect(ranked.map((entry) => entry.score)).toEqual([8100, 8000]);
    expect(ranked[1].pnlBps).toBe(1000);
    expect(
      rankSettledRuns({
        records: [base],
        period: "weekly",
        now: 2_000_000_000_000,
      })
    ).toEqual([]);
  });
});
