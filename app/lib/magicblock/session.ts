import {
  generateKeyPairSigner,
  type Address,
  type KeyPairSigner,
  type TransactionSigner,
} from "@solana/kit";
import {
  findSessionPda,
  getAdvanceSessionInstruction,
  getDelegateSessionInstructionAsync,
  getFinalizeSessionInstruction,
  getInitializeSessionInstruction,
} from "../../generated/result_registry";
import {
  hashCanonical,
  canonicalizeScenario,
  canonicalizeStrategy,
} from "../results/commitment";
import { createRunNonce, hexToBytes } from "../results/registry";
import { createSimulation } from "../simulation/engine";
import type { SimulationSession } from "../simulation/runtime";
import type { SimulationState } from "../simulation/types";

export const SESSION_SCHEMA_VERSION = 1;
export const MAX_SESSION_TICKS = 60;
export const DEFAULT_SESSION_TTL_SECONDS = 5 * 60;

export type SessionStartPlan = {
  sessionAddress: Address;
  runNonce: bigint;
  scenarioHash: string;
  strategyHash: string;
  initialStateHash: string;
  initializeInstruction: ReturnType<typeof getInitializeSessionInstruction>;
  delegateInstruction: Awaited<
    ReturnType<typeof getDelegateSessionInstructionAsync>
  >;
};

/**
 * Creates an application-scoped signer whose non-extractable private key stays
 * only in the current browser memory. It is never placed in localStorage or
 * sent to a server. The Result Registry constrains this signer to one session
 * PDA, the supported session instructions, its expiry, and 60 ticks or fewer.
 */
export async function createInMemorySessionSigner(): Promise<KeyPairSigner> {
  return generateKeyPairSigner(false);
}

/** Builds the two wallet-authorized base-layer instructions for a session. */
export async function buildSessionStartPlan({
  authority,
  sessionSigner,
  session,
  programAddress,
  runNonce = createRunNonce(),
  expiresAt = createSessionExpiry(),
}: {
  authority: TransactionSigner;
  sessionSigner: Address;
  session: SimulationSession;
  programAddress: Address;
  runNonce?: bigint;
  expiresAt?: number;
}): Promise<SessionStartPlan> {
  if (
    !Number.isInteger(session.scenario.durationTicks) ||
    session.scenario.durationTicks < 1 ||
    session.scenario.durationTicks > MAX_SESSION_TICKS
  ) {
    throw new Error(
      `MagicBlock sessions must run between 1 and ${MAX_SESSION_TICKS} ticks.`
    );
  }
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= currentUnixTime()) {
    throw new Error(
      "MagicBlock session expiry must be a future Unix timestamp."
    );
  }

  const initialState = createSimulation(session.scenario, session.strategy);
  const [scenarioHash, strategyHash, initialStateHash] = await Promise.all([
    hashCanonical(canonicalizeScenario(session.scenario)),
    hashCanonical(canonicalizeStrategy(session.strategy)),
    hashCanonical(canonicalizeSessionState(initialState)),
  ]);
  const [sessionAddress] = await findSessionPda(
    { authority: authority.address, runNonce },
    { programAddress }
  );

  const initializeInstruction = getInitializeSessionInstruction(
    {
      authority,
      session: sessionAddress,
      scenarioHash: hexToBytes(scenarioHash),
      strategyHash: hexToBytes(strategyHash),
      initialStateHash: hexToBytes(initialStateHash),
      sessionSigner,
      durationTicks: session.scenario.durationTicks,
      expiresAt,
      schemaVersion: SESSION_SCHEMA_VERSION,
      runNonce,
    },
    { programAddress }
  );
  const delegateInstruction = await getDelegateSessionInstructionAsync(
    {
      authority,
      session: sessionAddress,
      // Codama's static default is the source build ID. Deployment uses the
      // configured program ID for both the instruction and owner-program slot.
      ownerProgram: programAddress,
      runNonce,
    },
    { programAddress }
  );

  return {
    sessionAddress,
    runNonce,
    scenarioHash,
    strategyHash,
    initialStateHash,
    initializeInstruction,
    delegateInstruction,
  };
}

/** Builds one ER-routed tick instruction signed by the in-memory session key. */
export async function buildSessionAdvanceInstruction({
  actor,
  sessionAddress,
  state,
  programAddress,
}: {
  actor: TransactionSigner;
  sessionAddress: Address;
  state: SimulationState;
  programAddress: Address;
}): Promise<ReturnType<typeof getAdvanceSessionInstruction>> {
  if (state.tick < 1 || state.tick > MAX_SESSION_TICKS) {
    throw new Error(
      `MagicBlock session tick must be between 1 and ${MAX_SESSION_TICKS}.`
    );
  }
  const stateHash = await hashCanonical(canonicalizeSessionState(state));
  return getAdvanceSessionInstruction(
    {
      actor,
      session: sessionAddress,
      tick: state.tick,
      stateHash: hexToBytes(stateHash),
    },
    { programAddress }
  );
}

/** Builds the terminal ER instruction that commits and undelegates the session. */
export function buildSessionFinalizeInstruction({
  actor,
  sessionAddress,
  programAddress,
}: {
  actor: TransactionSigner;
  sessionAddress: Address;
  programAddress: Address;
}): ReturnType<typeof getFinalizeSessionInstruction> {
  return getFinalizeSessionInstruction(
    { actor, session: sessionAddress },
    { programAddress }
  );
}

/**
 * Canonical state is intentionally explicit: it is the sequence committed by
 * the ER account, not a JavaScript object whose property insertion order could
 * differ between callers.
 */
export function canonicalizeSessionState(state: SimulationState): string {
  return JSON.stringify({
    activity: state.activity,
    askCents: state.askCents,
    baseMilliSol: state.baseMilliSol,
    bidCents: state.bidCents,
    equityCents: state.equityCents,
    fills: state.fills.map((fill) => ({
      priceCents: fill.priceCents,
      reason: fill.reason,
      side: fill.side,
      sizeMilliSol: fill.sizeMilliSol,
      tick: fill.tick,
    })),
    inventoryCostCents: state.inventoryCostCents,
    liquidityTicks: state.liquidityTicks,
    maxDrawdownBps: state.maxDrawdownBps,
    openOrders: state.openOrders.map((order) => ({
      createdTick: order.createdTick,
      id: order.id,
      priceCents: order.priceCents,
      side: order.side,
      sizeMilliSol: order.sizeMilliSol,
    })),
    peakEquityCents: state.peakEquityCents,
    priceHistoryCents: state.priceHistoryCents,
    quoteCents: state.quoteCents,
    realizedPnlCents: state.realizedPnlCents,
    referencePriceCents: state.referencePriceCents,
    startingEquityCents: state.startingEquityCents,
    tick: state.tick,
    unrealizedPnlCents: state.unrealizedPnlCents,
  });
}

export function createSessionExpiry(
  now = currentUnixTime(),
  ttlSeconds = DEFAULT_SESSION_TTL_SECONDS
): number {
  if (
    !Number.isSafeInteger(now) ||
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds < 1
  ) {
    throw new Error(
      "MagicBlock session expiry requires positive integer seconds."
    );
  }
  return now + ttlSeconds;
}

function currentUnixTime() {
  return Math.floor(Date.now() / 1000);
}
