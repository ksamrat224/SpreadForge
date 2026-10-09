import { isAddress, type Address } from "@solana/kit";

export type MagicBlockConfig = {
  baseRpcUrl: string;
  routerUrl: string;
  /** Explicitly provisioned TEE endpoint. The router must select this host. */
  privateErUrl: string | null;
  /** TEE validator identity supplied by MagicBlock for private delegation. */
  privateErValidator: Address | null;
  /** Enables the server-side challenge/login proxy; it contains no credentials. */
  privateErAuthEnabled: boolean;
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
    privateErUrl: optionalUrl(process.env.NEXT_PUBLIC_MAGICBLOCK_PRIVATE_ER_URL),
    privateErValidator: optionalAddress(process.env.NEXT_PUBLIC_MAGICBLOCK_PRIVATE_ER_VALIDATOR),
    privateErAuthEnabled: process.env.NEXT_PUBLIC_MAGICBLOCK_PRIVATE_ER_AUTH_ENABLED === "true",
    enabled: process.env.NEXT_PUBLIC_MAGICBLOCK_ENABLED === "true",
  };
}

function optionalAddress(value: string | undefined): Address | null {
  if (!value) return null;
  if (!isAddress(value)) throw new Error("NEXT_PUBLIC_MAGICBLOCK_PRIVATE_ER_VALIDATOR must be a Solana address.");
  return value;
}

function optionalUrl(value: string | undefined): string | null {
  return value ? validateUrl(value, "NEXT_PUBLIC_MAGICBLOCK_PRIVATE_ER_URL") : null;
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
