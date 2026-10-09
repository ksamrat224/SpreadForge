import {
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  isTransactionModifyingSigner,
  isTransactionPartialSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type Signature,
  type TransactionSigner,
} from "@solana/kit";
import {
  getPaperAccountDecoder,
  getResultRegistryErrorMessage,
  RESULT_REGISTRY_ERROR__INSUFFICIENT_PAPER_BALANCE,
  RESULT_REGISTRY_ERROR__INVALID_PAPER_FUNDING,
  RESULT_REGISTRY_ERROR__INVALID_PAPER_ORDER,
  RESULT_REGISTRY_ERROR__STALE_PAPER_PRICE,
  RESULT_REGISTRY_ERROR__UNAUTHORIZED_PAPER_TRADER,
  type PaperAccount,
} from "../../generated/result_registry";
import {
  PAPER_ASSETS,
  type PaperAsset,
  type PaperChainSnapshot,
  type Position,
  type Trade,
} from "../simulation/paper";
import { getMagicBlockConfig, type MagicBlockConfig } from "./config";

/** Must match `PAPER_RECENT_FILLS` in the Result Registry program. */
export const PAPER_RECENT_FILLS = 16;
export const PAPER_FUNDING = { fixed: 0, wallet: 1 } as const;
export const PAPER_SIDE = { buy: 0, sell: 1 } as const;
export const PAPER_SOURCE = { MARKET: 0, LIMIT: 1 } as const;
export const DELEGATION_PROGRAM_ADDRESS =
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh" as Address;

/** The program identifies markets by their index in `PAPER_ASSETS`. */
export function paperAssetIndex(asset: PaperAsset) {
  return PAPER_ASSETS.indexOf(asset);
}

/** Converts an on-chain account into desk balances and newest-first fills. */
export function paperAccountToSnapshot(
  account: PaperAccount
): PaperChainSnapshot {
  const positions = Object.fromEntries(
    PAPER_ASSETS.map((asset, index) => [
      asset,
      {
        quantityMilliAsset: Number(account.positions[index].quantityMilli),
        inventoryCostCents: Number(account.positions[index].inventoryCostCents),
      },
    ])
  ) as Record<PaperAsset, Position>;
  const count = account.tradeCount;
  const trades = Array.from(
    { length: Math.min(count, PAPER_RECENT_FILLS) },
    (_, offset): Trade => {
      const fill =
        account.recentFills[(count - 1 - offset) % PAPER_RECENT_FILLS];
      return {
        id: count - offset,
        asset: PAPER_ASSETS[fill.asset],
        side: fill.side === PAPER_SIDE.sell ? "sell" : "buy",
        priceCents: Number(fill.priceCents),
        sizeMilliAsset: Number(fill.sizeMilli),
        // Market-clock time, so fills line up with the chart's price points.
        at: Number(fill.priceAtMs),
        source: fill.source === PAPER_SOURCE.LIMIT ? "LIMIT" : "MARKET",
      };
    }
  );
  return {
    fundingSource:
      account.fundingSource === PAPER_FUNDING.wallet ? "wallet" : "fixed",
    usdcCents: Number(account.usdcCents),
    startEquityCents: Number(account.startEquityCents),
    realizedPnlCents: Number(account.realizedPnlCents),
    positions,
    trades,
  };
}

export type PaperAccountRead = {
  owner: Address;
  account: PaperAccount | null;
};

/** Reads and decodes a paper account from any RPC (devnet base or an ER). */
export async function readPaperAccount(
  rpcUrl: string,
  address: Address
): Promise<PaperAccountRead | null> {
  const { value } = await createSolanaRpc(rpcUrl)
    .getAccountInfo(address, { encoding: "base64", commitment: "confirmed" })
    .send();
  if (!value) return null;
  // While delegated, devnet holds a delegation-owned copy; decode only our own.
  const account =
    value.owner === DELEGATION_PROGRAM_ADDRESS
      ? null
      : getPaperAccountDecoder().decode(
          Uint8Array.from(atob(value.data[0]), (c) => c.charCodeAt(0))
        );
  return { owner: value.owner, account };
}

type Route = { identity: string; fqdn: string };

/**
 * Picks the public ER validator with the lowest round trip. TEE validators are
 * private rollups and are excluded.
 */
export async function pickValidator(
  config: MagicBlockConfig = getMagicBlockConfig(),
  fetcher: typeof fetch = fetch
): Promise<Route> {
  const routes = (
    await rpcCall<Route[]>(config.routerUrl, "getRoutes", [], fetcher)
  ).filter((route) => !route.fqdn.includes("tee"));
  if (!routes.length)
    throw new Error("MagicBlock has no public validators available.");
  const timed = await Promise.all(
    routes.map(async (route) => {
      const started = performance.now();
      try {
        await rpcCall(route.fqdn, "getSlot", [], fetcher);
        return { route, ms: performance.now() - started };
      } catch {
        return { route, ms: Infinity };
      }
    })
  );
  return timed.sort((a, b) => a.ms - b.ms)[0].route;
}

/** True when the wallet can sign without also broadcasting to its own RPC. */
export function canSignForRollup(signer: TransactionSigner) {
  return (
    isTransactionModifyingSigner(signer) || isTransactionPartialSigner(signer)
  );
}

/**
 * Has the wallet sign a transaction against the ER's blockhash, then submits
 * and confirms it on that ER. The wallet must not send it itself, because its
 * RPC is the base layer where the account is delegated.
 */
export async function sendWalletSignedToRollup({
  erEndpoint,
  signer,
  instructions,
}: {
  erEndpoint: string;
  signer: TransactionSigner;
  instructions: readonly Instruction[];
}): Promise<Signature> {
  if (!canSignForRollup(signer))
    throw new Error(
      "This wallet can only sign-and-send. Use a wallet that supports signTransaction for MagicBlock trades."
    );
  const rpc = createSolanaRpc(erEndpoint);
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: "legacy" }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m)
  );
  const signed = await signTransactionMessageWithSigners(message);
  const signature = getSignatureFromTransaction(signed);
  try {
    await rpc
      .sendTransaction(getBase64EncodedWireTransaction(signed), {
        encoding: "base64",
      })
      .send();
  } catch (error) {
    throw new Error(describeProgramError(error));
  }
  await confirmSignature(erEndpoint, signature);
  return signature;
}

export async function confirmSignature(
  rpcUrl: string,
  signature: Signature,
  timeoutMs = 30_000
) {
  const rpc = createSolanaRpc(rpcUrl);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { value } = await rpc.getSignatureStatuses([signature]).send();
    const status = value[0];
    if (status?.err)
      throw new Error(describeProgramError(JSON.stringify(status.err)));
    if (
      status?.confirmationStatus === "confirmed" ||
      status?.confirmationStatus === "finalized"
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(
    "The transaction was not confirmed in time. Refresh to check its status."
  );
}

/** Waits until `check` passes, for state that settles asynchronously. */
export async function waitFor<T>(
  check: () => Promise<T | null>,
  message: string,
  timeoutMs = 45_000
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check().catch(() => null);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(message);
}

// Codama strips error messages from production bundles, so the ones a trader
// can actually hit are kept here.
const PAPER_ERROR_MESSAGES: Record<number, string> = {
  [RESULT_REGISTRY_ERROR__INVALID_PAPER_FUNDING]:
    "This wallet has no devnet SOL to mirror. Open with 10,000 USDC instead.",
  [RESULT_REGISTRY_ERROR__UNAUTHORIZED_PAPER_TRADER]:
    "Only the wallet that owns this paper account may trade or settle it.",
  [RESULT_REGISTRY_ERROR__INVALID_PAPER_ORDER]:
    "Paper orders need a positive price and size.",
  [RESULT_REGISTRY_ERROR__STALE_PAPER_PRICE]:
    "The reference price is too old or too far in the future.",
  [RESULT_REGISTRY_ERROR__INSUFFICIENT_PAPER_BALANCE]:
    "Not enough simulated balance for this paper trade.",
};

/** Turns custom program error codes into the registry's own messages. */
export function describeProgramError(error: unknown): string {
  const text =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? `${error.message} ${JSON.stringify((error as { context?: unknown }).context ?? "")}`
        : JSON.stringify(error);
  const hex = text.match(/custom program error: 0x([0-9a-f]+)/i)?.[1];
  const decimal = text.match(/"Custom":\s*(\d+)/)?.[1];
  const code = hex ? parseInt(hex, 16) : decimal ? Number(decimal) : null;
  if (code !== null) {
    if (PAPER_ERROR_MESSAGES[code]) return PAPER_ERROR_MESSAGES[code];
    const message = getResultRegistryErrorMessage(
      code as Parameters<typeof getResultRegistryErrorMessage>[0]
    );
    if (message && !message.startsWith("Error message not available"))
      return message;
  }
  if (/user rejected|rejected the request|denied/i.test(text))
    return "The wallet request was rejected.";
  return error instanceof Error ? error.message : "The transaction failed.";
}

async function rpcCall<T>(
  url: string,
  method: string,
  params: unknown[],
  fetcher: typeof fetch = fetch
): Promise<T> {
  const response = await fetcher(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok)
    throw new Error(`${method} returned HTTP ${response.status}.`);
  const body = (await response.json()) as {
    result?: T;
    error?: { message?: string };
  };
  if (body.error || body.result === undefined)
    throw new Error(body.error?.message ?? `${method} failed.`);
  return body.result;
}
