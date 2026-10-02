import { describe, expect, it } from "vitest";
import { percentile, RuntimePerformanceMetrics } from "./RuntimePerformanceMetrics";

describe("runtime frame performance metrics", () => {
  it("uses a bounded ring buffer and reports rolling statistics", () => {
    const metrics = new RuntimePerformanceMetrics(3);
    [10, 20, 30, 40, 50].forEach((delta, index) => metrics.record(delta, index, 2, 3));
    const snapshot = metrics.snapshot();
    expect(snapshot.sampleCount).toBe(3);
    expect(snapshot.renderFrameCount).toBe(5);
    expect(snapshot.frameDeltaMs.current).toBe(50);
    expect(snapshot.frameDeltaMs.average).toBe(40);
    expect(snapshot.frameDeltaMs.p95).toBe(50);
    expect(snapshot.simulationStepsPerFrame).toMatchObject({ average: 3, max: 4 });
  });

  it("computes deterministic nearest-rank p95 and cumulative long-frame buckets", () => {
    expect(percentile([8, 1, 7, 2, 6, 3, 5, 4, 9, 10], 0.95)).toBe(10);
    const metrics = new RuntimePerformanceMetrics(10);
    [25, 25.1, 33.1, 50.1, 100.1].forEach((delta) => metrics.record(delta, 0, 0, 0));
    expect(metrics.snapshot().longFrames).toEqual({ over25ms: 4, over33ms: 3, over50ms: 2, over100ms: 1 });
  });
});
