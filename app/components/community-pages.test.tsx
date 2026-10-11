import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Leaderboard } from "./community-pages";

const mocks = vi.hoisted(() => ({
  listRecords: vi.fn(async () => []),
  listPaper: vi.fn(async () => ({
    entries: [
      {
        walletAddress: "FcrKifd5HL356zXZ8agnsMSyLdFZgox65Jxe4JTC3avr",
        returnBps: 250,
        equityCents: 1_025_000,
        realizedPnlCents: 12_500,
        tradeCount: 3,
        lastActivityAt: 1_800_000_000,
      },
    ],
    excludedUnpricedPortfolios: 1,
  })),
}));

vi.mock("./cluster-context", () => ({
  useCluster: () => ({ cluster: "devnet" }),
}));
vi.mock("../lib/results/registry", () => ({
  getResultRegistryProgramAddress: () =>
    "2EXN7tmfAekEn2Noq8j8AkVx9bTi96zuakHUKSsW4u9w",
}));
vi.mock("../lib/leaderboard", () => ({
  LOCAL_RUNS_UPDATED_EVENT: "local-runs-updated",
  clearLocalRuns: vi.fn(),
  listLocalRuns: () => [],
  createRpcLeaderboardRepository: () => ({ listRecords: mocks.listRecords }),
  createRpcPaperLeaderboardRepository: () => ({ list: mocks.listPaper }),
  getSupportedScenarioHashes: async () => ({}),
  rankRecords: () => [],
}));

afterEach(() => {
  cleanup();
  mocks.listRecords.mockClear();
  mocks.listPaper.mockClear();
});

describe("Leaderboard", () => {
  it("keeps strategy rankings as the default view and loads paper rankings only after switching", async () => {
    render(<Leaderboard />);
    expect(
      screen.getByRole("heading", { name: "Strategy leaderboard" })
    ).toBeTruthy();
    expect(screen.getByText("Your local runs")).toBeTruthy();
    expect(mocks.listPaper).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Paper trading" }));

    expect(
      await screen.findByRole("heading", { name: "Paper trading leaderboard" })
    ).toBeTruthy();
    await waitFor(() => expect(mocks.listPaper).toHaveBeenCalledOnce());
    expect(screen.getByText("Paper-trading rankings")).toBeTruthy();
    expect(screen.getByText("+2.50%")).toBeTruthy();
    expect(screen.getByText("$10,250.00")).toBeTruthy();
    expect(screen.getByText(/temporarily unranked/i)).toBeTruthy();
  });
});
