import { describe, expect, it } from "vitest";
import { getSaveSlotPrimaryLabel } from "./SaveSlotPresentation";
import type { SaveSlotMetadata } from "./WorldSaveRepository";

function slot(overrides: Partial<SaveSlotMetadata>): SaveSlotMetadata {
  return {
    slotId: "autosave-1", slotType: "AUTOSAVE", savedAt: "2026-01-01T00:00:00.000Z",
    worldMonth: 17_175, appVersion: "test", saveSchemaVersion: 6, ...overrides,
  };
}

describe("save slot primary labels", () => {
  it("renders autosaves using the snapshot worldMonth, ignoring stale stored labels", () => {
    expect(getSaveSlotPrimaryLabel(slot({ displayName: "自动存档 · 200年1月" })))
      .toBe("自动存档 · 1431年4月");
  });

  it("keeps manual names and Recovery labels unchanged", () => {
    expect(getSaveSlotPrimaryLabel(slot({ slotType: "MANUAL", displayName: "档案A" }))).toBe("档案A");
    expect(getSaveSlotPrimaryLabel(slot({ slotType: "RECOVERY", displayName: undefined }))).toBe("最近恢复点");
  });
});
