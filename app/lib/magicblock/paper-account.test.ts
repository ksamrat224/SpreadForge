import { describe, expect, it } from "vitest";
import { address } from "@solana/kit";
import { getPaperAccountSize, type PaperAccount, type PaperAccountArgs } from "../../generated/result_registry";
import { paperAccountToSnapshot, paperAssetIndex } from "./paper-account";

const AUTHORITY = address("FcrKifd5HL356zXZ8agnsMSyLdFZgox65Jxe4JTC3avr");
function account(): PaperAccountArgs {
  return {
    authority: AUTHORITY, schemaVersion: 1, bump: 255, createdAt: 0n, updatedAt: 0n,
    usdcCents: 1_000_000n, startEquityCents: 1_000_000n, realizedPnlCents: 0n, tradeCount: 1,
    tradeLogHash: new Uint8Array(32),
    positions: Array.from({ length: 20 }, () => ({ quantityMilli: 0n, inventoryCostCents: 0n })),
    recentFills: Array.from({ length: 16 }, () => ({ asset: 0, side: 0, feeCents: 0n, priceCents: 0n, sizeMilli: 0n, priceAt: 0n, executedAt: 0n })),
  };
}
describe("devnet paper portfolio", () => {
  it("uses the generated account layout and canonical asset ids", () => {
    expect(getPaperAccountSize()).toBeGreaterThan(1000);
    expect(paperAssetIndex("SOL")).toBe(2);
  });
  it("renders persisted balances and fills", () => {
    const value = account();
    value.positions[2] = { quantityMilli: 2_000n, inventoryCostCents: 30_000n };
    value.recentFills[0] = { asset: 2, side: 0, feeCents: 30n, priceCents: 15_000n, sizeMilli: 2_000n, priceAt: 1_800_000_000n, executedAt: 1_800_000_001n };
    const snapshot = paperAccountToSnapshot({ ...value, discriminator: new Uint8Array(8) } as PaperAccount);
    expect(snapshot.positions.SOL.quantityMilliAsset).toBe(2_000);
    expect(snapshot.trades[0]).toMatchObject({ asset: "SOL", source: "MARKET", priceCents: 15_000 });
  });
});
