import { address, type TransactionSigner } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { parseInitializePaperSessionInstruction } from "../../generated/result_registry";
import { buildPaperSessionStartPlan, findPaperSessionPda } from "./paper-session";

const PROGRAM = address("8g3EVLPext6Ys4fg75ywroxsWNPBrUHTVC1svTRV2XfV");
const AUTHORITY = { address: "11111111111111111111111111111111" } as unknown as TransactionSigner;

describe("private paper-session planning", () => {
  it("derives an isolated paper-session PDA and initializes its memory-only signer", async () => {
    const plan = await buildPaperSessionStartPlan({
      authority: AUTHORITY,
      programAddress: PROGRAM,
      runNonce: 9n,
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    const [expected] = await findPaperSessionPda({ authority: AUTHORITY.address, runNonce: 9n, programAddress: PROGRAM });
    const parsed = parseInitializePaperSessionInstruction(plan.initializeInstruction);
    expect(plan.sessionAddress).toBe(expected);
    expect(parsed.accounts.session.address).toBe(expected);
    expect(parsed.data.sessionSigner).toBe(plan.sessionSigner.address);
    expect(parsed.data.runNonce).toBe(9n);
  });
});
