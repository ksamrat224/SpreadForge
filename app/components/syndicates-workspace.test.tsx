import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyndicatesWorkspace } from "./syndicates-workspace";

const hook = vi.hoisted(() => vi.fn());
vi.mock("../lib/hooks/use-syndicates", () => ({ useSyndicates: hook }));

describe("Syndicates workspace", () => {
  beforeEach(() => {
    hook.mockReturnValue({
      programAddress: null,
      items: [],
      status: "disabled",
      error: null,
      busy: null,
      refresh: vi.fn(),
      claim: vi.fn(),
      create: vi.fn(),
      deposit: vi.fn(),
    });
  });

  it("fails closed when the dedicated program is not configured", () => {
    render(<SyndicatesWorkspace />);
    expect(screen.getByRole("region", { name: "Syndicates" })).toBeTruthy();
    expect(screen.getByText(/not enabled for this deployment/i)).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: /Claim 10,000 fUSD/i,
      }).disabled
    ).toBe(true);
  });

  it("renders decoded on-chain syndicates without inventing performance", () => {
    hook.mockReturnValue({
      programAddress: "Fg6PaFpoGXkYsidMpWxTWqkZ7FEfcYkgMQHGqkG8YfG",
      items: [
        {
          address: "11111111111111111111111111111111",
          trader: "Fg6PaFpoGXkYsidMpWxTWqkZ7FEfcYkgMQHGqkG8YfG",
          vault: "11111111111111111111111111111111",
          name: "Delta Forge",
          status: "live",
          vaultMicro: 25_000_000_000n,
          totalShares: 20_000_000_000n,
          backers: 8,
          sessions: 3,
          totalFeesMicro: 0n,
          maxDrawdownPercent: 4.25,
        },
      ],
      status: "ready",
      error: null,
      busy: null,
      refresh: vi.fn(),
      claim: vi.fn(),
      create: vi.fn(),
      deposit: vi.fn(),
    });
    render(<SyndicatesWorkspace />);
    expect(screen.getByText("Delta Forge")).toBeTruthy();
    expect(screen.getByText("LIVE ON ER")).toBeTruthy();
    expect(screen.getByText("25,000.00 fUSD")).toBeTruthy();
  });

  it("previews the vault transfer before a backer approves it", () => {
    hook.mockReturnValue({
      programAddress: "Fg6PaFpoGXkYsidMpWxTWqkZ7FEfcYkgMQHGqkG8YfG",
      items: [
        {
          address: "11111111111111111111111111111111",
          trader: "Fg6PaFpoGXkYsidMpWxTWqkZ7FEfcYkgMQHGqkG8YfG",
          vault: "11111111111111111111111111111111",
          name: "Delta Forge",
          status: "open",
          vaultMicro: 25_000_000_000n,
          totalShares: 20_000_000_000n,
          backers: 8,
          sessions: 3,
          totalFeesMicro: 0n,
          maxDrawdownPercent: 4.25,
        },
      ],
      status: "ready",
      error: null,
      busy: null,
      refresh: vi.fn(),
      claim: vi.fn(),
      create: vi.fn(),
      deposit: vi.fn(),
    });
    render(<SyndicatesWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Back trader" }));
    expect(
      screen.getByRole("dialog", { name: "Back Delta Forge" })
    ).toBeTruthy();
    expect(screen.getByText(/non-transferable shares/i)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Approve deposit" })
    ).toBeTruthy();
  });
});
