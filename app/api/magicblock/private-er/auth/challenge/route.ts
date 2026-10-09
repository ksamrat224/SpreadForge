import { NextResponse } from "next/server";
import { isAddress } from "@solana/kit";
import { getPrivateErServerConfig } from "../../../../../lib/magicblock/private-er-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = getPrivateErServerConfig();
  if (!config) return NextResponse.json({ error: "Private ER authentication is not configured." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const wallet = body && typeof body.wallet === "string" ? body.wallet : null;
  if (!wallet || !isAddress(wallet)) return NextResponse.json({ error: "A valid wallet address is required." }, { status: 400 });

  const upstreamUrl = new URL(config.challengeUrl);
  upstreamUrl.searchParams.set("pubkey", wallet);
  // MagicBlock scopes challenge tokens to the TEE route. A `devnet` token is
  // not valid for the protected `devnet-private` transaction relay.
  upstreamUrl.searchParams.set("cluster", "devnet-private");
  const upstream = await fetch(upstreamUrl, {
    method: "GET",
    cache: "no-store",
  }).catch(() => null);
  if (!upstream?.ok) return NextResponse.json({ error: "Private ER challenge service is unavailable." }, { status: 502 });

  const data = await upstream.json().catch(() => null);
  if (!data || typeof data.challenge !== "string" || data.challenge.length === 0 || data.challenge.length > 4096) {
    return NextResponse.json({ error: "Private ER challenge response is invalid." }, { status: 502 });
  }
  return NextResponse.json({ challenge: data.challenge, expiresAt: numericOrUndefined(data.expiresAt) }, { headers: { "cache-control": "no-store" } });
}

function numericOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;
}
