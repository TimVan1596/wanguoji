import { describe, expect, it } from "vitest";
import { MonthlyPhaseProfiler, measurePhase } from "./MonthlyPhaseProfiler";
import { RollingStepPerformance, STEP_PERFORMANCE_SAMPLE_CAPACITY } from "./RollingStepPerformance";
import worldRandom from "./WorldRandom";
describe("monthly phase profiling", () => {
  it("aggregates cities per month, includes idle months and keeps bounded rolling samples without RNG", () => {
    const profiler = new MonthlyPhaseProfiler(); const samples = new RollingStepPerformance();
    const before = worldRandom.exportState();
    let calls = 0;
    for (let month = 0; month < 1000; month++) {
      for (let city = 0; city < 16; city++) measurePhase(profiler, "City.updateSiege", () => calls++);
      profiler.flush(samples);
    }
    expect(calls).toBe(16000);
    expect(samples.snapshot()["City.updateSiege"].sampleCount).toBe(STEP_PERFORMANCE_SAMPLE_CAPACITY);
    expect(samples.snapshot()["Population.makeUser"].averageMs).toBe(0);
    expect(worldRandom.exportState()).toEqual(before);
    expect(measurePhase(undefined, "disabled", () => 42)).toBe(42);
  });
});
