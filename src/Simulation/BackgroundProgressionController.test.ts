import { describe, expect, it } from "vitest";
import BackgroundProgressionController from "./BackgroundProgressionController";
import {
  BASE_PLAY_RATE,
  SIMULATION_FIXED_STEP_MS,
} from "./SimulationDriver";

function debtSteps(realMs: number, speed = 1) {
  return Math.floor((realMs * BASE_PLAY_RATE * speed) / SIMULATION_FIXED_STEP_MS);
}

describe("BackgroundProgressionController", () => {
  it("captures hidden timestamp, speed, paused state, and world instance", () => {
    const controller = new BackgroundProgressionController();
    controller.handleHidden({
      nowMs: 123,
      selectedSpeed: 4,
      paused: true,
      worldInstanceId: 7,
    });
    expect(controller.getSnapshot().hidden).toEqual({
      hiddenAtRealMs: 123,
      hiddenSelectedSpeed: 4,
      hiddenPaused: true,
      hiddenWorldInstanceId: 7,
    });
  });

  it("returns zero debt when hidden while paused", () => {
    const controller = new BackgroundProgressionController();
    controller.handleHidden({
      nowMs: 0,
      selectedSpeed: 4,
      paused: true,
      worldInstanceId: 1,
    });
    const snapshot = controller.handleVisible({ nowMs: 60_000, worldInstanceId: 1 });
    expect(snapshot.catchUpDebtSteps).toBe(0);
    expect(snapshot.mode).toBe("FOREGROUND");
  });

  it("maps 1x/2x/4x debt through the shared base play rate", () => {
    [1, 2, 4].forEach((speed) => {
      const controller = new BackgroundProgressionController();
      controller.handleHidden({
        nowMs: 0,
        selectedSpeed: speed,
        paused: false,
        worldInstanceId: 1,
      });
      const snapshot = controller.handleVisible({
        nowMs: 10_000,
        worldInstanceId: 1,
      });
      expect(snapshot.catchUpDebtSteps).toBe(debtSteps(10_000, speed));
    });
  });

  it("suppresses the giant resume frame delta exactly once", () => {
    const controller = new BackgroundProgressionController();
    controller.handleHidden({
      nowMs: 0,
      selectedSpeed: 1,
      paused: false,
      worldInstanceId: 1,
    });
    controller.handleVisible({ nowMs: 60_000, worldInstanceId: 1 });
    expect(controller.consumeSuppressNextForegroundDelta()).toBe(true);
    expect(controller.consumeSuppressNextForegroundDelta()).toBe(false);
  });

  it("discards debt for a different world instance", () => {
    const controller = new BackgroundProgressionController();
    controller.handleHidden({
      nowMs: 0,
      selectedSpeed: 4,
      paused: false,
      worldInstanceId: 1,
    });
    const snapshot = controller.handleVisible({ nowMs: 60_000, worldInstanceId: 2 });
    expect(snapshot.catchUpDebtSteps).toBe(0);
    expect(snapshot.mode).toBe("FOREGROUND");
  });

  it("does not show overlay for tiny hidden intervals", () => {
    const controller = new BackgroundProgressionController();
    controller.handleHidden({
      nowMs: 0,
      selectedSpeed: 1,
      paused: false,
      worldInstanceId: 1,
    });
    const snapshot = controller.handleVisible({ nowMs: 500, worldInstanceId: 1 });
    expect(snapshot.catchUpDebtSteps).toBeGreaterThan(0);
    expect(snapshot.catchUpShowOverlay).toBe(false);
  });

  it("applies real-time and logical step caps", () => {
    const controller = new BackgroundProgressionController();
    controller.handleHidden({
      nowMs: 0,
      selectedSpeed: 4,
      paused: false,
      worldInstanceId: 1,
    });
    const snapshot = controller.handleVisible({
      nowMs: 60_000,
      worldInstanceId: 1,
      maxRealMs: 10_000,
      maxCatchUpSteps: 5,
    });
    expect(snapshot.catchUpDebtSteps).toBe(5);
    expect(snapshot.catchUpTruncated).toBe(true);
  });

  it("decrements debt in chunks and returns to foreground on completion", () => {
    const controller = new BackgroundProgressionController();
    controller.handleHidden({
      nowMs: 0,
      selectedSpeed: 1,
      paused: false,
      worldInstanceId: 1,
    });
    controller.handleVisible({
      nowMs: SIMULATION_FIXED_STEP_MS * 4,
      worldInstanceId: 1,
      basePlayRate: 1,
    });
    const deltas: number[] = [];
    controller.runChunk({
      maxSteps: 2,
      cpuBudgetMs: 100,
      nowMs: () => 0,
      step: () => deltas.push(SIMULATION_FIXED_STEP_MS),
    });
    expect(controller.getSnapshot().catchUpDebtSteps).toBe(2);
    controller.runChunk({
      maxSteps: 10,
      cpuBudgetMs: 100,
      nowMs: () => 0,
      step: () => deltas.push(SIMULATION_FIXED_STEP_MS),
    });
    expect(deltas).toHaveLength(4);
    expect(controller.getSnapshot().mode).toBe("FOREGROUND");
  });

  it("preserves remaining debt when hidden again during catch-up", () => {
    const controller = new BackgroundProgressionController();
    controller.handleHidden({
      nowMs: 0,
      selectedSpeed: 1,
      paused: false,
      worldInstanceId: 1,
    });
    controller.handleVisible({ nowMs: 10_000, worldInstanceId: 1 });
    controller.runChunk({
      maxSteps: 10,
      cpuBudgetMs: 100,
      nowMs: () => 0,
      step: () => undefined,
    });
    const remaining = controller.getSnapshot().catchUpDebtSteps;
    controller.handleHidden({
      nowMs: 11_000,
      selectedSpeed: 2,
      paused: false,
      worldInstanceId: 1,
    });
    const snapshot = controller.handleVisible({
      nowMs: 12_000,
      worldInstanceId: 1,
    });
    expect(snapshot.catchUpDebtSteps).toBe(remaining + debtSteps(1000, 2));
  });

  it("new world reset clears all debt and hidden state", () => {
    const controller = new BackgroundProgressionController();
    controller.handleHidden({
      nowMs: 0,
      selectedSpeed: 4,
      paused: false,
      worldInstanceId: 1,
    });
    controller.handleVisible({ nowMs: 60_000, worldInstanceId: 1 });
    controller.reset();
    const snapshot = controller.getSnapshot();
    expect(snapshot.hidden).toBeUndefined();
    expect(snapshot.catchUpDebtSteps).toBe(0);
    expect(snapshot.mode).toBe("FOREGROUND");
  });

  it("keeps Electron desktop hidden time out of return-time catch-up debt", () => {
    const controller = new BackgroundProgressionController();
    controller.handleHidden({
      nowMs: 0,
      selectedSpeed: 4,
      paused: false,
      worldInstanceId: 1,
      runtimeMode: "DESKTOP_CONTINUOUS",
    });
    const snapshot = controller.handleVisible({
      nowMs: 60_000,
      worldInstanceId: 1,
      runtimeMode: "DESKTOP_CONTINUOUS",
    });
    expect(snapshot.catchUpDebtSteps).toBe(0);
    expect(snapshot.mode).toBe("FOREGROUND");
    expect(controller.consumeSuppressNextForegroundDelta()).toBe(true);
  });

  it("still creates catch-up debt for normal web hidden time", () => {
    const controller = new BackgroundProgressionController();
    controller.handleHidden({
      nowMs: 0,
      selectedSpeed: 1,
      paused: false,
      worldInstanceId: 1,
      runtimeMode: "WEB_CATCH_UP",
    });
    const snapshot = controller.handleVisible({
      nowMs: 10_000,
      worldInstanceId: 1,
      runtimeMode: "WEB_CATCH_UP",
    });
    expect(snapshot.catchUpDebtSteps).toBe(debtSteps(10_000, 1));
  });
});
