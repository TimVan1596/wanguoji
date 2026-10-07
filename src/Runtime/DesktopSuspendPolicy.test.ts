import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESKTOP_SUSPEND_POLICY,
  DESKTOP_SUSPEND_POLICY_LABELS,
  DESKTOP_SUSPEND_POLICY_STORAGE_KEY,
  getDesktopResumePolicyDecision,
  getResumeCatchUpRequest,
  parseDesktopSuspendPolicy,
  readDesktopSuspendPolicy,
  writeDesktopSuspendPolicy,
} from "./DesktopSuspendPolicy";
import BackgroundProgressionController from "../Simulation/BackgroundProgressionController";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";

describe("Desktop suspend policy", () => {
  it("defaults to PAUSE and stores policy outside world save data", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    expect(DEFAULT_DESKTOP_SUSPEND_POLICY).toBe("PAUSE");
    expect(DESKTOP_SUSPEND_POLICY_LABELS.PAUSE).toBe("暂停，并在唤醒后等待继续（推荐）");
    expect(DESKTOP_SUSPEND_POLICY_LABELS.CATCH_UP).toBe("唤醒后补算离线时间");
    expect(readDesktopSuspendPolicy(storage)).toBe("PAUSE");
    writeDesktopSuspendPolicy("CATCH_UP", storage);
    expect(readDesktopSuspendPolicy(storage)).toBe("CATCH_UP");
    expect([...values.keys()]).toEqual([DESKTOP_SUSPEND_POLICY_STORAGE_KEY]);
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(11);
    expect(parseDesktopSuspendPolicy("invalid")).toBe("PAUSE");
  });

  it("PAUSE discards resume elapsed time without changing running/speed authority", () => {
    const before = { elapsedRealMs: 120_000, wasRunning: true, selectedSpeed: 4, worldInstanceId: 8 };
    expect(getResumeCatchUpRequest(before, "PAUSE")).toEqual({ ...before, wasRunning: false });
    expect(before).toMatchObject({ wasRunning: true, selectedSpeed: 4 });
    const controller = new BackgroundProgressionController();
    const resumeRequest = getResumeCatchUpRequest(before, "PAUSE");
    const snapshot = controller.scheduleResumeCatchUp({
      elapsedRealMs: resumeRequest.elapsedRealMs,
      selectedSpeed: resumeRequest.selectedSpeed,
      wasRunning: resumeRequest.wasRunning,
      worldInstanceId: resumeRequest.worldInstanceId ?? -1,
      currentWorldInstanceId: 8,
    });
    expect(snapshot.catchUpDebtSteps).toBe(0);
    expect(snapshot.catchUpSource).toBe("NONE");
    const decision = getDesktopResumePolicyDecision(before, "PAUSE");
    expect(decision.pauseWorldAfterResume).toBe(true);
    expect(decision.catchUpRequest).toMatchObject({ wasRunning: false, selectedSpeed: 4 });
    expect(decision.notice?.title).toContain("世界已暂停");
    expect(decision.notice?.detail).toContain("休眠期间未推进世界时间");
  });

  it("CATCH_UP preserves the real resume request and paused worlds stay paused", () => {
    const running = { elapsedRealMs: 120_000, wasRunning: true, selectedSpeed: 2, worldInstanceId: 8 };
    expect(getResumeCatchUpRequest(running, "CATCH_UP")).toEqual(running);
    const paused = { ...running, wasRunning: false };
    expect(getResumeCatchUpRequest(paused, "CATCH_UP")).toEqual(paused);
    expect(getResumeCatchUpRequest(paused, "PAUSE").wasRunning).toBe(false);
    const controller = new BackgroundProgressionController();
    const request = getResumeCatchUpRequest(running, "CATCH_UP");
    const scheduled = controller.scheduleResumeCatchUp({
      elapsedRealMs: request.elapsedRealMs,
      selectedSpeed: request.selectedSpeed,
      wasRunning: request.wasRunning,
      worldInstanceId: request.worldInstanceId ?? -1,
      currentWorldInstanceId: 8,
    });
    expect(scheduled.catchUpDebtSteps).toBeGreaterThan(0);
    expect(scheduled.catchUpSource).toBe("DESKTOP_OS_RESUME");
    const catchUpDecision = getDesktopResumePolicyDecision(running, "CATCH_UP");
    expect(catchUpDecision).toMatchObject({
      pauseWorldAfterResume: false,
      catchUpRequest: running,
    });
    expect(catchUpDecision.notice).toBeUndefined();

    for (const policy of ["PAUSE", "CATCH_UP"] as const) {
      const pausedController = new BackgroundProgressionController();
      const pausedRequest = getResumeCatchUpRequest(paused, policy);
      const pausedResult = pausedController.scheduleResumeCatchUp({
        elapsedRealMs: pausedRequest.elapsedRealMs,
        selectedSpeed: pausedRequest.selectedSpeed,
        wasRunning: pausedRequest.wasRunning,
        worldInstanceId: pausedRequest.worldInstanceId ?? -1,
        currentWorldInstanceId: 8,
      });
      expect(pausedResult.catchUpDebtSteps).toBe(0);
      expect(pausedResult.catchUpSource).toBe("NONE");
      expect(getDesktopResumePolicyDecision(paused, policy).pauseWorldAfterResume).toBe(false);
    }
  });

  it("does not depend on window minimize state", () => {
    const payload = { elapsedRealMs: 300_000, wasRunning: true, selectedSpeed: 1, worldInstanceId: 1 };
    expect(getResumeCatchUpRequest(payload, "PAUSE").wasRunning).toBe(false);
    expect(getResumeCatchUpRequest(payload, "CATCH_UP").wasRunning).toBe(true);
    for (const policy of ["PAUSE", "CATCH_UP"] as const) {
      const controller = new BackgroundProgressionController();
      controller.handleHidden({
        nowMs: 0, selectedSpeed: 1, paused: false, worldInstanceId: 1,
        runtimeMode: "DESKTOP_CONTINUOUS",
      });
      const returned = controller.handleVisible({
        nowMs: 5 * 60_000, worldInstanceId: 1, runtimeMode: "DESKTOP_CONTINUOUS",
      });
      expect(returned.catchUpDebtSteps, `${policy} policy`).toBe(0);
      expect(returned.catchUpSource, `${policy} policy`).toBe("NONE");
    }
  });
});
