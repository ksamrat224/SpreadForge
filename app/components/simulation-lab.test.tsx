import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSimulation, SCENARIOS, DEFAULT_STRATEGY } from "../lib/simulation";
import { scoreRun } from "../lib/simulation/score";
import { SimulationLab, PriceChart, Results } from "./simulation-lab";

vi.mock("../lib/wallet/context", () => ({
  useWallet: () => ({ status: "disconnected" }),
}));

describe("Challenge Lab UI", () => {
  beforeEach(() => localStorage.clear());

  it("moves from the guided entry to the strategy lab", () => {
    render(<SimulationLab />);
    expect(screen.getByText("Learn in three simple steps.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start challenge" }));
    expect(
      screen.getByRole("heading", { name: "Quote controls" })
    ).toBeTruthy();
  });

  it("renders fill markers from deterministic simulation data", () => {
    const result = runSimulation(SCENARIOS["whale-sell"], DEFAULT_STRATEGY);
    render(<PriceChart state={result.state} scenario={result.scenario} />);
    expect(screen.getAllByTitle(/fill at/).length).toBe(
      result.state.fills.length
    );
  });

  it("shows completed results with a reset action", () => {
    const result = runSimulation(SCENARIOS["stable-market"], DEFAULT_STRATEGY);
    const onAgain = vi.fn();
    render(
      <Results
        scenario={result.scenario}
        state={result.state}
        breakdown={scoreRun(
          result.state,
          DEFAULT_STRATEGY,
          result.scenario.durationTicks
        )}
        pnlCents={result.state.equityCents - result.state.startingEquityCents}
        verified={false}
        onAgain={onAgain}
        onChallenges={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Run again" }));
    expect(onAgain).toHaveBeenCalledOnce();
    expect(screen.getByText("CHALLENGE COMPLETE")).toBeTruthy();
  });
});
