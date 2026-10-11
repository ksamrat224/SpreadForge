import {
  AccountRole,
  generateKeyPairSigner,
  type Address,
  type Instruction,
  type KeyPairSigner,
  type TransactionSigner,
} from "@solana/kit";
import { createClient } from "@solana/kit-client-rpc";
import {
  findRankedRunPda,
  getRankedRunDecoder,
  getRankedRunDiscriminatorBytes,
  getRankedRunSize,
  getAdvanceRankedRunInstruction,
  getDelegateRankedRunInstructionAsync,
  getFinalizeRankedRunInstruction,
  getStartRankedRunInstruction,
} from "../../generated/result_registry";
import type { RankedRun } from "../../generated/result_registry";
import { createRunNonce } from "../results/registry";
import type { ScenarioId, StrategyConfig } from "../simulation";
import { getMagicBlockConfig } from "./config";
import { getDelegationStatus } from "./router";

export const RANKED_RUN_SCHEMA_VERSION = 1;
export const RANKED_RUN_SESSION_LAMPORTS = 1_000_000n;
export const RANKED_RUN_TICKS = 60;

const SCENARIO_IDS: Record<ScenarioId, number> = {
  "stable-market": 0,
  "whale-sell": 1,
  "flash-crash": 2,
};

export type RankedRunStartPlan = {
  runAddress: Address;
  runNonce: bigint;
  sessionSigner: KeyPairSigner;
  instructions: readonly [
    ReturnType<typeof getStartRankedRunInstruction>,
    Awaited<ReturnType<typeof getDelegateRankedRunInstructionAsync>>,
    Instruction,
  ];
};

/**
 * Builds the one wallet-approved base-layer transaction for an authoritative
 * run: create its PDA, delegate it, and fund the temporary ER signer. The
 * signer remains in browser memory only and is constrained by the program.
 */
export async function buildRankedRunStartPlan({
  authority,
  scenarioId,
  strategy,
  programAddress,
  runNonce = createRunNonce(),
}: {
  authority: TransactionSigner;
  scenarioId: ScenarioId;
  strategy: StrategyConfig;
  programAddress: Address;
  runNonce?: bigint;
}): Promise<RankedRunStartPlan> {
  validateStrategy(strategy);
  const sessionSigner = await generateKeyPairSigner(false);
  const [runAddress] = await findRankedRunPda(
    { authority: authority.address, runNonce },
    { programAddress }
  );
  const start = getStartRankedRunInstruction(
    {
      authority,
      rankedRun: runAddress,
      scenarioId: SCENARIO_IDS[scenarioId],
      spreadBps: strategy.spreadBps,
      orderSizeMilli: BigInt(strategy.orderSizeMilliSol),
      maxInventoryMilli: BigInt(strategy.maxInventoryMilliSol),
      refreshTicks: strategy.refreshTicks,
      sessionSigner: sessionSigner.address,
      runNonce,
      schemaVersion: RANKED_RUN_SCHEMA_VERSION,
    },
    { programAddress }
  );
  const delegate = await getDelegateRankedRunInstructionAsync(
    {
      authority,
      rankedRun: runAddress,
      ownerProgram: programAddress,
      runNonce,
    },
    { programAddress }
  );
  // The signer is an ordinary temporary system account, not a delegated PDA.
  // Fund it on the base layer in the same wallet-approved transaction; devnet
  // ER validation is required before this flow is enabled in the UI.
  const topUp = systemTransferInstruction(
    authority.address,
    sessionSigner.address,
    RANKED_RUN_SESSION_LAMPORTS
  );
  return {
    runAddress,
    runNonce,
    sessionSigner,
    instructions: [start, delegate, topUp],
  };
}

/** Waits for the router to expose the ER selected for this delegated PDA. */
export async function resolveRankedRunEr(
  runAddress: Address,
  { timeoutMs = 30_000, intervalMs = 500 } = {}
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getDelegationStatus(runAddress);
    if (status.isDelegated && status.erEndpoint) return status.erEndpoint;
    await delay(intervalMs);
  }
  throw new Error(
    "MagicBlock delegation did not become available before timeout."
  );
}

/** Executes all deterministic ticks and schedules terminal commit/undelegation on the ER. */
export async function executeRankedRun({
  runAddress,
  sessionSigner,
  erEndpoint,
  programAddress,
  onTick,
  onSnapshot,
  readAccount = readRankedRun,
}: {
  runAddress: Address;
  sessionSigner: KeyPairSigner;
  erEndpoint: string;
  programAddress: Address;
  onTick?: (tick: number) => void;
  onSnapshot?: (run: RankedRun) => void;
  readAccount?: typeof readRankedRun;
}): Promise<{ tickSignatures: string[]; finalizeSignature: string }> {
  const client = createClient({ url: erEndpoint, payer: sessionSigner });
  const tickSignatures: string[] = [];
  const initial = await readAccount(erEndpoint, runAddress, programAddress);
  if (!initial || initial.status !== 1 || initial.tick > RANKED_RUN_TICKS)
    throw new Error(
      "The delegated ranked-run account is unavailable or inactive on its ER."
    );
  onSnapshot?.(initial);
  for (let tick = initial.tick; tick < RANKED_RUN_TICKS; tick += 1) {
    try {
      const result = await client.sendTransaction([
        getAdvanceRankedRunInstruction(
          { actor: sessionSigner, rankedRun: runAddress },
          { programAddress }
        ),
      ]);
      tickSignatures.push(result.context.signature);
    } catch (reason) {
      // A transport/WS confirmation failure can happen after the transaction
      // lands. Never resend an advancing instruction without reading the ER.
      if (
        !(await waitForErTick(erEndpoint, runAddress, programAddress, tick + 1))
      )
        throw reason;
      tickSignatures.push("confirmed-by-er-account");
    }
    onTick?.(tick + 1);
    if (onSnapshot) {
      // Snapshot reads are presentation-only. A missed ER read must never
      // interrupt a confirmed run or invent a local account transition.
      try {
        const snapshot = await readAccount(
          erEndpoint,
          runAddress,
          programAddress
        );
        if (snapshot?.status === 1 && snapshot.tick === tick + 1)
          onSnapshot(snapshot);
      } catch {
        /* The next confirmed account read can fill the visible gap. */
      }
    }
  }
  let finalizeSignature: string;
  try {
    const finalized = await client.sendTransaction([
      getFinalizeRankedRunInstruction(
        { actor: sessionSigner, rankedRun: runAddress },
        { programAddress }
      ),
    ]);
    finalizeSignature = finalized.context.signature;
  } catch (reason) {
    try {
      await waitForRankedRunSettlement({
        runAddress,
        programAddress,
        authority: initial.authority,
        runNonce: initial.runNonce,
        timeoutMs: 30_000,
      });
      finalizeSignature = "confirmed-by-base-account";
    } catch {
      throw reason;
    }
  }
  return { tickSignatures, finalizeSignature };
}

async function waitForErTick(
  erEndpoint: string,
  runAddress: Address,
  programAddress: Address,
  expectedTick: number
) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    try {
      const run = await readRankedRun(erEndpoint, runAddress, programAddress);
      if (run && run.tick >= expectedTick) return true;
    } catch {
      /* transient ER read; retry until deadline */
    }
    await delay(400);
  }
  return false;
}

type RpcAccount = { owner: string; data: [string, string] };

/** Reads authoritative account bytes. A delegated account is only final after
 * base-layer ownership returns to this program and the settled flag is set. */
export async function readRankedRun(
  rpcUrl: string,
  runAddress: Address,
  programAddress: Address,
  fetcher: typeof fetch = fetch
): Promise<RankedRun | null> {
  const response = await fetcher(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [runAddress, { encoding: "base64", commitment: "confirmed" }],
    }),
  });
  if (!response.ok)
    throw new Error(`Ranked-run RPC returned HTTP ${response.status}.`);
  const body = (await response.json()) as {
    error?: { message?: string };
    result?: { value?: RpcAccount | null };
  };
  if (body.error)
    throw new Error(body.error.message ?? "Ranked-run RPC failed.");
  const account = body.result?.value;
  if (!account || account.owner !== programAddress) return null;
  if (!Array.isArray(account.data) || account.data[1] !== "base64")
    throw new Error("Ranked-run RPC returned malformed account data.");
  const binary = atob(account.data[0]);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.length !== getRankedRunSize())
    throw new Error("Ranked-run account has an unexpected size.");
  if (
    !getRankedRunDiscriminatorBytes().every(
      (byte, index) => bytes[index] === byte
    )
  )
    throw new Error("Ranked-run account has an invalid discriminator.");
  return getRankedRunDecoder().decode(bytes);
}

export async function waitForRankedRunSettlement({
  runAddress,
  programAddress,
  authority,
  runNonce,
  timeoutMs = 120_000,
  intervalMs = 1_000,
  rpcUrl = getMagicBlockConfig().baseRpcUrl,
}: {
  runAddress: Address;
  programAddress: Address;
  authority: Address;
  runNonce: bigint;
  timeoutMs?: number;
  intervalMs?: number;
  rpcUrl?: string;
}): Promise<RankedRun> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await readRankedRun(rpcUrl, runAddress, programAddress);
    if (run?.status === 2) {
      if (
        run.authority !== authority ||
        run.runNonce !== runNonce ||
        run.schemaVersion !== RANKED_RUN_SCHEMA_VERSION ||
        run.tick !== RANKED_RUN_TICKS ||
        run.durationTicks !== RANKED_RUN_TICKS ||
        run.finalizedAt <= 0n ||
        run.finalScore > 10_000
      ) {
        throw new Error("Settled ranked-run data failed verification.");
      }
      return run;
    }
    await delay(intervalMs);
  }
  throw new Error(
    `The run has not settled on Solana devnet yet. Check account ${runAddress} before retrying.`
  );
}

export async function startAndExecuteRankedRun({
  authority,
  scenarioId,
  strategy,
  programAddress,
  onStage,
  onTick,
  onSnapshot,
}: {
  authority: TransactionSigner;
  scenarioId: ScenarioId;
  strategy: StrategyConfig;
  programAddress: Address;
  onStage?: (
    stage: "approval" | "delegating" | "executing" | "settling",
    runAddress: Address
  ) => void;
  onTick?: (tick: number) => void;
  onSnapshot?: (run: RankedRun) => void;
}): Promise<{
  runAddress: Address;
  run: RankedRun;
  startSignature: string;
  finalizeSignature: string;
}> {
  const plan = await buildRankedRunStartPlan({
    authority,
    scenarioId,
    strategy,
    programAddress,
  });
  onStage?.("approval", plan.runAddress);
  const base = createClient({
    url: getMagicBlockConfig().baseRpcUrl,
    payer: authority,
  });
  let startSignature: string;
  let erEndpoint: string | null = null;
  try {
    const started = await base.sendTransaction([...plan.instructions]);
    startSignature = started.context.signature;
  } catch (reason) {
    // The wallet start may have landed even if its confirmation WebSocket
    // failed. Keep the in-memory signer and reconcile through the router.
    try {
      erEndpoint = await resolveRankedRunEr(plan.runAddress, {
        timeoutMs: 8_000,
      });
      startSignature = "confirmed-by-router";
    } catch {
      throw reason;
    }
  }
  onStage?.("delegating", plan.runAddress);
  erEndpoint ??= await resolveRankedRunEr(plan.runAddress);
  onStage?.("executing", plan.runAddress);
  const executed = await executeRankedRun({
    runAddress: plan.runAddress,
    sessionSigner: plan.sessionSigner,
    erEndpoint,
    programAddress,
    onTick,
    onSnapshot,
  });
  onStage?.("settling", plan.runAddress);
  const run = await waitForRankedRunSettlement({
    runAddress: plan.runAddress,
    programAddress,
    authority: authority.address,
    runNonce: plan.runNonce,
  });
  onSnapshot?.(run);
  return {
    runAddress: plan.runAddress,
    run,
    startSignature,
    finalizeSignature: executed.finalizeSignature,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isMagicBlockRankedRunsEnabled() {
  return (
    getMagicBlockConfig().enabled &&
    process.env.NEXT_PUBLIC_RANKED_RUNS_ENABLED === "true"
  );
}

function validateStrategy(strategy: StrategyConfig) {
  if (
    !Number.isInteger(strategy.spreadBps) ||
    strategy.spreadBps < 2 ||
    strategy.spreadBps > 1_000 ||
    !Number.isInteger(strategy.orderSizeMilliSol) ||
    strategy.orderSizeMilliSol <= 0 ||
    !Number.isInteger(strategy.maxInventoryMilliSol) ||
    strategy.orderSizeMilliSol > strategy.maxInventoryMilliSol ||
    strategy.maxInventoryMilliSol > 1_000_000 ||
    !Number.isInteger(strategy.refreshTicks) ||
    strategy.refreshTicks < 1 ||
    strategy.refreshTicks > 60
  ) {
    throw new Error("Strategy parameters are outside the ranked-run limits.");
  }
}

/** Kit-native System Program transfer; avoids web3 compatibility leakage. */
function systemTransferInstruction(
  from: Address,
  to: Address,
  lamports: bigint
): Instruction {
  const data = new Uint8Array(12);
  new DataView(data.buffer).setUint32(0, 2, true);
  new DataView(data.buffer).setBigUint64(4, lamports, true);
  return {
    programAddress: "11111111111111111111111111111111" as Address,
    accounts: [
      { address: from, role: AccountRole.WRITABLE_SIGNER },
      { address: to, role: AccountRole.WRITABLE },
    ],
    data,
  };
}
