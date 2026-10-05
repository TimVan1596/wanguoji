import { describe, expect, it } from "vitest";
import { RollingStepPerformance, STEP_PERFORMANCE_SAMPLE_CAPACITY } from "./RollingStepPerformance";
import worldRandom from "./WorldRandom";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";

describe("RollingStepPerformance", () => {
  it("keeps a bounded rolling window and deterministic summaries", () => {
    const metrics = new RollingStepPerformance();
    for (let value = 1; value <= STEP_PERFORMANCE_SAMPLE_CAPACITY + 20; value += 1) {
      metrics.record("step", value);
    }
    expect(metrics.snapshot().step).toEqual({
      sampleCount: STEP_PERFORMANCE_SAMPLE_CAPACITY,
      averageMs: (21 + (STEP_PERFORMANCE_SAMPLE_CAPACITY + 20)) / 2,
      p95Ms: STEP_PERFORMANCE_SAMPLE_CAPACITY + 5,
      maxMs: STEP_PERFORMANCE_SAMPLE_CAPACITY + 20,
    });
  });

  it("ignores invalid measurements and does not mutate source state", () => {
    const randomBefore = worldRandom.exportState();
    const metrics = new RollingStepPerformance();
    metrics.record("x", Number.NaN);
    metrics.record("x", -1);
    metrics.record("x", 2);
    expect(metrics.snapshot().x.sampleCount).toBe(1);
    expect(worldRandom.exportState()).toEqual(randomBefore);
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(8);
  });
});
