import { describe, expect, it } from "vitest";
import {
  calculateSettlement,
  sharesForDeposit,
  tokensForWithdrawal,
} from "./economics";

describe("syndicate economics", () => {
  it("mints shares proportionally and leaves rounding dust in the vault", () => {
    expect(sharesForDeposit(500n, 1_000n, 2_000n)).toBe(250n);
    expect(sharesForDeposit(1n, 3n, 10n)).toBe(0n);
  });

  it("redeems shares against current vault NAV", () => {
    expect(tokensForWithdrawal(250n, 1_250n, 2_500n)).toBe(500n);
  });

  it("charges ten percent only above the high-water mark", () => {
    const first = calculateSettlement({
      startingEquity: 1_000n,
      endingEquity: 1_200n,
      totalShares: 1_000n,
      highWaterPriceE6: 1_000_000n,
    });
    expect(first).toEqual({
      mintAmount: 200n,
      burnAmount: 0n,
      feeAmount: 20n,
      nextHighWaterPriceE6: 1_180_000n,
    });
    expect(
      calculateSettlement({
        startingEquity: 1_000n,
        endingEquity: 1_100n,
        totalShares: 1_000n,
        highWaterPriceE6: 1_180_000n,
      }).feeAmount
    ).toBe(0n);
  });

  it("burns a loss without lowering the high-water mark", () => {
    expect(
      calculateSettlement({
        startingEquity: 1_000n,
        endingEquity: 800n,
        totalShares: 1_000n,
        highWaterPriceE6: 1_100_000n,
      })
    ).toEqual({
      mintAmount: 0n,
      burnAmount: 200n,
      feeAmount: 0n,
      nextHighWaterPriceE6: 1_100_000n,
    });
  });
});
