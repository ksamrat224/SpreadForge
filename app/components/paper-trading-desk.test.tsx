import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaperTradingDesk } from "./paper-trading-desk";

vi.mock("./interactive-market-chart", () => ({
  InteractiveMarketChart: () => <div data-testid="market-chart" />,
}));
vi.mock("../lib/wallet/context", () => ({
  useWallet: () => ({ wallet: undefined }),
}));
vi.mock("./cluster-context", () => ({
  useCluster: () => ({ cluster: "devnet", setCluster: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("on-chain paper-trading gate", () => {
  it("does not render browser-only execution before a wallet is connected", () => {
    render(<PaperTradingDesk />);
    expect(screen.getByText("Create your paper portfolio")).toBeTruthy();
    expect(screen.getByText(/Connect a devnet wallet/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /buy/i })).toBeNull();
  });
});
