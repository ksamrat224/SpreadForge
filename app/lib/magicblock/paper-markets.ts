import {
  getAddressEncoder,
  getBytesEncoder,
  getProgramDerivedAddress,
  type Address,
  type TransactionSigner,
} from "@solana/kit";
import {
  findRegistryPda,
  getUpsertPaperMarketInstruction,
} from "../../generated/result_registry";

/**
 * Reviewed devnet MagicBlock Pyth mirror configuration. This file is the
 * registry source of truth; it is not a browser price feed and is never used
 * to calculate fills client-side.
 */
export const BTC_USD_PAPER_MARKET = {
  symbol: "BTC/USD",
  marketId: paddedMarketId("BTC-USD"),
  oracleFeed: hex32("59642ec3906a38d1267d4aafac36a5e2a47e6d38ed7e5b5843dd287e5e21ab65"),
  oraclePriceAccount: "71wtTRDY8Gxgw56bXFt2oc6qeAbTxzStdNiC425Z51sr" as Address,
  oracleProgram: "PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd" as Address,
  // One lot is 0.001 BTC; all portfolio math stays in integer cents/lots.
  lotSize: 1n,
  priceMultiplier: 100,
  halfSpreadBps: 10,
  depthLots: 10n,
} as const;

export async function findPaperMarketPda(programAddress: Address, marketId: Uint8Array) {
  const [registry] = await findRegistryPda({ programAddress });
  return getProgramDerivedAddress({
    programAddress,
    seeds: [
      getBytesEncoder().encode(new TextEncoder().encode("paper-market")),
      getAddressEncoder().encode(registry),
      marketId,
    ],
  });
}

/** Builds the admin transaction; registration is intentionally never auto-sent. */
export async function buildBtcUsdMarketRegistration({
  authority,
  programAddress,
}: {
  authority: TransactionSigner;
  programAddress: Address;
}) {
  const [[registry], [market]] = await Promise.all([
    findRegistryPda({ programAddress }),
    findPaperMarketPda(programAddress, BTC_USD_PAPER_MARKET.marketId),
  ]);
  return getUpsertPaperMarketInstruction(
    { authority, registry, market, ...BTC_USD_PAPER_MARKET, enabled: true },
    { programAddress }
  );
}

function paddedMarketId(value: string) {
  const bytes = new Uint8Array(16);
  bytes.set(new TextEncoder().encode(value));
  return bytes;
}

function hex32(value: string) {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error("Expected a 32-byte hex value.");
  return Uint8Array.from({ length: 32 }, (_, index) => Number.parseInt(value.slice(index * 2, index * 2 + 2), 16));
}
