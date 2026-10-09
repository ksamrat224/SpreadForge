import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrivateErServerConfig, getPrivateErTokenCookieName } from "../../../../lib/magicblock/private-er-server";

export const runtime = "nodejs";

/**
 * Private ER writes must be sent through MagicBlock's authenticated transaction
 * relay. The Payments bearer is valid for this relay, not for raw TEE JSON-RPC.
 */
export async function POST(request: Request) {
  const config = getPrivateErServerConfig();
  if (!config) return NextResponse.json({ error: "Private ER relay is not configured." }, { status: 503 });
  const token = (await cookies()).get(getPrivateErTokenCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Private ER authorization is required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!isValidRelayRequest(body)) return NextResponse.json({ error: "Invalid Private ER transaction." }, { status: 400 });

  const upstream = await fetch(config.transactionRelayUrl, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      transactionBase64: body.transactionBase64,
      sendTo: "ephemeral",
      // The Payments API otherwise defaults to mainnet. This selects its
      // authenticated devnet TEE route even when an explicit ER FQDN is also
      // supplied below.
      cluster: "devnet-private",
      sendRpcEndpoint: config.privateErUrl,
      // The Payments confirmation path can wait until the blockhash expires
      // even after the TEE has finalized the transaction. Submit here, then
      // confirm against the routed ER in the runtime below.
      confirm: false,
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ error: "Private ER relay is unavailable." }, { status: 502 });
  const data = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    if (upstream.status === 401 || upstream.status === 403) (await cookies()).delete(getPrivateErTokenCookieName());
    return NextResponse.json({ error: relayError(data, upstream.status) }, { status: upstream.status });
  }
  if (!data || typeof data.signature !== "string") return NextResponse.json({ error: "Private ER relay returned no signature." }, { status: 502 });
  return NextResponse.json({ signature: data.signature, confirmed: data.confirmed === true }, { headers: { "cache-control": "no-store" } });
}

function isValidRelayRequest(value: unknown): value is { transactionBase64: string; recentBlockhash: string; lastValidBlockHeight: number } {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return typeof data.transactionBase64 === "string" && data.transactionBase64.length > 0 && data.transactionBase64.length <= 32_768
    && typeof data.recentBlockhash === "string" && data.recentBlockhash.length > 0 && data.recentBlockhash.length <= 128
    && typeof data.lastValidBlockHeight === "number" && Number.isSafeInteger(data.lastValidBlockHeight) && data.lastValidBlockHeight >= 0;
}

function relayError(data: unknown, status: number) {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as { error?: unknown }).error;
    if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
      const structured = error as { code?: unknown; message: string; details?: unknown };
      const code = typeof structured.code === "string" ? ` [${structured.code}]` : "";
      const details = safeRelayDetails(structured.details);
      return `Private ER relay${code}: ${structured.message}${details ? ` — ${details}` : ""}`;
    }
  }
  return `Private ER relay failed (${status}).`;
}

/** Return Solana logs/validation detail without ever reflecting a token or tx. */
function safeRelayDetails(value: unknown): string | null {
  if (typeof value === "string") return value.slice(0, 1_500);
  if (!value || typeof value !== "object") return null;
  const details = value as Record<string, unknown>;
  const candidate = typeof details.message === "string"
    ? details.message
    : Array.isArray(details.logs)
      ? details.logs.filter((line): line is string => typeof line === "string").slice(-8).join(" | ")
      : null;
  return candidate ? candidate.slice(0, 1_500) : null;
}
