import type { LocalSimulationRun } from "./types";
import { LOCAL_RUN_LIMIT } from "./types";

const STORAGE_KEY = "spreadforge:local-simulation-runs:v1";
export const LOCAL_RUNS_UPDATED_EVENT = "spreadforge:local-runs-updated";

function isRun(value: unknown): value is LocalSimulationRun {
  return !!value && typeof value === "object" && "id" in value && "commitment" in value;
}

export function listLocalRuns(): LocalSimulationRun[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isRun) : [];
  } catch {
    return [];
  }
}

function write(runs: LocalSimulationRun[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  window.dispatchEvent(new Event(LOCAL_RUNS_UPDATED_EVENT));
}

export function saveLocalRun(run: LocalSimulationRun): LocalSimulationRun[] {
  const current = listLocalRuns().filter((item) => item.id !== run.id);
  const next = [run, ...current].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const protectedRuns = next.filter((item) => item.status === "submitting");
  const normalRuns = next.filter((item) => item.status !== "submitting");
  write([...protectedRuns, ...normalRuns.slice(0, Math.max(0, LOCAL_RUN_LIMIT - protectedRuns.length))]);
  return listLocalRuns();
}

export function updateLocalRun(
  id: string,
  patch: Partial<LocalSimulationRun>
): LocalSimulationRun[] {
  const next = listLocalRuns().map((run) => (run.id === id ? { ...run, ...patch } : run));
  write(next);
  return next;
}

export function clearLocalRuns() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(LOCAL_RUNS_UPDATED_EVENT));
  }
}
