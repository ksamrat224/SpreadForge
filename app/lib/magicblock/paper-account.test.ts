import { afterEach, describe, expect, it, vi } from "vitest";
import { address, createNoopSigner } from "@solana/kit";
import {
  getPaperAccountEncoder,
  getPaperAccountSize,
  RESULT_REGISTRY_ERROR__STALE_PAPER_PRICE,
  type PaperAccountArgs,
} from "../../generated/result_registry";
import {
  canSignForRollup,
  DELEGATION_PROGRAM_ADDRESS,
  describeProgramError,
  paperAccountToSnapshot,
  paperAssetIndex,
  readPaperAccount,
} from "./paper-account";

const AUTHORITY = address("FcrKifd5HL356zXZ8agnsMSyLdFZgox65Jxe4JTC3avr");
const PROGRAM = address("2EXN7tmfAekEn2Noq8j8AkVx9bTi96zuakHUKSsW4u9w");

function account(overrides: Partial<PaperAccountArgs> = {}): PaperAccountArgs {
  return {
    authority: AUTHORITY,
    nonce: 0n,
    fundingSource: 0,
    schemaVersion: 1,
    bump: 255,
    createdAt: 0n,
    updatedAt: 0n,
    usdcCents: 1_000_000n,
    startEquityCents: 1_000_000n,
    realizedPnlCents: 0n,
    tradeCount: 0,
    tradeLogHash: new Uint8Array(32),
    positions: Array.from({ length: 20 }, () => ({
      quantityMilli: 0n,
      inventoryCostCents: 0n,
    })),
    recentFills: Array.from({ length: 16 }, () => ({
      asset: 0,
      side: 0,
      source: 0,
      priceCents: 0n,
      sizeMilli: 0n,
      priceAtMs: 0n,
      executedAt: 0n,
    })),
    ...overrides,
  };
}

function decoded(args: PaperAccountArgs) {
  return {
    ...args,
    discriminator: new Uint8Array(8),
  } as Parameters<typeof paperAccountToSnapshot>[0];
}

afterEach(() => vi.unstubAllGlobals());

describe("on-chain paper account", () => {
  it("matches the program's 1,007-byte account layout", () => {
    expect(getPaperAccountSize()).toBe(1007);
    expect(paperAssetIndex("SOL")).toBe(2);
  });

  it("reads balances and the ring of recent fills newest first", () => {
    const fills = account().recentFills.map((fill, slot) => ({
      ...fill,
      asset: 2,
      side: slot % 2,
      source: 1,
      priceCents: BigInt(15_000 + slot),
      sizeMilli: 1_000n,
      priceAtMs: BigInt(1_800_000_000_000 + slot),
    }));
    const positions = account().positions;
    positions[2] = { quantityMilli: 2_500n, inventoryCostCents: 37_500n };
    // 18 trades: slots 0 and 1 were overwritten by trades 17 and 18.
    const snapshot = paperAccountToSnapshot(
      decoded(
        account({
          tradeCount: 18,
          recentFills: fills,
          positions,
          realizedPnlCents: -42n,
        })
      )
    );

    expect(snapshot.positions.SOL).toEqual({
      quantityMilliAsset: 2_500,
      inventoryCostCents: 37_500,
    });
    expect(snapshot.realizedPnlCents).toBe(-42);
    expect(snapshot.trades).toHaveLength(16);
    expect(snapshot.trades[0]).toMatchObject({
      id: 18,
      asset: "SOL",
      side: "sell",
      source: "LIMIT",
      priceCents: 15_001,
      at: 1_800_000_000_001,
    });
    expect(snapshot.trades[15].id).toBe(3);
  });

  it("decodes a base account and ignores the delegated copy", async () => {
    const data = getPaperAccountEncoder().encode(
      account({ fundingSource: 1, usdcCents: 0n })
    );
    let owner: string = PROGRAM;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              result: {
                context: { slot: 1 },
                value: {
                  data: [btoa(String.fromCharCode(...data)), "base64"],
                  executable: false,
                  lamports: 1,
                  owner,
                  rentEpoch: 0,
                  space: data.length,
                },
              },
            })
          )
      )
    );

    const base = await readPaperAccount("https://rpc.test", AUTHORITY);
    expect(base?.account?.fundingSource).toBe(1);
    expect(paperAccountToSnapshot(base!.account!).fundingSource).toBe("wallet");

    owner = DELEGATION_PROGRAM_ADDRESS;
    const delegated = await readPaperAccount("https://rpc.test", AUTHORITY);
    expect(delegated).toEqual({
      owner: DELEGATION_PROGRAM_ADDRESS,
      account: null,
    });
  });

  it("explains registry errors and wallet rejections", () => {
    const hex = RESULT_REGISTRY_ERROR__STALE_PAPER_PRICE.toString(16);
    expect(
      describeProgramError(
        new Error(`Transaction failed: custom program error: 0x${hex}`)
      )
    ).toBe("The reference price is too old or too far in the future.");
    expect(
      describeProgramError(
        JSON.stringify({
          InstructionError: [
            0,
            { Custom: RESULT_REGISTRY_ERROR__STALE_PAPER_PRICE },
          ],
        })
      )
    ).toBe("The reference price is too old or too far in the future.");
    expect(describeProgramError(new Error("User rejected the request."))).toBe(
      "The wallet request was rejected."
    );
  });

  it("requires a wallet that can sign without broadcasting", () => {
    expect(canSignForRollup(createNoopSigner(AUTHORITY))).toBe(true);
    expect(
      canSignForRollup({
        address: AUTHORITY,
        signAndSendTransactions: async () => [],
      })
    ).toBe(false);
  });
});
