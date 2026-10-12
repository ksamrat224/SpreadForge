import { address, type KeyPairSigner } from "@solana/kit";
import { describe, expect, it, vi } from "vitest";
import { executeRankedRun } from "./ranked-run";

const mocks = vi.hoisted(() => ({ sendTransaction: vi.fn() }));
vi.mock("@solana/kit-client-rpc", () => ({
  createClient: () => ({ sendTransaction: mocks.sendTransaction }),
}));

describe("ranked-run account snapshots", () => {
  it("continues through all confirmed ticks when one presentation read fails", async () => {
    let sent = 0;
    mocks.sendTransaction.mockImplementation(async () => {
      sent += 1;
      return { context: { signature: `signature-${sent}` } };
    });
    const readAccount = vi
      .fn()
      .mockResolvedValueOnce({ status: 1, tick: 0 })
      .mockRejectedValueOnce(new Error("temporary ER read failure"))
      .mockImplementation(async () => ({ status: 1, tick: sent }));
    const snapshots: number[] = [];
    const ticks: number[] = [];
    const result = await executeRankedRun({
      runAddress: address("11111111111111111111111111111111"),
      sessionSigner: {
        address: address("11111111111111111111111111111111"),
      } as KeyPairSigner,
      erEndpoint: "https://example.test",
      programAddress: address("2EXN7tmfAekEn2Noq8j8AkVx9bTi96zuakHUKSsW4u9w"),
      readAccount:
        readAccount as unknown as typeof import("./ranked-run").readRankedRun,
      onTick: (tick) => ticks.push(tick),
      onSnapshot: (snapshot) => snapshots.push(snapshot.tick),
    });
    expect(result.tickSignatures).toHaveLength(60);
    expect(result.finalizeSignature).toBe("signature-61");
    expect(ticks).toHaveLength(60);
    expect(snapshots).toEqual([
      0,
      ...Array.from({ length: 59 }, (_, index) => index + 2),
    ]);
    expect(readAccount).toHaveBeenCalledTimes(61);
    mocks.sendTransaction.mockReset();
  });
});
