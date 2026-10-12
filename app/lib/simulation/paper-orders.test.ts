import { describe, expect, it } from "vitest";
import {
  milliAssetForNotional,
  minimumOrderNotionalCents,
  orderNotionalCents,
} from "./paper-orders";

describe("paper market orders", () => {
  it("converts USD presets to the nearest 0.001 asset and reports actual notional", () => {
    expect(milliAssetForNotional(2500, 20_000)).toBe(125);
    expect(orderNotionalCents(125, 20_000)).toBe(2500);
  });
  it("rejects invalid amounts and exposes the minimum notional", () => {
    expect(milliAssetForNotional(0, 2_000_000)).toBe(0);
    expect(minimumOrderNotionalCents(2_000_000)).toBe(2000);
  });
});
