export type MagicBlockConfig = {
  baseRpcUrl: string;
  routerUrl: string;
  enabled: boolean;
};

const DEVNET_BASE_RPC = "https://rpc.magicblock.app/devnet";
const DEVNET_ROUTER = "https://devnet-router.magicblock.app/";

/**
 * MagicBlock is opt-in until the session-enabled registry program is deployed
 * to devnet. ER endpoints are intentionally not configured here: the router
 * must select the compatible endpoint for each delegated session PDA.
 */
export function getMagicBlockConfig(): MagicBlockConfig {
  return {
    baseRpcUrl: validateUrl(
      process.env.NEXT_PUBLIC_MAGICBLOCK_BASE_RPC_URL ?? DEVNET_BASE_RPC,
      "NEXT_PUBLIC_MAGICBLOCK_BASE_RPC_URL"
    ),
    routerUrl: validateUrl(
      process.env.NEXT_PUBLIC_MAGICBLOCK_ROUTER_URL ?? DEVNET_ROUTER,
      "NEXT_PUBLIC_MAGICBLOCK_ROUTER_URL"
    ),
    enabled: process.env.NEXT_PUBLIC_MAGICBLOCK_ENABLED === "true",
  };
}

function validateUrl(value: string, variable: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:")
      throw new Error();
    return url.toString();
  } catch {
    throw new Error(`${variable} must be an HTTP(S) URL.`);
  }
}
