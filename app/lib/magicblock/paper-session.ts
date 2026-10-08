import {
  getAddressEncoder,
  getBytesEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
  type Address,
  type KeyPairSigner,
  type TransactionSigner,
} from "@solana/kit";
import {
  findRegistryPda,
  getInitializePaperSessionInstruction,
} from "../../generated/result_registry";
import { createRunNonce } from "../results/registry";
import {
  createInMemorySessionSigner,
  createSessionExpiry,
  DEFAULT_SESSION_TTL_SECONDS,
} from "./session";

const PAPER_SESSION_SEED = new TextEncoder().encode("paper-session");

/**
 * Base-layer half of a private paper session. The resulting PDA is delegated
 * by the ER transport after this instruction has been wallet-authorized.
 */
export type PaperSessionStartPlan = {
  sessionAddress: Address;
  registryAddress: Address;
  runNonce: bigint;
  sessionSigner: KeyPairSigner;
  initializeInstruction: ReturnType<typeof getInitializePaperSessionInstruction>;
};

export async function findPaperSessionPda({
  authority,
  runNonce,
  programAddress,
}: {
  authority: Address;
  runNonce: bigint;
  programAddress: Address;
}) {
  return getProgramDerivedAddress({
    programAddress,
    seeds: [
      getBytesEncoder().encode(PAPER_SESSION_SEED),
      getAddressEncoder().encode(authority),
      getU64Encoder().encode(runNonce),
    ],
  });
}

export async function buildPaperSessionStartPlan({
  authority,
  programAddress,
  runNonce = createRunNonce(),
  expiresAt = createSessionExpiry(),
  sessionSigner,
}: {
  authority: TransactionSigner;
  programAddress: Address;
  runNonce?: bigint;
  expiresAt?: number;
  sessionSigner?: KeyPairSigner;
}): Promise<PaperSessionStartPlan> {
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt <= now || expiresAt > now + DEFAULT_SESSION_TTL_SECONDS * 96)
    throw new Error("Paper session expiry must be within the allowed session TTL.");
  const signer = sessionSigner ?? (await createInMemorySessionSigner());
  const [[sessionAddress], [registryAddress]] = await Promise.all([
    findPaperSessionPda({ authority: authority.address, runNonce, programAddress }),
    findRegistryPda({ programAddress }),
  ]);
  return {
    sessionAddress,
    registryAddress,
    runNonce,
    sessionSigner: signer,
    initializeInstruction: getInitializePaperSessionInstruction(
      {
        authority,
        registry: registryAddress,
        session: sessionAddress,
        sessionSigner: signer.address,
        runNonce,
        expiresAt,
      },
      { programAddress }
    ),
  };
}
