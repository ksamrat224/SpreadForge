import {
  getAddressEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
  isAddress,
  type Address,
  type TransactionSigner,
} from "@solana/kit";
import { getSubmitResultInstruction } from "../../generated/result_registry";
import type { ResultCommitment } from "./commitment";

export const RESULT_REGISTRY_SEED = "result";

/**
 * A deployment address is deliberately opt-in. The generated client can be
 * built and tested locally without accidentally targeting an undeployed ID.
 */
export function getResultRegistryProgramAddress(): Address | null {
  const configured = process.env.NEXT_PUBLIC_RESULT_REGISTRY_PROGRAM_ID;
  if (!configured) return null;
  if (!isAddress(configured)) {
    throw new Error(
      "NEXT_PUBLIC_RESULT_REGISTRY_PROGRAM_ID is not a Solana address."
    );
  }
  return configured;
}

export async function buildSubmitResultInstruction({
  authority,
  commitment,
  runNonce,
  programAddress,
}: {
  authority: TransactionSigner;
  commitment: ResultCommitment;
  runNonce: bigint;
  programAddress: Address;
}) {
  validateCommitment(commitment);
  const scenarioHash = hexToBytes(commitment.scenarioHash);
  const strategyHash = hexToBytes(commitment.strategyHash);
  const resultHash = hexToBytes(commitment.resultHash);
  const [resultAddress] = await getProgramDerivedAddress({
    programAddress,
    seeds: [
      RESULT_REGISTRY_SEED,
      getAddressEncoder().encode(authority.address),
      scenarioHash,
      getU64Encoder().encode(runNonce),
    ],
  });

  return {
    instruction: getSubmitResultInstruction(
      {
        authority,
        result: resultAddress,
        scenarioHash,
        strategyHash,
        resultHash,
        totalScore: commitment.totalScore,
        pnlBps: commitment.pnlBps,
        maxDrawdownBps: commitment.maxDrawdownBps,
        fills: commitment.fills,
        schemaVersion: commitment.schemaVersion,
        runNonce,
      },
      { programAddress }
    ),
    resultAddress,
  };
}

export function createRunNonce(): bigint {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error(
      "Web Crypto is unavailable; cannot create a unique run nonce."
    );
  }
  const values = globalThis.crypto.getRandomValues(new Uint32Array(2));
  return (BigInt(values[0]) << 32n) | BigInt(values[1]);
}

export function hexToBytes(hash: string): Uint8Array {
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw new Error(
      "A result commitment hash must be 32 bytes of hexadecimal."
    );
  }
  return Uint8Array.from({ length: 32 }, (_, index) =>
    Number.parseInt(hash.slice(index * 2, index * 2 + 2), 16)
  );
}

function validateCommitment(commitment: ResultCommitment) {
  if (
    !Number.isInteger(commitment.totalScore) ||
    commitment.totalScore < 0 ||
    commitment.totalScore > 10_000
  ) {
    throw new Error("Result score must be an integer between 0 and 10,000.");
  }
  if (
    !Number.isInteger(commitment.pnlBps) ||
    !Number.isInteger(commitment.maxDrawdownBps)
  ) {
    throw new Error(
      "Result metrics must be represented in integer basis points."
    );
  }
  if (
    !Number.isInteger(commitment.fills) ||
    commitment.fills < 0 ||
    commitment.fills > 65_535
  ) {
    throw new Error("Fill count must fit in the on-chain result schema.");
  }
}
