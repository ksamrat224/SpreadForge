import { getMagicBlockConfig, type MagicBlockConfig } from "./config";

export type DelegationStatus = {
  isDelegated: boolean;
  erEndpoint: string | null;
};

/** Fetches the router-selected ER; callers must never guess a regional endpoint. */
export async function getDelegationStatus(
  accountAddress: string,
  config: MagicBlockConfig = getMagicBlockConfig(),
  fetcher: typeof fetch = fetch
): Promise<DelegationStatus> {
  const response = await fetcher(config.routerUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getDelegationStatus",
      params: [accountAddress],
    }),
  });
  if (!response.ok) {
    throw new Error(`MagicBlock router returned HTTP ${response.status}.`);
  }
  const body: unknown = await response.json();
  return parseDelegationStatus(body);
}

export function parseDelegationStatus(body: unknown): DelegationStatus {
  if (!body || typeof body !== "object") {
    throw new Error("MagicBlock router returned an invalid response.");
  }
  const response = body as {
    error?: { message?: unknown };
    result?: { isDelegated?: unknown; fqdn?: unknown };
  };
  if (response.error) {
    throw new Error(
      typeof response.error.message === "string"
        ? response.error.message
        : "MagicBlock router rejected the request."
    );
  }
  if (typeof response.result?.isDelegated !== "boolean") {
    throw new Error("MagicBlock router response is missing delegation status.");
  }
  const endpoint = response.result.fqdn;
  let erEndpoint: string | null = null;
  if (response.result.isDelegated) {
    if (typeof endpoint !== "string") {
      throw new Error("MagicBlock router returned an invalid ER endpoint.");
    }
    erEndpoint = validateErEndpoint(endpoint);
  }
  return {
    isDelegated: response.result.isDelegated,
    erEndpoint,
  };
}

function validateErEndpoint(value: string): string {
  const normalized = value.includes("://") ? value : `https://${value}`;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new Error("MagicBlock router returned an invalid ER endpoint.");
  }
}
