import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaperTradingDesk } from "./paper-trading-desk";

const mocks = vi.hoisted(() => ({ trade: vi.fn(async () => null), open: vi.fn(async () => null) }));
vi.mock("./cluster-context", () => ({ useCluster: () => ({ cluster: "devnet", getExplorerUrl: (path: string) => `https://explorer.test${path}` }) }));
vi.mock("../lib/wallet/context", () => ({ useWallet: () => ({ wallet: { account: { address: "wallet-address" } } }) }));
vi.mock("../lib/hooks/use-balance", () => ({ useBalance: () => ({ lamports: 1_000_000_000n, isLoading: false, error: undefined }) }));
vi.mock("../lib/hooks/use-paper-chain", async () => {
  const { PAPER_ASSETS } = await import("../lib/simulation/paper");
  const positions = Object.fromEntries(PAPER_ASSETS.map((asset) => [asset, { quantityMilliAsset: 0, inventoryCostCents: 0 }]));
  return { usePaperChain: () => ({ status: "ready", address: "PaperAccount1111111111111111111111111111111", snapshot: { fundingSource: "fixed", usdcCents: 1_000_000, startEquityCents: 1_000_000, realizedPnlCents: 0, positions, trades: [] }, busy: null, error: null, lastSignature: null, available: true, unavailableReason: null, open: mocks.open, trade: mocks.trade, refresh: vi.fn() }) };
});
vi.mock("./interactive-market-chart", () => ({ InteractiveMarketChart: () => <div data-testid="market-chart" /> }));
function liveResponse(url: string) {
  if (url.includes("/history")) return { ok: false, json: async () => ({}) };
  if (url.includes("/book")) return { ok: true, json: async () => ({ source: "pyth", at: Date.now(), bids: [{ priceCents: 15_000, size: 1 }], asks: [{ priceCents: 15_100, size: 1 }] }) };
  return { ok: true, json: async () => ({ priceCents: 15_000, publishedAt: Date.now(), source: "pyth" }) };
}
afterEach(() => { cleanup(); mocks.trade.mockClear(); vi.unstubAllGlobals(); });
describe("on-chain paper trading", () => {
  it("presents a devnet-only durable portfolio", () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => liveResponse(url)));
    render(<PaperTradingDesk active={false} />);
    expect(screen.getByText("ON-CHAIN · DEVNET")).toBeTruthy();
    expect(screen.getByRole("region", { name: "On-chain paper portfolio" })).toBeTruthy();
    expect(screen.queryByText("LOCAL PRACTICE")).toBeNull();
  });
  it("does not expose the retired browser settlement modes", () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => liveResponse(url)));
    render(<PaperTradingDesk active={false} />);
    expect(screen.queryByText("MAGICBLOCK")).toBeNull();
    expect(screen.queryByText("LOCAL PRACTICE")).toBeNull();
  });
});
