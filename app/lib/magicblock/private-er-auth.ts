import { getBase58Decoder } from "@solana/kit";
import type { WalletSession } from "../wallet/types";

const CHALLENGE_PATH = "/api/magicblock/private-er/auth/challenge";
const EXCHANGE_PATH = "/api/magicblock/private-er/auth/exchange";
const TRANSACTION_RELAY_PATH = "/api/magicblock/private-er/send";

type ChallengeResponse = { challenge: string; expiresAt?: number };
type ExchangeResponse = { expiresAt?: number };

/**
 * Establishes a browser-session-only Private ER grant. The bearer credential
 * is deliberately set by the server in an HttpOnly cookie; it never reaches
 * React state, localStorage, or a NEXT_PUBLIC environment variable.
 */
export async function authenticatePrivateEr(wallet: WalletSession): Promise<ExchangeResponse> {
  if (!wallet.signMessage) {
    throw new Error("This wallet does not support message signing, which is required for Private ER access.");
  }

  const challengeResponse = await fetch(CHALLENGE_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: wallet.account.address }),
    cache: "no-store",
  });
  const challenge = await readJson<ChallengeResponse>(challengeResponse);
  if (!challenge.challenge || challenge.challenge.length > 4096) {
    throw new Error("Private ER authentication returned an invalid challenge.");
  }

  const message = new TextEncoder().encode(challenge.challenge);
  const signed = await wallet.signMessage(message);
  const exchangeResponse = await fetch(EXCHANGE_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      wallet: wallet.account.address,
      challenge: challenge.challenge,
      signedMessage: bytesToBase64(signed.signedMessage),
      signature: getBase58Decoder().decode(signed.signature),
    }),
    cache: "no-store",
  });
  return readJson<ExchangeResponse>(exchangeResponse);
}

export function getPrivateErRpcProxyUrl(): string {
  if (typeof window === "undefined") throw new Error("Private ER RPC is only available in a browser session.");
  return new URL("/api/magicblock/private-er/rpc", window.location.origin).toString();
}

export function getPrivateErTransactionRelayUrl(): string {
  if (typeof window === "undefined") throw new Error("Private ER transaction relay is only available in a browser session.");
  return new URL(TRANSACTION_RELAY_PATH, window.location.origin).toString();
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null) as { error?: unknown } | T | null;
  if (!response.ok) {
    const detail = data && typeof data === "object" && "error" in data && typeof data.error === "string"
      ? data.error
      : `Private ER authentication failed (${response.status}).`;
    throw new Error(detail);
  }
  return data as T;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
