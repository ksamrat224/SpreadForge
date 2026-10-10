import { createSolanaRpc, type Address } from "@solana/kit";
import {
  getPaperAccountDecoder,
  getResultRegistryErrorMessage,
  RESULT_REGISTRY_ERROR__INSUFFICIENT_PAPER_BALANCE,
  RESULT_REGISTRY_ERROR__INVALID_PAPER_ASSET,
  RESULT_REGISTRY_ERROR__INVALID_PAPER_ORDER,
  RESULT_REGISTRY_ERROR__INVALID_PAPER_ORACLE,
  RESULT_REGISTRY_ERROR__PAPER_SLIPPAGE_EXCEEDED,
  RESULT_REGISTRY_ERROR__UNAUTHORIZED_PAPER_TRADER,
  type PaperAccount,
} from "../../generated/result_registry";
import { PAPER_ASSETS, type PaperAsset, type PaperChainSnapshot, type Position, type Trade } from "../simulation/paper";
import { getPaperPriceFeedAddress } from "../paper-oracle";

export const PAPER_RECENT_FILLS = 16;
export const PAPER_SIDE = { buy: 0, sell: 1 } as const;

export function paperAssetIndex(asset: PaperAsset) { return PAPER_ASSETS.indexOf(asset); }

/** The Pyth Receiver account maintained for an approved market feed. */
export function getPythPriceUpdateAddress(asset: PaperAsset): Address {
  return getPaperPriceFeedAddress(asset) as Address;
}

export function paperAccountToSnapshot(account: PaperAccount): PaperChainSnapshot {
  const positions = Object.fromEntries(PAPER_ASSETS.map((asset, index) => [asset, {
    quantityMilliAsset: Number(account.positions[index].quantityMilli),
    inventoryCostCents: Number(account.positions[index].inventoryCostCents),
  }])) as Record<PaperAsset, Position>;
  const count = account.tradeCount;
  const trades = Array.from({ length: Math.min(count, PAPER_RECENT_FILLS) }, (_, offset): Trade => {
    const fill = account.recentFills[(count - 1 - offset) % PAPER_RECENT_FILLS];
    return { id: count - offset, asset: PAPER_ASSETS[fill.asset], side: fill.side === PAPER_SIDE.sell ? "sell" : "buy", priceCents: Number(fill.priceCents), sizeMilliAsset: Number(fill.sizeMilli), at: Number(fill.priceAt) * 1000, source: "MARKET" };
  });
  return { fundingSource: "fixed", usdcCents: Number(account.usdcCents), startEquityCents: Number(account.startEquityCents), realizedPnlCents: Number(account.realizedPnlCents), positions, trades };
}

export async function readPaperAccount(rpcUrl: string, address: Address): Promise<PaperAccount | null> {
  const { value } = await createSolanaRpc(rpcUrl).getAccountInfo(address, { encoding: "base64", commitment: "confirmed" }).send();
  if (!value) return null;
  return getPaperAccountDecoder().decode(Uint8Array.from(atob(value.data[0]), (character) => character.charCodeAt(0)));
}

const PAPER_ERROR_MESSAGES: Record<number, string> = {
  [RESULT_REGISTRY_ERROR__UNAUTHORIZED_PAPER_TRADER]: "Only the portfolio owner may trade.",
  [RESULT_REGISTRY_ERROR__INVALID_PAPER_ASSET]: "This market is not configured for paper trading.",
  [RESULT_REGISTRY_ERROR__INVALID_PAPER_ORDER]: "Orders need a valid side, price, and positive size.",
  [RESULT_REGISTRY_ERROR__INVALID_PAPER_ORACLE]: "The verified market price is unavailable or stale.",
  [RESULT_REGISTRY_ERROR__PAPER_SLIPPAGE_EXCEEDED]: "The market moved beyond your slippage limit. Refresh and try again.",
  [RESULT_REGISTRY_ERROR__INSUFFICIENT_PAPER_BALANCE]: "Not enough simulated balance for this order.",
};

export function describeProgramError(error: unknown): string {
  const text = typeof error === "string" ? error : error instanceof Error ? `${error.message} ${JSON.stringify((error as { context?: unknown }).context ?? "")}` : JSON.stringify(error);
  const hex = text.match(/custom program error: 0x([0-9a-f]+)/i)?.[1];
  const decimal = text.match(/"Custom":\s*(\d+)/)?.[1];
  const code = hex ? parseInt(hex, 16) : decimal ? Number(decimal) : null;
  if (code !== null) {
    if (PAPER_ERROR_MESSAGES[code]) return PAPER_ERROR_MESSAGES[code];
    const message = getResultRegistryErrorMessage(code as Parameters<typeof getResultRegistryErrorMessage>[0]);
    if (message && !message.startsWith("Error message not available")) return message;
  }
  if (/user rejected|rejected the request|denied/i.test(text)) return "The wallet request was rejected.";
  return error instanceof Error ? error.message : "The transaction failed.";
}
