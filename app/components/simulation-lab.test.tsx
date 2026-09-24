import {
  act,
  fireEvent,
  render,
  screen,
  cleanup,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { runSimulation, SCENARIOS, DEFAULT_STRATEGY } from "../lib/simulation";
import {
  SimulationLab,
  PriceChart,
  Results,
  ChallengeDrawer,
} from "./simulation-lab";
import { Providers } from "./providers";

function renderWithProviders(ui: ReactNode) {
  return render(<Providers>{ui}</Providers>);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("Terminal strategy workspace", () => {
  it("starts directly in the lab and exposes all strategy controls", () => {
    renderWithProviders(<SimulationLab />);
    expect(screen.getByRole("heading", { name: "Quote & Risk" })).toBeTruthy();
    expect(
      (screen.getByRole("slider", { name: "Spread" }) as HTMLInputElement).value
    ).toBe("30");
    fireEvent.change(screen.getByRole("slider", { name: "Refresh cycle" }), {
      target: { value: "5" },
    });
    expect(
      (
        screen.getByRole("slider", {
          name: "Refresh cycle",
        }) as HTMLInputElement
      ).value
    ).toBe("5");
  });
  it("pauses without advancing and resets a started session", () => {
    vi.useFakeTimers();
    renderWithProviders(<SimulationLab />);
    fireEvent.click(screen.getByRole("button", { name: "Start Challenge" }));
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByText("RUNNING")).toBeTruthy();
    expect(
      (screen.getByRole("slider", { name: "Spread" }) as HTMLInputElement)
        .disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const before = screen.getByRole("log").textContent;
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("log").textContent).toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Reset simulation" }));
    expect(screen.getByText("IDLE")).toBeTruthy();
  });
  it("completes at tick 60 and opens a dismissible result dialog", () => {
    vi.useFakeTimers();
    renderWithProviders(<SimulationLab />);
    fireEvent.click(screen.getByRole("button", { name: "5×" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Challenge" }));
    act(() => {
      vi.advanceTimersByTime(4800);
    });
    expect(
      screen.getByRole("dialog", { name: "Session debrief" })
    ).toBeTruthy();
    expect(screen.getByText("CHALLENGE COMPLETE")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Run again" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("IDLE")).toBeTruthy();
  });
  it("renders every fill from the actual deterministic result", () => {
    const result = runSimulation(SCENARIOS["whale-sell"], DEFAULT_STRATEGY);
    const { container } = renderWithProviders(
      <PriceChart state={result.state} scenario={result.scenario} />
    );
    expect(container.querySelectorAll("circle title")).toHaveLength(
      result.state.fills.length
    );
  });
  it("switches between price and market-making chart views", () => {
    renderWithProviders(<SimulationLab />);
    fireEvent.click(screen.getByRole("button", { name: "Strategy Lab chart view" }));
    fireEvent.click(screen.getByRole("option", { name: "Candles" }));
    expect(
      screen.getByRole("img", { name: "Candlestick price chart" })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zoom in chart" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fit" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Strategy Lab chart view" }));
    fireEvent.click(screen.getByRole("option", { name: "Inventory" }));
    expect(screen.getByRole("img", { name: "Inventory (SOL)" })).toBeTruthy();
  });
  it("selects the advanced challenge from the drawer", () => {
    const select = vi.fn(),
      close = vi.fn();
    renderWithProviders(
      <ChallengeDrawer
        selected="whale-sell"
        onSelect={select}
        onClose={close}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Flash Crash & Recovery/ })
    );
    expect(select).toHaveBeenCalledWith("flash-crash");
    expect(close).toHaveBeenCalledOnce();
  });
  it("saves hashes locally and never claims that local verification is on-chain", async () => {
    const result = runSimulation(SCENARIOS["stable-market"], DEFAULT_STRATEGY);
    const view = renderWithProviders(
      <Results
        scenario={result.scenario}
        strategy={DEFAULT_STRATEGY}
        state={result.state}
        breakdown={result.score}
        pnlCents={0}
        runId="test-result-run"
        onAgain={vi.fn()}
        onChallenges={vi.fn()}
      />
    );
    const query = within(view.container);
    expect(await query.findByText(/Result hashed locally/)).toBeTruthy();
    expect(query.getByText("Result hash")).toBeTruthy();
    expect(query.queryByText("Verified on Solana Devnet")).toBeNull();
  });
});
