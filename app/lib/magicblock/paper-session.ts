import {
  AccountRole,
  createSolanaRpc,
  setTransactionMessageComputeUnitLimit,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Instruction,
  type KeyPairSigner,
  type Signature,
  type TransactionSigner,
} from "@solana/kit";
import { createClient } from "@solana/kit-client-rpc";
import { singleTransactionPlan } from "@solana/instruction-plans";
import { signTransactionMessageWithSigners } from "@solana/signers";
import { getBase64EncodedWireTransaction } from "@solana/transactions";
import {
  fetchMaybePaperPortfolio,
  findPerformancePda,
  findPortfolioPda,
  findRegistryPda,
  getDelegatePaperPortfolioInstructionAsync,
  getInitializePaperPortfolioInstruction,
  getInitializePaperPortfolioPermissionInstructionAsync,
  getRecoverPaperPortfolioInstruction,
  getRenewPaperAuthorizationInstruction,
  type PaperPortfolio,
} from "../../generated/result_registry";
import { getMagicBlockConfig, type MagicBlockConfig } from "./config";
import { getDelegationStatus } from "./router";
import {
  createInMemorySessionSigner,
  createSessionExpiry,
  DEFAULT_SESSION_TTL_SECONDS,
} from "./session";

export const PAPER_SESSION_FEE_ALLOWANCE_LAMPORTS = 10_000_000n;
const SYSTEM_PROGRAM = "11111111111111111111111111111111" as Address;
// `1_400_000` is Kit's provisional "estimate this" ceiling, not an explicit
// request. Keeping below it prevents an unnecessary simulation for setup
// transactions, including a simple base-layer fee top-up.
const PAPER_BASE_SETUP_COMPUTE_UNITS = 800_000;
const PAPER_BASE_TRANSFER_COMPUTE_UNITS = 50_000;
const PAPER_ER_COMPUTE_UNITS = 1_399_999;

/** Base-layer setup for the one permanent, wallet-owned portfolio. */
export type PaperPortfolioStartPlan = {
  portfolioAddress: Address;
  registryAddress: Address;
  sessionSigner: KeyPairSigner;
  initializeInstruction: ReturnType<typeof getInitializePaperPortfolioInstruction>;
  delegateInstruction: Awaited<ReturnType<typeof getDelegatePaperPortfolioInstructionAsync>>;
  /** Devnet SOL only, used solely as the ER session signer's fee allowance. */
  sessionFeeInstruction: Instruction;
};

export type PaperPortfolioRuntimeState =
  | { kind: "missing"; portfolioAddress: Address }
  | { kind: "routing-required"; portfolioAddress: Address; portfolio: PaperPortfolio; erEndpoint: string | null; reason: string }
  | { kind: "private-access-required"; portfolioAddress: Address; portfolio: PaperPortfolio; erEndpoint: string }
  | { kind: "read-only"; portfolioAddress: Address; portfolio: PaperPortfolio; erEndpoint: string }
  | { kind: "ready"; portfolioAddress: Address; portfolio: PaperPortfolio; erEndpoint: string; expiresAt: number };

export type PaperBaseSender = (input: {
  instructions: readonly Instruction[];
  computeUnits: number;
}) => Promise<string>;

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
  validator,
  expiresAt = createSessionExpiry(),
  sessionSigner,
}: {
  authority: TransactionSigner;
  programAddress: Address;
  validator: Address;
  expiresAt?: number;
  sessionSigner?: KeyPairSigner;
}): Promise<PaperPortfolioStartPlan> {
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt <= now || expiresAt > now + DEFAULT_SESSION_TTL_SECONDS * 96)
    throw new Error("Paper session expiry must be within the allowed session TTL.");
  const signer = sessionSigner ?? (await createInMemorySessionSigner());
  const [[portfolioAddress], [registryAddress], [performanceAddress]] = await Promise.all([
    findPaperPortfolioPda({ authority: authority.address, programAddress }),
    findRegistryPda({ programAddress }),
    findPerformancePda({ authority: authority.address }, { programAddress }),
  ]);
  const delegateInstruction = await getDelegatePaperPortfolioInstructionAsync(
    { authority, portfolio: portfolioAddress, ownerProgram: programAddress, validator },
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
        performance: performanceAddress,
        sessionSigner: signer.address,
        expiresAt,
      },
      { programAddress }
    ),
    delegateInstruction,
    sessionFeeInstruction: getSessionFeeAllowanceInstruction(authority, signer.address),
  };
}

/**
 * The only executable paper-trading transport. It deliberately has no local
 * balance or order state: all reads are routed account reads and all writes
 * are transactions against base or the router-selected ER.
 */
export class PaperTradingRuntime {
  private sessionSigner: KeyPairSigner | null = null;

  constructor(
    private readonly authority: TransactionSigner,
    private readonly programAddress: Address,
    private readonly sendBase: PaperBaseSender,
    private readonly config: MagicBlockConfig = getMagicBlockConfig(),
    private readonly privateErRpcUrl: string | null = null,
    private readonly authenticatePrivateEr: (() => Promise<void>) | null = null,
    private readonly privateErTransactionRelayUrl: string | null = null
  ) {}

  async load(): Promise<PaperPortfolioRuntimeState> {
    const [portfolioAddress] = await findPaperPortfolioPda({ authority: this.authority.address, programAddress: this.programAddress });
    const basePortfolio = await fetchMaybePaperPortfolio(createSolanaRpc(this.config.baseRpcUrl), portfolioAddress);
    if (!basePortfolio.exists) return { kind: "missing", portfolioAddress };
    const routing = await getDelegationStatus(portfolioAddress, this.config);
    if (!routing.isDelegated || !routing.erEndpoint) {
      return { kind: "routing-required", portfolioAddress, portfolio: basePortfolio.data, erEndpoint: null, reason: "The portfolio exists but is not delegated to a Private ER." };
    }
    if (!this.config.enabled || !this.config.privateErUrl) {
      return { kind: "routing-required", portfolioAddress, portfolio: basePortfolio.data, erEndpoint: routing.erEndpoint, reason: "Private ER configuration is required before the existing portfolio can be used." };
    }
    if (!this.config.privateErAuthEnabled || !this.privateErRpcUrl || !this.authenticatePrivateEr || !this.privateErTransactionRelayUrl) {
      return { kind: "routing-required", portfolioAddress, portfolio: basePortfolio.data, erEndpoint: routing.erEndpoint, reason: "Private ER challenge authentication must be configured before this portfolio can be used." };
    }
    if (new URL(routing.erEndpoint).host !== new URL(this.config.privateErUrl).host) {
      return { kind: "routing-required", portfolioAddress, portfolio: basePortfolio.data, erEndpoint: routing.erEndpoint, reason: "The existing portfolio is delegated to a different ER and must be recovered before it can be private." };
    }
    const route = routing.erEndpoint;
    let routed;
    try {
      // Delegation and an ER-local write can be visible to the router before
      // the account-read bank catches up. Do not turn that short propagation
      // window into a false "portfolio unavailable" failure.
      routed = await waitForRoutedPaperPortfolio(this.privateErRpcUrl, portfolioAddress);
    } catch (error) {
      if (isPrivateErAuthenticationError(error)) {
        return { kind: "private-access-required", portfolioAddress, portfolio: basePortfolio.data, erEndpoint: route };
      }
      throw error;
    }
    if (!routed.exists) throw new Error("The routed portfolio is unavailable. Trading stays disabled.");
    const expiresAt = Number(routed.data.expiresAt);
    if (this.sessionSigner && this.sessionSigner.address === routed.data.sessionSigner && expiresAt > unixTime()) {
      return { kind: "ready", portfolioAddress, portfolio: routed.data, erEndpoint: route, expiresAt };
    }
    return { kind: "read-only", portfolioAddress, portfolio: routed.data, erEndpoint: route };
  }

  /** One wallet-authorized base transaction, then an ER-local permission setup. */
  async createPortfolio(): Promise<PaperPortfolioRuntimeState> {
    assertPrivateRuntimeConfigured(this.config);
    await this.authorizePrivateEr();
    const existing = await this.load();
    if (existing.kind !== "missing") {
      return existing;
    }
    const plan = await buildPaperPortfolioStartPlan({ authority: this.authority, programAddress: this.programAddress, validator: this.config.privateErValidator! });
    await this.sendBase({ instructions: [plan.initializeInstruction, plan.sessionFeeInstruction, plan.delegateInstruction], computeUnits: PAPER_BASE_SETUP_COMPUTE_UNITS });
    await waitForPrivateRoute(plan.portfolioAddress, this.config);
    const permission = await getInitializePaperPortfolioPermissionInstructionAsync(
      { actor: plan.sessionSigner, portfolio: plan.portfolioAddress },
      { programAddress: this.programAddress }
    );
    await this.bootstrapAndSealPermission(plan.sessionSigner, permission);
    this.sessionSigner = plan.sessionSigner;
    return this.load();
  }

  /** Wallet renewal creates a replacement in-memory signer and refreshes PER membership. */
  async renewAuthorization(): Promise<PaperPortfolioRuntimeState> {
    assertPrivateRuntimeConfigured(this.config);
    await this.authorizePrivateEr();
    const [portfolioAddress] = await findPaperPortfolioPda({ authority: this.authority.address, programAddress: this.programAddress });
    await getPrivateRoute(portfolioAddress, this.config);
    const replacementSigner = await createInMemorySessionSigner();
    // This base-layer transfer is the disclosed, capped devnet fee allowance
    // for the replacement signer. It is never part of portfolio accounting.
    await this.sendBase({ instructions: [getSessionFeeAllowanceInstruction(this.authority, replacementSigner.address)], computeUnits: PAPER_BASE_TRANSFER_COMPUTE_UNITS });
    const renew = getRenewPaperAuthorizationInstruction(
      { authority: this.authority, portfolio: portfolioAddress, sessionSigner: replacementSigner.address, expiresAt: createSessionExpiry() },
      { programAddress: this.programAddress }
    );
    // The wallet is the actor while changing membership; the replacement key
    // becomes authorized only after this transaction has completed.
    await this.sendPrivateTransaction(this.authority, [renew]);
    const permission = await getInitializePaperPortfolioPermissionInstructionAsync(
      { actor: this.authority, portfolio: portfolioAddress },
      { programAddress: this.programAddress }
    );
    await this.bootstrapAndSealPermission(this.authority, permission);
    this.sessionSigner = replacementSigner;
    return this.load();
  }

  /** Recover a wrongly-routed portfolio, then delegate it explicitly to PER. */
  async recoverPrivateRouting(): Promise<PaperPortfolioRuntimeState> {
    assertPrivateRuntimeConfigured(this.config);
    await this.authorizePrivateEr();
    const state = await this.load();
    if (state.kind !== "routing-required" || !state.erEndpoint) {
      throw new Error("This portfolio does not require ER routing recovery.");
    }
    // Commit and undelegate must execute on the ER that currently owns the PDA.
    const recover = getRecoverPaperPortfolioInstruction(
      { authority: this.authority, portfolio: state.portfolioAddress },
      { programAddress: this.programAddress }
    );
    const currentErIsPrivate = new URL(state.erEndpoint).host === new URL(this.config.privateErUrl!).host;
    await sendPaperTransaction({
      url: currentErIsPrivate ? this.requirePrivateErRpcUrl() : state.erEndpoint,
      relayUrl: currentErIsPrivate ? this.privateErTransactionRelayUrl ?? undefined : undefined,
      payer: this.authority,
      instructions: [recover],
    });
    await waitForUndelegation(state.portfolioAddress, this.config);

    const replacementSigner = await createInMemorySessionSigner();
    const renew = getRenewPaperAuthorizationInstruction(
      { authority: this.authority, portfolio: state.portfolioAddress, sessionSigner: replacementSigner.address, expiresAt: createSessionExpiry() },
      { programAddress: this.programAddress }
    );
    const delegate = await getDelegatePaperPortfolioInstructionAsync(
      { authority: this.authority, portfolio: state.portfolioAddress, ownerProgram: this.programAddress, validator: this.config.privateErValidator! },
      { programAddress: this.programAddress }
    );
    await this.sendBase({ instructions: [getSessionFeeAllowanceInstruction(this.authority, replacementSigner.address), renew, delegate], computeUnits: PAPER_BASE_SETUP_COMPUTE_UNITS });
    await waitForPrivateRoute(state.portfolioAddress, this.config);
    const permission = await getInitializePaperPortfolioPermissionInstructionAsync(
      { actor: replacementSigner, portfolio: state.portfolioAddress },
      { programAddress: this.programAddress }
    );
    await this.bootstrapAndSealPermission(replacementSigner, permission);
    this.sessionSigner = replacementSigner;
    return this.load();
  }

  /** Session-key-only ER actions; no wallet fallback is ever permitted. */
  async sendErAction(instruction: Instruction): Promise<string> {
    const state = await this.load();
    if (state.kind !== "ready" || !this.sessionSigner) throw new Error("Renew trading authorization before submitting an order.");
    const result = await this.sendPrivateTransaction(this.sessionSigner, [instruction]);
    return result.context.signature;
  }

  private async authorizePrivateEr() {
    assertPrivateRuntimeConfigured(this.config);
    if (!this.config.privateErAuthEnabled || !this.authenticatePrivateEr || !this.privateErRpcUrl || !this.privateErTransactionRelayUrl) {
      throw new Error("Private ER challenge authentication is not configured for this deployment.");
    }
    await this.authenticatePrivateEr();
  }

  private requirePrivateErRpcUrl(): string {
    if (!this.privateErRpcUrl) throw new Error("Private ER proxy is not configured for this deployment.");
    return this.privateErRpcUrl;
  }

  /**
   * MagicBlock PERs require a public permission create followed by a private
   * member update. The Anchor instruction is deliberately idempotent: its
   * first call creates, its second call seals. Keeping this as two submitted
   * transactions also makes an interrupted setup safely retryable.
   */
  private async bootstrapAndSealPermission(payer: TransactionSigner, permission: Instruction) {
    await this.sendPrivateTransaction(payer, [permission]);
    await this.sendPrivateTransaction(payer, [permission]);
  }

  private async sendPrivateTransaction(payer: TransactionSigner, instructions: readonly Instruction[]) {
    const result = await sendPaperTransaction({
      url: this.requirePrivateErRpcUrl(),
      relayUrl: this.privateErTransactionRelayUrl ?? undefined,
      payer,
      instructions,
    });
    await this.waitForPrivateErConfirmation(result.context.signature);
    return result;
  }

  /**
   * The Payments relay confirms through a separate service path which can
   * outlive a valid blockhash. The router-selected ER is authoritative for
   * execution status, so poll it briefly before dependent instructions.
   */
  private async waitForPrivateErConfirmation(signature: string): Promise<void> {
    const rpc = createSolanaRpc(this.requirePrivateErRpcUrl());
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await rpc.getSignatureStatuses([signature as Signature]).send();
      const status = response.value[0];
      if (status) {
        if (status.err) throw new Error(`Private ER transaction failed: ${JSON.stringify(status.err)}`);
        if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") return;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("Private ER accepted the transaction but did not confirm it within six seconds. Trading remains locked.");
  }
}

function getSessionFeeAllowanceInstruction(source: TransactionSigner, destination: Address): Instruction {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true); // SystemProgram::Transfer
  view.setBigUint64(4, PAPER_SESSION_FEE_ALLOWANCE_LAMPORTS, true);
  return {
    programAddress: SYSTEM_PROGRAM,
    accounts: [
      { address: source.address, role: AccountRole.WRITABLE_SIGNER },
      { address: destination, role: AccountRole.WRITABLE },
    ],
    data,
  };
}

/**
 * `createClient` starts every planned transaction with a zero-CU placeholder.
 * Appending another Compute Budget instruction is insufficient: its planner
 * reads the first placeholder and still tries to estimate. Plan first, then
 * replace that exact placeholder before the executor signs or simulates it.
 */
export async function sendPaperTransaction({
  url,
  payer,
  instructions,
  computeUnits = PAPER_ER_COMPUTE_UNITS,
  relayUrl,
}: {
  url: string;
  /** MagicBlock Payments authenticated relay used only for Private ER writes. */
  relayUrl?: string;
  payer: TransactionSigner;
  instructions: readonly Instruction[];
  computeUnits?: number;
}) {
  const client = createClient({ url, payer });
  const message = await client.planTransaction(instructions);
  const transactionMessage = setTransactionMessageComputeUnitLimit(computeUnits, message);
  if (!relayUrl) return client.sendTransaction(singleTransactionPlan(transactionMessage));
  // `createClient.sendTransaction` normally adds a recent blockhash while it
  // executes the plan. The authenticated relay receives an already-signed
  // wire transaction, so obtain and attach that lifetime before signing.
  const { value: lifetime } = await client.rpc.getLatestBlockhash().send();
  const signedMessage = setTransactionMessageLifetimeUsingBlockhash(lifetime, transactionMessage);
  const transaction = await signTransactionMessageWithSigners(signedMessage);
  const response = await fetch(relayUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      transactionBase64: getBase64EncodedWireTransaction(transaction),
      recentBlockhash: lifetime.blockhash,
      lastValidBlockHeight: Number(lifetime.lastValidBlockHeight),
    }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as { signature?: unknown; error?: unknown } | null;
  if (!response.ok || !data || typeof data.signature !== "string") {
    const detail = data && typeof data.error === "string" ? data.error : `Private ER transaction relay failed (${response.status}).`;
    throw new Error(detail);
  }
  return { context: { signature: data.signature } };
}

function unixTime() { return Math.floor(Date.now() / 1000); }

function isPrivateErAuthenticationError(error: unknown) {
  return error instanceof Error && /(?:HTTP\s*error\s*\(?401|\b401\b|unauthori[sz]ed)/i.test(error.message);
}

function assertPrivateRuntimeConfigured(config: MagicBlockConfig) {
  if (!config.enabled || !config.privateErUrl || !config.privateErValidator) {
    throw new Error("Private MagicBlock execution is not configured for this deployment.");
  }
}

async function waitForUndelegation(portfolioAddress: Address, config: MagicBlockConfig): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const status = await getDelegationStatus(portfolioAddress, config);
    if (!status.isDelegated) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Portfolio undelegation did not settle before the recovery timeout.");
}

async function getPrivateRoute(portfolioAddress: Address, config: MagicBlockConfig): Promise<string> {
  assertPrivateRuntimeConfigured(config);
  const status = await getDelegationStatus(portfolioAddress, config);
  if (!status.isDelegated || !status.erEndpoint) throw new Error("Portfolio delegation has not reached an ER yet.");
  if (new URL(status.erEndpoint).host !== new URL(config.privateErUrl!).host) {
    throw new Error("Router selected an ER other than the configured Private ER.");
  }
  return status.erEndpoint;
}

async function waitForPrivateRoute(portfolioAddress: Address, config: MagicBlockConfig): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { return await getPrivateRoute(portfolioAddress, config); }
    catch (error) {
      if (attempt === 19) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error("Private ER routing timed out.");
}

async function waitForRoutedPaperPortfolio(rpcUrl: string, portfolioAddress: Address) {
  const rpc = createSolanaRpc(rpcUrl);
  let account = await fetchMaybePaperPortfolio(rpc, portfolioAddress);
  for (let attempt = 0; !account.exists && attempt < 29; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    account = await fetchMaybePaperPortfolio(rpc, portfolioAddress);
  }
  return account;
}
