import { type Address, type KeyPairSigner, type TransactionSigner } from "@solana/kit";
import {
  findPortfolioPda,
  findRegistryPda,
  getDelegatePaperPortfolioInstructionAsync,
  getInitializePaperPortfolioInstruction,
} from "../../generated/result_registry";
import {
  createInMemorySessionSigner,
  createSessionExpiry,
  DEFAULT_SESSION_TTL_SECONDS,
} from "./session";

/** Base-layer setup for the one permanent, wallet-owned portfolio. */
export type PaperPortfolioStartPlan = {
  portfolioAddress: Address;
  registryAddress: Address;
  sessionSigner: KeyPairSigner;
  initializeInstruction: ReturnType<typeof getInitializePaperPortfolioInstruction>;
  delegateInstruction: Awaited<ReturnType<typeof getDelegatePaperPortfolioInstructionAsync>>;
};

export async function findPaperPortfolioPda({
  authority,
  programAddress,
}: {
  authority: Address;
  programAddress: Address;
}) {
  return findPortfolioPda({ authority }, { programAddress });
}

export async function buildPaperPortfolioStartPlan({
  authority,
  programAddress,
  expiresAt = createSessionExpiry(),
  sessionSigner,
}: {
  authority: TransactionSigner;
  programAddress: Address;
  expiresAt?: number;
  sessionSigner?: KeyPairSigner;
}): Promise<PaperPortfolioStartPlan> {
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt <= now || expiresAt > now + DEFAULT_SESSION_TTL_SECONDS * 96)
    throw new Error("Paper session expiry must be within the allowed session TTL.");
  const signer = sessionSigner ?? (await createInMemorySessionSigner());
  const [[portfolioAddress], [registryAddress]] = await Promise.all([
    findPaperPortfolioPda({ authority: authority.address, programAddress }),
    findRegistryPda({ programAddress }),
  ]);
  const delegateInstruction = await getDelegatePaperPortfolioInstructionAsync(
    { authority, portfolio: portfolioAddress, ownerProgram: programAddress },
    { programAddress }
  );
  return {
    portfolioAddress,
    registryAddress,
    sessionSigner: signer,
    initializeInstruction: getInitializePaperPortfolioInstruction(
      {
        authority,
        registry: registryAddress,
        portfolio: portfolioAddress,
        sessionSigner: signer.address,
        expiresAt,
      },
      { programAddress }
    ),
    delegateInstruction,
  };
}
