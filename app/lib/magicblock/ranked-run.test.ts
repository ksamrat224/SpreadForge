import { address, type TransactionSigner } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  parseDelegateRankedRunInstruction,
  parseStartRankedRunInstruction,
} from "../../generated/result_registry";
import { DEFAULT_STRATEGY } from "../simulation";
import {
  buildRankedRunStartPlan,
  RANKED_RUN_SESSION_LAMPORTS,
} from "./ranked-run";

const PROGRAM = address("2EXN7tmfAekEn2Noq8j8AkVx9bTi96zuakHUKSsW4u9w");
const AUTHORITY = {
  address: "11111111111111111111111111111111",
} as unknown as TransactionSigner;

describe("ranked-run MagicBlock start plan", () => {
  it("creates, delegates, and funds one scoped run from a single wallet plan", async () => {
    const plan = await buildRankedRunStartPlan({
      authority: AUTHORITY,
      scenarioId: "whale-sell",
      strategy: DEFAULT_STRATEGY,
      programAddress: PROGRAM,
      runNonce: 42n,
    });
    const start = parseStartRankedRunInstruction(plan.instructions[0]);
    const delegate = parseDelegateRankedRunInstruction(plan.instructions[1]);
    expect(start.accounts.rankedRun.address).toBe(plan.runAddress);
    expect(start.data.sessionSigner).toBe(plan.sessionSigner.address);
    expect(start.data.scenarioId).toBe(1);
    expect(delegate.accounts.rankedRun.address).toBe(plan.runAddress);
    expect(plan.instructions).toHaveLength(3);
    expect(
      new DataView(plan.instructions[2].data!.buffer).getBigUint64(4, true)
    ).toBe(RANKED_RUN_SESSION_LAMPORTS);
  });
});
