import { address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  getPriceUpdateV2Encoder,
  type PaperAccount,
  type PaperAccountArgs,
} from "../../generated/result_registry";
import { PAPER_PYTH_FEEDS } from "../paper-oracle";
import { decodePaperOraclePrice, rankPaperPortfolios } from "./index";

const START = 1_000_000n;
const NOW = 1_800_000_000;
const PYTH_OWNER = "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";

function hexBytes(value: string) {
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16)
  );
}

function base64(value: Uint8Array) {
  return btoa(String.fromCharCode(...value));
}

function account({
  wallet = "FcrKifd5HL356zXZ8agnsMSyLdFZgox65Jxe4JTC3avr",
  cash = START,
  trades = 1,
  updatedAt = BigInt(NOW),
}: {
  wallet?: string;
  cash?: bigint;
  trades?: number;
  updatedAt?: bigint;
} = {}): PaperAccount {
  const value: PaperAccountArgs = {
    authority: address(wallet),
    schemaVersion: 1,
    bump: 255,
    createdAt: 0n,
    updatedAt,
    usdcCents: cash,
    startEquityCents: START,
    realizedPnlCents: 2_500n,
    tradeCount: trades,
    tradeLogHash: new Uint8Array(32),
    positions: Array.from({ length: 20 }, () => ({
      quantityMilli: 0n,
      inventoryCostCents: 0n,
    })),
    recentFills: Array.from({ length: 16 }, () => ({
      asset: 0,
      side: 0,
      feeCents: 0n,
      priceCents: 0n,
      sizeMilli: 0n,
      priceAt: 0n,
      executedAt: 0n,
    })),
  };
  return { ...value, discriminator: new Uint8Array(8) } as PaperAccount;
}

function oracle({
  asset = "ETH",
  price = 2_000_000_000n,
  exponent = -6,
  publishTime = BigInt(NOW),
  owner = PYTH_OWNER,
  feedId = PAPER_PYTH_FEEDS.ETH,
}: {
  asset?: "ETH" | "SOL";
  price?: bigint;
  exponent?: number;
  publishTime?: bigint;
  owner?: string;
  feedId?: string;
} = {}) {
  const encoded = getPriceUpdateV2Encoder().encode({
    writeAuthority: address("FcrKifd5HL356zXZ8agnsMSyLdFZgox65Jxe4JTC3avr"),
    verificationLevel: { __kind: "Full" },
    priceMessage: {
      feedId: hexBytes(feedId),
      price,
      conf: 1n,
      exponent,
      publishTime,
      prevPublishTime: publishTime - 1n,
      emaPrice: price,
      emaConf: 1n,
    },
    postedSlot: 1n,
  });
  return {
    asset,
    account: {
      owner,
      data: [
        base64(new Uint8Array([...new Uint8Array(8), ...encoded])),
        "base64",
      ] as const,
    },
  };
}

describe("paper leaderboard ranking", () => {
  it("values cash and multiple milli-asset positions in cents", () => {
    const portfolio = account({ cash: 900_000n });
    portfolio.positions[1].quantityMilli = 500n;
    portfolio.positions[2].quantityMilli = 1_000n;
    const result = rankPaperPortfolios({
      portfolios: [{ address: "portfolio", account: portfolio }],
      prices: {
        ETH: { asset: "ETH", priceCents: 200_000n, publishedAt: NOW },
        SOL: { asset: "SOL", priceCents: 15_000n, publishedAt: NOW },
      },
    });
    expect(result.entries[0]).toMatchObject({
      equityCents: 1_015_000,
      returnBps: 150,
    });
  });

  it("excludes no-trade and unpriced portfolios", () => {
    const untouched = account({ trades: 0 });
    const unpriced = account();
    unpriced.positions[2].quantityMilli = 1_000n;
    const result = rankPaperPortfolios({
      portfolios: [
        { address: "untouched", account: untouched },
        { address: "unpriced", account: unpriced },
      ],
      prices: {},
    });
    expect(result.entries).toEqual([]);
    expect(result.excludedUnpricedPortfolios).toBe(1);
  });

  it("sorts by return, equity, activity, then wallet", () => {
    const first = account({
      wallet: "FcrKifd5HL356zXZ8agnsMSyLdFZgox65Jxe4JTC3avr",
      cash: 1_010_000n,
      updatedAt: 1n,
    });
    const second = account({
      wallet: "9xQeWvG816bUx9EPfEZqDqWqBTyQ4A5FR4YcJbVez5x",
      cash: 1_010_000n,
      updatedAt: 2n,
    });
    const result = rankPaperPortfolios({
      portfolios: [
        { address: "one", account: first },
        { address: "two", account: second },
      ],
      prices: {},
    });
    expect(result.entries.map((entry) => entry.walletAddress)).toEqual([
      second.authority,
      first.authority,
    ]);
  });

  it("rejects stale, malformed, wrong-feed, and non-positive oracle values", () => {
    expect(decodePaperOraclePrice("ETH", oracle().account, NOW)).toMatchObject({
      priceCents: 200_000n,
    });
    expect(
      decodePaperOraclePrice(
        "ETH",
        oracle({ publishTime: BigInt(NOW - 31) }).account,
        NOW
      )
    ).toBeNull();
    expect(
      decodePaperOraclePrice(
        "ETH",
        oracle({ feedId: PAPER_PYTH_FEEDS.SOL }).account,
        NOW
      )
    ).toBeNull();
    expect(
      decodePaperOraclePrice("ETH", oracle({ price: 0n }).account, NOW)
    ).toBeNull();
    expect(
      decodePaperOraclePrice(
        "ETH",
        { owner: PYTH_OWNER, data: ["not-base64", "base64"] },
        NOW
      )
    ).toBeNull();
  });
});
