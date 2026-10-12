import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RankedStrategyLab } from "./ranked-strategy-lab";
import type { RankedRun } from "../generated/result_registry";

const mocks = vi.hoisted(() => ({
  enabled: true,
  execute: vi.fn(),
}));
vi.mock("../lib/wallet/context", () => ({
  useWallet: () => ({
    signer: { address: "11111111111111111111111111111111" },
  }),
}));
vi.mock("./cluster-context", () => ({
  useCluster: () => ({ cluster: "devnet" }),
}));
vi.mock("../lib/results/registry", () => ({
  getResultRegistryProgramAddress: () =>
    "2EXN7tmfAekEn2Noq8j8AkVx9bTi96zuakHUKSsW4u9w",
}));
vi.mock("../lib/magicblock/ranked-run", () => ({
  isMagicBlockRankedRunsEnabled: () => mocks.enabled,
  startAndExecuteRankedRun: mocks.execute,
}));
vi.mock("./interactive-market-chart", () => ({
  InteractiveMarketChart: ({
    samples,
  }: {
    samples: Array<{ time: number; value: number }>;
  }) => (
    <div data-testid="ranked-price-chart">
      {samples.map((sample) => `${sample.time}:${sample.value}`).join(",")}
    </div>
  ),
}));

function account(tick: number, fillCount = 0): RankedRun {
  return {
    tick,
    status: tick === 60 ? 2 : 1,
    finalScore: tick === 60 ? 8123 : 0,
    referencePriceCents: BigInt(10_000 + tick * 100),
    bidCents: 9_900n,
    askCents: 10_100n,
    hasBuyOrder: true,
    hasSellOrder: false,
    baseMilli: 100_000n,
    inventoryCostCents: 1_000_000n,
    equityCents: 6_500_000n,
    startingEquityCents: 6_000_000n,
    realizedPnlCents: 20_000n,
    maxDrawdownBps: 100,
    liquidityTicks: tick,
    fillCount,
  } as RankedRun;
}

afterEach(() => {
  cleanup();
  mocks.execute.mockReset();
  mocks.enabled = true;
});

describe("ranked Strategy Lab", () => {
  it("gates runs until the devnet MagicBlock path is enabled", () => {
    mocks.enabled = false;
    render(<RankedStrategyLab />);
    expect(
      (
        screen.getByRole("button", {
          name: "Start ranked run",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(screen.getByText(/Ranked runs require devnet/)).toBeTruthy();
  });

  it("shows settled account values only after the on-chain runner returns", async () => {
    mocks.execute.mockImplementation(
      async ({ onStage, onTick, onSnapshot }) => {
        onStage("approval", "11111111111111111111111111111111");
        onStage("executing", "11111111111111111111111111111111");
        onSnapshot(account(0));
        onSnapshot(account(1, 1));
        onTick(1);
        onTick(60);
        onStage("settling", "11111111111111111111111111111111");
        return {
          runAddress: "11111111111111111111111111111111",
          run: account(60, 6),
        };
      }
    );
    render(<RankedStrategyLab />);
    expect(screen.queryByText("8,123 / 10,000")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start ranked run" }));
    await waitFor(() =>
      expect(screen.getByText("8,123 / 10,000")).toBeTruthy()
    );
    expect(
      screen.getByText(/Settled and verified on Solana devnet/)
    ).toBeTruthy();
    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(screen.getByTestId("ranked-price-chart").textContent).toBe(
      "0:100,1:101"
    );
    expect(
      screen.getByText(/\+1 program-reported fill since last account read/)
    ).toBeTruthy();
  });

  it("keeps the chart empty and the score pending when a tick has no account snapshot", async () => {
    mocks.execute.mockImplementation(({ onStage, onTick }) => {
      onStage("executing", "11111111111111111111111111111111");
      onTick(1);
      return new Promise(() => {});
    });
    render(<RankedStrategyLab />);
    fireEvent.click(screen.getByRole("button", { name: "Start ranked run" }));
    await waitFor(() =>
      expect(
        screen.getByText(/Waiting for the latest account snapshot/)
      ).toBeTruthy()
    );
    expect(screen.queryByTestId("ranked-price-chart")).toBeNull();
    expect(screen.getByText("PENDING SETTLEMENT")).toBeTruthy();
    expect(
      (screen.getByRole("slider", { name: "Spread" }) as HTMLInputElement)
        .disabled
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Scenario" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
