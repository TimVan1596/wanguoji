import { describe, expect, it } from "vitest";
import { createEmptyWorldSaveV1 } from "./WorldSaveSchema";
import { chooseAutosaveSlot, findLatestValidSave, GameYearAutosaveSchedule, getNextAutosaveBoundary, renameManualSave } from "./SaveSlotRules";
import { createStoredWorldSaveRecord, StoredWorldSaveRecord, WorldSaveRepository } from "./WorldSaveRepository";

function metadata(slotId: string, savedAt: string) {
  return { slotId, slotType: "AUTOSAVE" as const, savedAt, worldMonth: 0, appVersion: "test", saveSchemaVersion: 1 };
}

describe("save slot rules", () => {
  it("schedules one autosave when crossing a 200-year boundary and skips old boundaries on Continue", () => {
    expect(getNextAutosaveBoundary(1436 * 12)).toBe(1600 * 12);
    const loaded = new GameYearAutosaveSchedule(1436 * 12);
    expect(loaded.getNextBoundaryMonth()).toBe(1600 * 12);
    expect(loaded.observe(1436 * 12)).toBeUndefined();
    expect(loaded.observe(1600 * 12 + 4)).toBe(1600 * 12);
    expect(loaded.getNextBoundaryMonth()).toBe(1800 * 12);
    const skipped = new GameYearAutosaveSchedule(0);
    expect(skipped.observe(850 * 12)).toBe(200 * 12);
    expect(skipped.getNextBoundaryMonth()).toBe(1000 * 12);
  });

  it("fills two autosave slots then rotates the oldest savedAt entry", async () => {
    let entries = [] as ReturnType<typeof metadata>[];
    const repo = { async listMetadata() { return entries; } } as unknown as WorldSaveRepository;
    expect(await chooseAutosaveSlot(repo)).toBe("autosave-1");
    entries = [metadata("autosave-1", "2026-01-01T00:00:00.000Z")];
    expect(await chooseAutosaveSlot(repo)).toBe("autosave-2");
    entries.push(metadata("autosave-2", "2026-01-02T00:00:00.000Z"));
    expect(await chooseAutosaveSlot(repo)).toBe("autosave-1");
  });

  it("Continue selects newest valid full save and falls back past corrupt slots", async () => {
    const save = createEmptyWorldSaveV1();
    save.world.started = true;
    const older = createStoredWorldSaveRecord(save, "older", "2026-01-01T00:00:00.000Z");
    const newer = createStoredWorldSaveRecord(save, "newer", "2026-01-02T00:00:00.000Z", { slotId: "manual-new", slotType: "MANUAL" });
    const records = new Map<string, unknown>([["manual-new", { ...newer, save: [] }], ["current", older]]);
    const repo = {
      async listMetadata() { return [
        { slotId: "manual-new", slotType: "MANUAL" as const, savedAt: newer.savedAt, worldMonth: 0, appVersion: newer.appVersion, saveSchemaVersion: 1 },
        { slotId: "current", slotType: "RECOVERY" as const, savedAt: older.savedAt, worldMonth: 0, appVersion: older.appVersion, saveSchemaVersion: 1 },
      ]; },
      async get(slotId: string) { return records.get(slotId); },
    } as unknown as WorldSaveRepository;
    const result = await findLatestValidSave(repo);
    expect(result.record?.slotId).toBe("current");
    expect(result.invalidSlots).toHaveLength(1);
    expect(result.invalidSlots[0].slotId).toBe("manual-new");
  });

  it("allows rename only on manual slots without rewriting the save payload", () => {
    const save = createEmptyWorldSaveV1();
    const manual = createStoredWorldSaveRecord(save, "test", undefined, { slotId: "manual-id", slotType: "MANUAL", displayName: "A" });
    const renamed = renameManualSave(manual, "  B  ");
    expect(renamed.displayName).toBe("B");
    expect(renamed.save).toBe(manual.save);
    expect(() => renameManualSave({ ...manual, slotType: "AUTOSAVE", slotId: "autosave-1" } as StoredWorldSaveRecord, "x")).toThrow();
    expect(() => renameManualSave(manual, " ")).toThrow("存档名称不能为空");
    expect(() => renameManualSave(manual, "x".repeat(65))).toThrow("64个字符");
  });
});
