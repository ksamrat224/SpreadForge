import { address, type TransactionSigner } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  parseAdvanceSessionInstruction,
  parseDelegateSessionInstruction,
  parseInitializeSessionInstruction,
} from "../../generated/result_registry";
import {
  createSimulation,
  DEFAULT_STRATEGY,
  SCENARIOS,
  stepSimulation,
} from "../simulation";
import {
  buildSessionAdvanceInstruction,
  buildSessionStartPlan,
  canonicalizeSessionState,
  createSessionExpiry,
} from "./session";

const PROGRAM_ADDRESS = address("8g3EVLPext6Ys4fg75ywroxsWNPBrUHTVC1svTRV2XfV");
const AUTHORITY = {
  address: "11111111111111111111111111111111",
} as unknown as TransactionSigner;
const SESSION_SIGNER = address("SysvarC1ock11111111111111111111111111111111");

describe("MagicBlock session planning", () => {
  it("produces base initialization and delegation instructions for one bounded session", async () => {
    const plan = await buildSessionStartPlan({
      authority: AUTHORITY,
      sessionSigner: SESSION_SIGNER,
      session: {
        scenario: SCENARIOS["stable-market"],
        strategy: DEFAULT_STRATEGY,
      },
      programAddress: PROGRAM_ADDRESS,
      runNonce: 7n,
      expiresAt: 2_000_000_000,
    });

    const initialized = parseInitializeSessionInstruction(
      plan.initializeInstruction
    );
    const delegated = parseDelegateSessionInstruction(plan.delegateInstruction);

    expect(initialized.accounts.session.address).toBe(plan.sessionAddress);
    expect(initialized.data.durationTicks).toBe(
      SCENARIOS["stable-market"].durationTicks
    );
    expect(delegated.accounts.session.address).toBe(plan.sessionAddress);
    expect(delegated.accounts.ownerProgram.address).toBe(PROGRAM_ADDRESS);
    expect(plan.initialStateHash).toHaveLength(64);
  });

  it("hashes each deterministic tick and refuses an out-of-scope tick", async () => {
    const plan = await buildSessionStartPlan({
      authority: AUTHORITY,
      sessionSigner: SESSION_SIGNER,
      session: {
        scenario: SCENARIOS["stable-market"],
        strategy: DEFAULT_STRATEGY,
      },
      programAddress: PROGRAM_ADDRESS,
      runNonce: 8n,
      expiresAt: 2_000_000_000,
    });
    const scenario = SCENARIOS["stable-market"];
    const state = stepSimulation(
      createSimulation(scenario, DEFAULT_STRATEGY),
      scenario,
      DEFAULT_STRATEGY
    );
    const instruction = await buildSessionAdvanceInstruction({
      actor: AUTHORITY,
      sessionAddress: plan.sessionAddress,
      state,
      programAddress: PROGRAM_ADDRESS,
    });
    expect(parseAdvanceSessionInstruction(instruction).data.tick).toBe(1);
    expect(canonicalizeSessionState(state)).toContain('"tick":1');
    await expect(
      buildSessionAdvanceInstruction({
        actor: AUTHORITY,
        sessionAddress: plan.sessionAddress,
        state: { ...state, tick: 61 },
        programAddress: PROGRAM_ADDRESS,
      })
    ).rejects.toThrow(/tick/);
  });

  it("creates a positive deterministic expiry from an explicit clock", () => {
    expect(createSessionExpiry(1_000, 300)).toBe(1_300);
    expect(() => createSessionExpiry(1_000, 0)).toThrow(/positive/);
  });
});
