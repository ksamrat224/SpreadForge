import { describe, expect, it } from "vitest";
import { hexToBytes } from "./registry";

describe("result registry client boundary", () => {
  it("converts only complete SHA-256 hex commitments to 32-byte values", () => {
    expect(hexToBytes("ab".repeat(32))).toEqual(new Uint8Array(32).fill(171));
    expect(() => hexToBytes("abc")).toThrow(/32 bytes/);
    expect(() => hexToBytes("zz".repeat(32))).toThrow(/32 bytes/);
  });
});
