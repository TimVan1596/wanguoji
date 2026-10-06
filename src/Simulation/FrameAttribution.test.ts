import { describe, expect, it } from "vitest";
import { FrameAttribution } from "./FrameAttribution";
import worldRandom from "./WorldRandom";
import { formatCoreDiagnostics } from "../Runtime/DiagnosticsReport";

describe("debug frame attribution", () => {
  it("records overlapping phases and an explicitly approximate residual, bounds buffers, resets without RNG", () => {
    let clock = 0;
    const profile = new FrameAttribution(true, () => clock);
    const rng = worldRandom.exportState();
    profile.measure("AutoSimulator.advance", () => {
      clock += 2;
      profile.measure("history publish/notify", () => { clock += 1; });
    });
    profile.finishFrame(16, 5, 3);
    expect(profile.snapshot().timings["AutoSimulator.advance"].averageMs).toBe(3);
    expect(profile.snapshot().timings["history publish/notify"].averageMs).toBe(1);
    expect(profile.snapshot().timings["unattributed frame time"].averageMs).toBe(11);
    for (let i = 0; i < 1000; i++) {
      profile.measure("unexpected dynamic key", () => {});
      profile.finishFrame(16, 5, 3);
    }
    expect(Object.keys(profile.snapshot().timings)).toHaveLength(17);
    expect(Object.values(profile.snapshot().timings).every(value => value.sampleCount === 300)).toBe(true);
    expect(formatCoreDiagnostics({ performance: { frameAttribution: profile.snapshot() } })).toContain("history publish/notify");
    expect(worldRandom.exportState()).toEqual(rng);
    profile.reset(); expect(profile.snapshot().timings).toEqual({});
  });
  it("disabled profile never reads clocks and work still runs exactly once", () => {
    const profile = new FrameAttribution(false, () => { throw Error("disabled clock read"); });
    let runs = 0;
    expect(profile.measure("AutoSimulator.advance", () => ++runs)).toBe(1);
    profile.finishFrame(16, 5, 3);
    expect(profile.snapshot()).toMatchObject({ enabled: false, timings: {} });
    expect(runs).toBe(1);
  });
});
