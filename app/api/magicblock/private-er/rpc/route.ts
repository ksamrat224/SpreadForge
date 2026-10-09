import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrivateErServerConfig, getPrivateErTokenCookieName } from "../../../../lib/magicblock/private-er-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = getPrivateErServerConfig();
  if (!config) return NextResponse.json({ error: "Private ER proxy is not configured." }, { status: 503 });
  const token = config.genericRpcAuthMode === "payment-bearer"
    ? (await cookies()).get(getPrivateErTokenCookieName())?.value
    : null;
  if (config.genericRpcAuthMode === "payment-bearer" && !token) {
    return NextResponse.json({ error: "Private ER authorization is required." }, { status: 401 });
  }

  const body = await request.text();
  if (!body || body.length > 1_000_000) return NextResponse.json({ error: "Invalid RPC request." }, { status: 400 });
  try { JSON.parse(body); } catch { return NextResponse.json({ error: "Invalid RPC request." }, { status: 400 }); }

  const upstream = await fetch(config.privateErUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { [config.authorizationHeader]: `${config.authorizationPrefix}${token}` } : {}),
    },
    body,
    cache: "no-store",
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ error: "Private ER is unavailable." }, { status: 502 });
  if (upstream.status === 401 || upstream.status === 403) {
    if (config.genericRpcAuthMode === "payment-bearer") {
      (await cookies()).delete(getPrivateErTokenCookieName());
    }
    return NextResponse.json({ error: "Private ER authorization expired or was rejected." }, { status: upstream.status });
  }
  const payload = await upstream.text();
  return new NextResponse(payload, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
  });
}
