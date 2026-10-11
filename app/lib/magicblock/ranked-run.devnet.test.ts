/** Explicitly opt-in devnet smoke test. Never runs in the normal test suite. */
import { readFileSync } from "node:fs";
import { address, createKeyPairSignerFromBytes } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { DEFAULT_STRATEGY } from "../simulation";
import {
  createRpcRankedRunRepository,
  rankSettledRuns,
} from "../leaderboard/ranked-repository";
import {
  executeRankedRun,
  readRankedRun,
  resolveRankedRunEr,
  startAndExecuteRankedRun,
  waitForRankedRunSettlement,
} from "./ranked-run";

const SEND = process.env.RANKED_RUN_SMOKE_SEND === "true";
const RECOVER = process.env.RANKED_RUN_RECOVERY_SEND === "true";
const READ = process.env.RANKED_RUN_LIVE_READ === "true";
const KEYPAIR_PATH = process.env.RANKED_RUN_SMOKE_KEYPAIR;
const PROGRAM = address("2EXN7tmfAekEn2Noq8j8AkVx9bTi96zuakHUKSsW4u9w");

describe("ranked-run devnet smoke", () => {
  it.skipIf(!READ)(
    "finds the settled run in the public strategy leaderboard scan",
    async () => {
      const records = await createRpcRankedRunRepository({
        programAddress: PROGRAM,
      }).listSettledRuns();
      const ranked = rankSettledRuns({ records, period: "all-time" });
      const recovered = ranked.find(
        (entry) =>
          entry.resultAddress === "FArh3eoZhi4y9guFUySLyj7kZivr6bHx2oHpVtcyRpD6"
      );
      const scoped = records.find(
        (record) =>
          record.address === "ERkmWJ2nTQAGBffhP5ctJNcT1PkPzaaPyuUhREL1xmMw"
      );
      expect(recovered?.score).toBe(9425);
      expect(scoped?.score).toBe(9425);
    },
    30_000
  );
  it.skipIf(!SEND || !KEYPAIR_PATH)(
    "wallet start, router, 60 ER ticks, and settled base account",
    async () => {
      if (!KEYPAIR_PATH)
        throw new Error("RANKED_RUN_SMOKE_KEYPAIR is required.");
      const raw = JSON.parse(readFileSync(KEYPAIR_PATH, "utf8")) as number[];
      const authority = await createKeyPairSignerFromBytes(
        Uint8Array.from(raw)
      );
      if (authority.address !== "FcrKifd5HL356zXZ8agnsMSyLdFZgox65Jxe4JTC3avr")
        throw new Error(
          "Smoke keypair does not match the approved devnet fee payer."
        );
      const result = await startAndExecuteRankedRun({
        authority,
        scenarioId: "stable-market",
        strategy: DEFAULT_STRATEGY,
        programAddress: PROGRAM,
        onStage: (stage, runAddress) =>
          process.stdout.write(`${stage}: ${runAddress}\n`),
        onTick: (tick) => {
          if (tick % 10 === 0) process.stdout.write(`ER tick ${tick}/60\n`);
        },
      });
      process.stdout.write(`base start: ${result.startSignature}\n`);
      process.stdout.write(`ER finalize: ${result.finalizeSignature}\n`);
      process.stdout.write(`settled score: ${result.run.finalScore}\n`);
      expect(result.run.authority).toBe(authority.address);
      expect(result.run.status).toBe(2);
      expect(result.run.tick).toBe(60);
      expect(result.run.finalScore).toBeGreaterThan(0);
    },
    300_000
  );

  it.skipIf(!RECOVER || !KEYPAIR_PATH)(
    "wallet owner recovers the already-delegated test run",
    async () => {
      if (!KEYPAIR_PATH)
        throw new Error("RANKED_RUN_SMOKE_KEYPAIR is required.");
      const raw = JSON.parse(readFileSync(KEYPAIR_PATH, "utf8")) as number[];
      const authority = await createKeyPairSignerFromBytes(
        Uint8Array.from(raw)
      );
      if (authority.address !== "FcrKifd5HL356zXZ8agnsMSyLdFZgox65Jxe4JTC3avr")
        throw new Error("Recovery keypair does not match the run owner.");
      const runAddress = address(
        "FArh3eoZhi4y9guFUySLyj7kZivr6bHx2oHpVtcyRpD6"
      );
      const erEndpoint = await resolveRankedRunEr(runAddress);
      const before = await readRankedRun(erEndpoint, runAddress, PROGRAM);
      if (
        !before ||
        before.authority !== authority.address ||
        before.status !== 1
      )
        throw new Error(
          "Recovery target is not this wallet's active delegated run."
        );
      process.stdout.write(
        `Recovering existing run from tick ${before.tick}/60\n`
      );
      await executeRankedRun({
        runAddress,
        sessionSigner: authority,
        erEndpoint,
        programAddress: PROGRAM,
        onTick: (tick) => {
          if (tick % 10 === 0) process.stdout.write(`ER tick ${tick}/60\n`);
        },
      });
      const settled = await waitForRankedRunSettlement({
        runAddress,
        programAddress: PROGRAM,
        authority: authority.address,
        runNonce: before.runNonce,
      });
      process.stdout.write(
        `Recovered and settled score: ${settled.finalScore}\n`
      );
      expect(settled.status).toBe(2);
      expect(settled.tick).toBe(60);
    },
    300_000
  );
});
