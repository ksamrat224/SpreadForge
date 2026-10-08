import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaperTradingDesk } from "./paper-trading-desk";

vi.mock("./interactive-market-chart", () => ({
  InteractiveMarketChart: () => <div data-testid="market-chart" />,
}));
vi.mock("../lib/wallet/context", () => ({
  useWallet: () => ({ wallet: undefined }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("on-chain paper-trading gate", () => {
  it("does not render browser-only execution before the private ER runtime exists", () => {
    render(<PaperTradingDesk />);
    expect(screen.getByText("Trading is temporarily disabled")).toBeTruthy();
    expect(screen.getByText(/disappeared on refresh/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /buy/i })).toBeNull();
  });
});
