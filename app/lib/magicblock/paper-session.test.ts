import { address, type TransactionSigner } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { parseDelegatePaperPortfolioInstruction, parseInitializePaperPortfolioInstruction } from "../../generated/result_registry";
import { buildPaperPortfolioStartPlan, findPaperPortfolioPda } from "./paper-session";

const PROGRAM = address("8g3EVLPext6Ys4fg75ywroxsWNPBrUHTVC1svTRV2XfV");
const AUTHORITY = { address: "11111111111111111111111111111111" } as unknown as TransactionSigner;

describe("private paper-portfolio planning", () => {
  it("derives one wallet portfolio PDA and initializes its memory-only signer", async () => {
    const plan = await buildPaperPortfolioStartPlan({
      authority: AUTHORITY,
      programAddress: PROGRAM,
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    const [expected] = await findPaperPortfolioPda({ authority: AUTHORITY.address, programAddress: PROGRAM });
    const parsed = parseInitializePaperPortfolioInstruction(plan.initializeInstruction);
    const delegated = parseDelegatePaperPortfolioInstruction(plan.delegateInstruction);
    expect(plan.portfolioAddress).toBe(expected);
    expect(parsed.accounts.portfolio.address).toBe(expected);
    expect(parsed.data.sessionSigner).toBe(plan.sessionSigner.address);
    expect(delegated.accounts.portfolio.address).toBe(expected);
  });
});
