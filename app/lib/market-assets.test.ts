import { describe, expect, it } from "vitest";
import { getMarketAsset } from "./market-assets";

describe("approved paper-market catalogue", () => {
  it("maps only BTC, ETH, and SOL to trusted price providers", () => {
    expect(getMarketAsset("btc-usd")?.asset).toBe("BTC");
    expect(getMarketAsset("eth-usd")?.asset).toBe("ETH");
    expect(getMarketAsset("sol-usd")?.asset).toBe("SOL");
  });
  it("rejects unknown route values instead of constructing provider URLs", () => {
    expect(getMarketAsset("hype-usd")).toBeNull();
    expect(getMarketAsset("../../etc/passwd")).toBeNull();
  });
});
