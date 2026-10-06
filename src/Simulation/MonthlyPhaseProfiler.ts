import type { RollingStepPerformance } from "./RollingStepPerformance";

export const runtimeProfilingEnabled = import.meta.env.DEV || import.meta.env.MODE === "desktop-debug";

/** Aggregate all cities/spawns within one month before recording bounded samples. */
export class MonthlyPhaseProfiler {
  private totals = new Map<string, number>();
  measure<T>(name: string, work: () => T): T {
    const start = performance.now();
    try { return work(); }
    finally { this.totals.set(name, (this.totals.get(name) ?? 0) + performance.now() - start); }
  }
  flush(target: RollingStepPerformance) {
    this.totals.forEach((duration, name) => target.record(name, duration));
    this.totals.clear();
  }
}

export function measurePhase<T>(profile: MonthlyPhaseProfiler | undefined, name: string, work: () => T): T {
  return profile ? profile.measure(name, work) : work();
}
