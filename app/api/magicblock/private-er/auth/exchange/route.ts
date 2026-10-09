import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAddress } from "@solana/kit";
import { getPrivateErServerConfig, getPrivateErTokenCookieName, getPrivateErTokenMaxAge } from "../../../../../lib/magicblock/private-er-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = getPrivateErServerConfig();
  if (!config) return NextResponse.json({ error: "Private ER authentication is not configured." }, { status: 503 });

  const body = await request.json().catch(() => null);
  if (!isValidExchange(body)) return NextResponse.json({ error: "Invalid Private ER authentication response." }, { status: 400 });

  const upstream = await fetch(config.loginUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pubkey: body.wallet,
      challenge: body.challenge,
      signature: body.signature,
      // Must match the private cluster used to issue the challenge.
      cluster: "devnet-private",
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!upstream?.ok) return NextResponse.json({ error: "Private ER authentication was rejected." }, { status: 401 });

  const data = await upstream.json().catch(() => null);
  const token = data && typeof data.token === "string" ? data.token : null;
  if (!token || token.length > 16_384) return NextResponse.json({ error: "Private ER authentication returned no usable token." }, { status: 502 });

  const maxAge = boundedMaxAge(data.expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(getPrivateErTokenCookieName(), token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/magicblock/private-er",
    maxAge,
  });
  return NextResponse.json({ expiresAt: Date.now() + maxAge * 1000 }, { headers: { "cache-control": "no-store" } });
}

function isValidExchange(value: unknown): value is { wallet: string; challenge: string; signedMessage: string; signature: string } {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return typeof data.wallet === "string" && isAddress(data.wallet)
    && typeof data.challenge === "string" && data.challenge.length > 0 && data.challenge.length <= 4096
    && typeof data.signedMessage === "string" && data.signedMessage.length > 0 && data.signedMessage.length <= 8192
    && typeof data.signature === "string" && data.signature.length > 0 && data.signature.length <= 1024;
}

function boundedMaxAge(expiresAt: unknown): number {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) return getPrivateErTokenMaxAge();
  const seconds = Math.floor((expiresAt - Date.now()) / 1000);
  return Math.max(60, Math.min(seconds, getPrivateErTokenMaxAge()));
}
