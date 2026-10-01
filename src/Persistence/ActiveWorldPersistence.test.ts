import { afterEach, describe, expect, it, vi } from "vitest";
import type Core from "../Game/Core";
import { registerActiveWorldPersistence, saveActiveWorld } from "./ActiveWorldPersistence";
import { runExclusiveWorldSave } from "./WorldSaveWorkflow";

const coreWith = (block?: string) => ({ getDesktopSaveBlockReason: () => block }) as unknown as Core;
const saveResult = { record: { savedAt: "now", summary: { worldMonth: 12 } }, serializedBytes: 20, writeDurationMs: 3 } as never;

describe("active world persistence authority", () => {
  let unregister: (() => void) | undefined;
  afterEach(() => { unregister?.(); unregister = undefined; });

  it("routes manual/autosave/close callers through one registered active-world authority", async () => {
    const core = coreWith();
    const save = vi.fn().mockResolvedValue(saveResult);
    unregister = registerActiveWorldPersistence({ isWorldStarted: () => true, getCore: () => core, save });
    const manual = await saveActiveWorld();
    const autosave = await saveActiveWorld();
    const close = await saveActiveWorld({ waitForBusy: true });
    expect([manual.status, autosave.status, close.status]).toEqual(["SAVED", "SAVED", "SAVED"]);
    expect(save).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenCalledWith(core);
  });

  it("skips only when the authoritative launch state says there is no world", async () => {
    unregister = registerActiveWorldPersistence({ isWorldStarted: () => false, getCore: () => undefined, save: vi.fn() });
    await expect(saveActiveWorld()).resolves.toEqual({ status: "SKIPPED", reason: "NO_WORLD" });
  });

  it("fails closed when an active world has no runtime", async () => {
    unregister = registerActiveWorldPersistence({ isWorldStarted: () => true, getCore: () => undefined, save: vi.fn() });
    await expect(saveActiveWorld()).resolves.toMatchObject({ status: "FAILED", reason: "RUNTIME_UNAVAILABLE" });
  });

  it("reports runtime initialization separately from a missing world", async () => {
    unregister = registerActiveWorldPersistence({ isWorldStarted: () => true, getCore: () => coreWith("NO_WORLD"), save: vi.fn() });
    await expect(saveActiveWorld()).resolves.toMatchObject({ status: "FAILED", reason: "RUNTIME_INITIALIZING" });
  });

  it("waits for an in-flight save before servicing close instead of dead-ending on SAVE_BUSY", async () => {
    let release!: () => void;
    let firstSave = true;
    const save = vi.fn(async () => {
      if (!firstSave) return saveResult;
      firstSave = false;
      return runExclusiveWorldSave(async () => {
        await new Promise<void>((resolve) => { release = resolve; });
        return saveResult;
      });
    });
    unregister = registerActiveWorldPersistence({ isWorldStarted: () => true, getCore: () => coreWith(), save });
    const first = saveActiveWorld();
    await Promise.resolve();
    const close = saveActiveWorld({ waitForBusy: true, timeoutMs: 1000 });
    release();
    await expect(first).resolves.toMatchObject({ status: "SAVED" });
    await expect(close).resolves.toMatchObject({ status: "SAVED" });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["CATCH_UP", "CATCHING_UP"],
    ["HYDRATION", "HYDRATION"],
    ["SNAPSHOT", "SNAPSHOT"],
  ])("preserves the active runtime blocked state %s", async (block, reason) => {
    unregister = registerActiveWorldPersistence({ isWorldStarted: () => true, getCore: () => coreWith(block), save: vi.fn() });
    await expect(saveActiveWorld()).resolves.toMatchObject({ status: "FAILED", reason });
  });
});
