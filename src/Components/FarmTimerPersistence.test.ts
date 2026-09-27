import { describe, expect, it } from "vitest";
import { exportFarmTimerState, getFarmTimerRestoreOptions } from "./FarmTimerPersistence";

describe("farm timer persistence contract", () => {
  it("round-trips elapsed, remaining, repeat count, and pause state through JSON/init options", () => {
    const delay = 8000;
    const initialTimer = {
      elapsed: 2688,
      repeatCount: 3,
      paused: true,
      getElapsed() { return this.elapsed; },
      getRemaining() { return delay - this.elapsed; },
      getRepeatCount() { return this.repeatCount; },
    };
    const exported = exportFarmTimerState("reinforcements", initialTimer);
    const jsonState = JSON.parse(JSON.stringify(exported));
    const restore = getFarmTimerRestoreOptions(jsonState, 0);

    // Phaser TimerEvent initializes elapsed from startAt; getRemaining() is delay - elapsed.
    const restoredTimer = {
      elapsed: restore.startAt,
      repeatCount: restore.repeatCount!,
      paused: restore.paused!,
      getElapsed() { return this.elapsed; },
      getRemaining() { return delay - this.elapsed; },
      getRepeatCount() { return this.repeatCount; },
    };
    expect(exportFarmTimerState("reinforcements", restoredTimer)).toEqual(exported);
    expect(jsonState.remainingMs).toBe(delay - jsonState.elapsedMs);
  });

  it("uses the configured initial startAt when no saved timer exists", () => {
    expect(getFarmTimerRestoreOptions(undefined, 1250).startAt).toBe(1250);
  });
});
