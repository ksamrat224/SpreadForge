import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaperTradingDesk } from "./paper-trading-desk";

const mocks = vi.hoisted(() => ({
  cluster: "devnet",
  wallet: undefined as { account: { address: string } } | undefined,
  balance: null as bigint | null,
  loading: false,
  error: undefined as unknown,
  chainTrade: vi.fn<(order: unknown) => Promise<string | null>>(
    async () => null
  ),
  chainEnabled: false,
}));

vi.mock("./cluster-context", () => ({
  useCluster: () => ({
    cluster: mocks.cluster,
    getExplorerUrl: (path: string) => `https://explorer.test${path}`,
  }),
}));
vi.mock("../lib/hooks/use-paper-chain", async () => {
  const { PAPER_ASSETS } = await import("../lib/simulation/paper");
  const positions = Object.fromEntries(
    PAPER_ASSETS.map((asset) => [
      asset,
      { quantityMilliAsset: asset === "SOL" ? 2_000 : 0, inventoryCostCents: asset === "SOL" ? 30_000 : 0 },
    ])
  );
  const snapshot = {
    fundingSource: "fixed",
    usdcCents: 970_000,
    startEquityCents: 1_000_000,
    realizedPnlCents: 0,
    positions,
    trades: [],
  };
  return {
    usePaperChain: (enabled: boolean) => {
      mocks.chainEnabled = enabled;
      return {
        status: enabled ? "delegated" : "unavailable",
        address: enabled ? "PaperAccount1111111111111111111111111111111" : null,
        nonce: enabled ? 0n : null,
        erEndpoint: enabled ? "https://devnet-as.magicblock.app/" : null,
        snapshot: enabled ? snapshot : null,
        busy: null,
        error: null,
        lastSignature: null,
        available: enabled,
        unavailableReason: null,
        open: vi.fn(),
        resume: vi.fn(),
        settle: vi.fn(),
        refresh: vi.fn(),
        trade: mocks.chainTrade,
      };
    },
  };
});
vi.mock("../lib/wallet/context", () => ({
  useWallet: () => ({ wallet: mocks.wallet }),
}));
vi.mock("../lib/hooks/use-balance", () => ({
  useBalance: () => ({
    lamports: mocks.balance,
    isLoading: mocks.loading,
    error: mocks.error,
  }),
}));
vi.mock("./interactive-market-chart", () => ({
  InteractiveMarketChart: () => <div data-testid="market-chart" />,
}));

function liveResponse(url: string) {
  if (url.includes("/history"))
    return { ok: false, json: async () => ({}) };
  if (url.includes("/book"))
    return {
      ok: true,
      json: async () => ({
        source: "pyth",
        at: Date.now(),
        bids: [{ priceCents: 15_000, size: 1 }],
        asks: [{ priceCents: 15_100, size: 1 }],
      }),
    };
  return {
    ok: true,
    json: async () => ({
      priceCents: 15_000,
      publishedAt: Date.now(),
      source: "pyth",
    }),
  };
}

afterEach(() => {
  cleanup();
  mocks.cluster = "devnet";
  mocks.wallet = undefined;
  mocks.balance = null;
  mocks.loading = false;
  mocks.error = undefined;
  vi.unstubAllGlobals();
});

describe("Devnet wallet practice", () => {
  it("keeps fixed practice available when no devnet wallet is connected", () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => liveResponse(url)));
    render(<PaperTradingDesk active={false} />);
    expect(screen.getByText(/Connect a devnet wallet/)).toBeTruthy();
    expect(
      (screen.getByRole("button", {
        name: "Start wallet-backed practice",
      }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.getByText("Simulated buying power")).toBeTruthy();
  });

  it("shows the flow only on devnet and starts a virtual-SOL session", async () => {
    mocks.wallet = { account: { address: "wallet-address" } };
    mocks.balance = 3_000_000_000n;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => liveResponse(url)));
    render(<PaperTradingDesk />);
    const start = await screen.findByRole("button", {
      name: "Start wallet-backed practice",
    });
    await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(start);
    expect(screen.getByText(/Convert 3 virtual SOL/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Convert to \$450\.00 USDC/ })
    ).toBeTruthy();

    cleanup();
    mocks.cluster = "mainnet";
    render(<PaperTradingDesk active={false} />);
    expect(
      screen.queryByRole("region", { name: "Devnet wallet practice" })
    ).toBeNull();
  });
});

describe("On-chain settlement", () => {
  it("routes trades to a wallet-signed MagicBlock transaction and shows chain balances", async () => {
    mocks.wallet = { account: { address: "wallet-address" } };
    mocks.chainTrade.mockClear();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => liveResponse(url)));
    render(<PaperTradingDesk />);
    expect(mocks.chainEnabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "ON-CHAIN · MAGICBLOCK" }));
    expect(
      screen.getByRole("region", { name: "On-chain paper account" })
    ).toBeTruthy();
    expect(mocks.chainEnabled).toBe(true);
    // Balances come from the account, not the local 10,000 USDC practice.
    expect(await screen.findByText("$9,700.00")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset portfolio" })).toBeNull();

    const buy = await screen.findByRole("button", { name: /Buy 0\.007 SOL/ });
    await waitFor(() => expect((buy as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(buy);
    expect(mocks.chainTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        asset: "SOL",
        side: "buy",
        source: "MARKET",
        priceCents: 15_000,
        sizeMilliAsset: 7,
      })
    );
    // Nothing fills locally; the fill appears only after the chain read.
    expect(screen.getByText(/Your first trade starts the story/)).toBeTruthy();
  });
});

describe("Live reference failure states", () => {
  it("keeps historical candles visible without presenting the seeded price as live", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/history"))
          return {
            ok: true,
            json: async () => ({
              source: "coinbase",
              intervalSeconds: 3600,
              candles: [
                {
                  at: Date.now() - 3600_000,
                  openCents: 12_000,
                  highCents: 15_000,
                  lowCents: 11_000,
                  priceCents: 14_000,
                  volume: 1,
                },
              ],
            }),
          };
        return { ok: false, json: async () => ({}) };
      })
    );
    render(<PaperTradingDesk />);
    expect(
      await screen.findByText("LIVE QUOTE UNAVAILABLE")
    ).toBeTruthy();
    expect(screen.getByText("HISTORICAL CHART ONLY")).toBeTruthy();
    expect(
      screen.getByText(/CURRENT QUOTE UNAVAILABLE · HISTORICAL DATA ONLY/)
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry live quote" })).toBeTruthy();
    expect(screen.queryByText("$146.820")).toBeNull();
  });
});
