import { beforeEach, describe, expect, it } from "vitest";
import { clearLocalRuns, listLocalRuns, saveLocalRun, updateLocalRun } from "./storage";
import type { LocalSimulationRun } from "./types";

const run = (id: string): LocalSimulationRun => ({
  id,
  completedAt: `2026-01-01T00:00:${id.padStart(2, "0")}Z`,
  scenarioId: "stable-market",
  scenarioVersion: 1,
  strategy: { spreadBps: 30, orderSizeMilliSol: 1000, maxInventoryMilliSol: 100000, refreshTicks: 1 },
  commitment: { scenarioHash: "a".repeat(64), strategyHash: "b".repeat(64), resultHash: "c".repeat(64), totalScore: 1, pnlBps: 0, maxDrawdownBps: 0, fills: 0, schemaVersion: 2 },
  status: "local",
});

describe("local leaderboard storage", () => {
  beforeEach(() => clearLocalRuns());
  it("persists and updates completed runs", () => {
    saveLocalRun(run("1"));
    updateLocalRun("1", { status: "committed", signature: "signature" });
    expect(listLocalRuns()[0]).toMatchObject({ id: "1", status: "committed", signature: "signature" });
  });
  it("keeps the newest 100 normal runs", () => {
    for (let i = 0; i < 101; i++) saveLocalRun(run(String(i)));
    expect(listLocalRuns()).toHaveLength(100);
  });
});
