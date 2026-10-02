import { describe, expect, it, vi } from "vitest";
import { createEmptyWorldSaveV1 } from "./WorldSaveSchema";
import { runManualSaveWorkflow, createWorldLaunchRunner, continueStoredWorldSave, WorldLaunchRequest, runExclusiveWorldSave, WorldSaveBusyError } from "./WorldSaveWorkflow";
import { WorldSaveRepository, StoredWorldSaveRecord } from "./WorldSaveRepository";

function memoryRepository(): WorldSaveRepository & { current?: StoredWorldSaveRecord } {
  return {
    current: undefined,
    async getCurrent() { return this.current; },
    async putCurrent(record) { this.current = record; },
    async deleteCurrent() { this.current = undefined; },
  };
}

describe("WorldSave workflow", () => {
  it("shares one save lock between manual, autosave, and close-save callers", async () => {
    let release!: () => void;
    const first = runExclusiveWorldSave(() => new Promise<void>((resolve) => { release = resolve; }));
    await expect(runExclusiveWorldSave(async () => undefined)).rejects.toBeInstanceOf(WorldSaveBusyError);
    release();
    await first;
    await expect(runExclusiveWorldSave(async () => "saved")).resolves.toBe("saved");
  });

  it("runs NEW_WORLD once and never hydrates", () => {
    const scenario = { id: "custom", name: "Custom", description: "", factions: [] };
    const startWorld = vi.fn();
    const hydrate = vi.fn();
    const launch = createWorldLaunchRunner({ mode: "NEW_WORLD", scenario }, { startWorld, hydrate });
    expect(launch()).toBe(true);
    expect(launch()).toBe(false);
    expect(startWorld).toHaveBeenCalledTimes(1);
    expect(hydrate).not.toHaveBeenCalled();
  });

  it("runs CONTINUE_SAVE hydration once and never starts a new world", () => {
    const save = createEmptyWorldSaveV1();
    const record: StoredWorldSaveRecord = {
      slotId: "current", savedAt: new Date().toISOString(), appVersion: save.appVersion,
      saveSchemaVersion: save.saveSchemaVersion, summary: { worldMonth: 0 }, save,
    };
    const startWorld = vi.fn();
    const hydrate = vi.fn();
    const request: WorldLaunchRequest = { mode: "CONTINUE_SAVE", record };
    const launch = createWorldLaunchRunner(request, { startWorld, hydrate });
    expect(launch()).toBe(true);
    expect(launch()).toBe(false);
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(startWorld).not.toHaveBeenCalled();
  });

  it.each([
    { running: true, speed: 4, fail: false, expectedRunning: true },
    { running: false, speed: 2, fail: false, expectedRunning: false },
    { running: true, speed: 4, fail: true, expectedRunning: true },
    { running: false, speed: 2, fail: true, expectedRunning: false },
  ])("restores prior running state and speed after save (running=$running fail=$fail)", async ({ running, speed, fail, expectedRunning }) => {
    const repository = memoryRepository();
    const restore = vi.fn();
    const pauseAtBoundary = vi.fn().mockResolvedValue(undefined);
    if (fail) repository.putCurrent = vi.fn().mockRejectedValue(new Error("quota"));
    const work = runManualSaveWorkflow(
      { started: true, running, speed, catchingUp: () => false, pauseAtBoundary, restore },
      repository,
      () => createEmptyWorldSaveV1(),
      "Test",
    );
    if (fail) await expect(work).rejects.toThrow("quota");
    else await expect(work).resolves.toMatchObject({
      record: { summary: { scenarioName: "Test" } },
      waitSafeBoundaryMs: expect.any(Number),
      exportSerializeMs: expect.any(Number),
      indexedDbWriteMs: expect.any(Number),
      totalSaveDurationMs: expect.any(Number),
    });
    expect(pauseAtBoundary).toHaveBeenCalledOnce();
    expect(restore).toHaveBeenCalledWith(speed, expectedRunning);
  });

  it("rejects catch-up before pausing or writing", async () => {
    const repository = memoryRepository();
    const pause = vi.fn();
    await expect(runManualSaveWorkflow(
      { started: true, running: false, speed: 1, catchingUp: () => true, pauseAtBoundary: pause, restore: vi.fn() },
      repository,
      createEmptyWorldSaveV1,
    )).rejects.toThrow("后台追赶期间");
    expect(pause).not.toHaveBeenCalled();
    expect(repository.current).toBeUndefined();
  });

  it("rejects invalid or unsupported stored records before hydration", async () => {
    const invalidRecord = { slotId: "current", saveSchemaVersion: 999, save: createEmptyWorldSaveV1() };
    const untouchedCore = new Proxy({}, { get() { throw new Error("core must not be touched before record validation"); } });
    await expect(continueStoredWorldSave(untouchedCore as never, invalidRecord)).rejects.toThrow("该存档版本暂不支持");
  });
});
