import { describe, expect, it } from "vitest";
import { parseDelegationStatus } from "./router";

describe("MagicBlock router boundary", () => {
  it("accepts only delegated results with a valid router-selected ER endpoint", () => {
    expect(
      parseDelegationStatus({
        jsonrpc: "2.0",
        result: { isDelegated: true, fqdn: "devnet-as.magicblock.app" },
      })
    ).toEqual({
      isDelegated: true,
      erEndpoint: "https://devnet-as.magicblock.app/",
    });
  });

  it("rejects malformed router responses instead of trusting them", () => {
    expect(() =>
      parseDelegationStatus({ result: { isDelegated: true } })
    ).toThrow(/invalid ER endpoint/i);
    expect(() => parseDelegationStatus({ result: {} })).toThrow(
      /missing delegation/i
    );
  });
});
