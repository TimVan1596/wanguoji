import { describe, expect, it, vi } from "vitest";
import { closeSaveManagerSession, pauseForSaveManager, restoreAfterFailedSaveLoad } from "./SaveManagerRuntimeSession";

function mockCore(running: boolean, speed: number) {
  return {
    simulator: { isRunning: () => running, getSpeed: () => speed },
    setWorldRunning: vi.fn(),
    setSimulationSpeed: vi.fn(),
  };
}

describe("Save Manager runtime session", () => {
  it("pauses a running world while retaining its speed, then restores it on ordinary close", () => {
    const core = mockCore(true, 4);
    const session = pauseForSaveManager(core)!;
    expect(session).toMatchObject({ wasRunning: true, speed: 4, closeReason: "MANAGED" });
    expect(core.setWorldRunning).toHaveBeenCalledWith(false);

    expect(closeSaveManagerSession(core, session)).toBe(true);
    expect(core.setSimulationSpeed).toHaveBeenCalledWith(4);
    expect(core.setWorldRunning).toHaveBeenLastCalledWith(true);
  });

  it("keeps an originally paused world paused after manager close", () => {
    const core = mockCore(false, 2);
    const session = pauseForSaveManager(core)!;
    closeSaveManagerSession(core, session);
    expect(core.setWorldRunning).toHaveBeenLastCalledWith(false);
    expect(core.setSimulationSpeed).toHaveBeenCalledWith(2);
  });

  it("does not restore old runtime state after a selected save is loaded", () => {
    const core = mockCore(true, 4);
    const session = pauseForSaveManager(core)!;
    session.closeReason = "LOAD";
    expect(closeSaveManagerSession(core, session)).toBe(false);
    expect(core.setSimulationSpeed).not.toHaveBeenCalled();
    expect(core.setWorldRunning).toHaveBeenCalledTimes(1);
  });

  it("restores the old world only when hydration failed before teardown", () => {
    const core = mockCore(true, 4);
    const session = pauseForSaveManager(core)!;
    expect(restoreAfterFailedSaveLoad(core, session)).toBe(true);
    expect(core.setSimulationSpeed).toHaveBeenCalledWith(4);
    expect(core.setWorldRunning).toHaveBeenLastCalledWith(true);
  });
});
