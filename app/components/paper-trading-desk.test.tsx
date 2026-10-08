import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaperTradingDesk } from "./paper-trading-desk";

const mocks = vi.hoisted(() => ({
  cluster: "devnet",
  wallet: undefined as { account: { address: string } } | undefined,
  balance: null as bigint | null,
  loading: false,
  error: undefined as unknown,
}));

vi.mock("./cluster-context", () => ({
  useCluster: () => ({ cluster: mocks.cluster }),
}));
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
