import { AUTOSAVE_SLOT_IDS, SaveSlotMetadata, StoredWorldSaveRecord, WorldSaveRepository } from "./WorldSaveRepository";

export const AUTOSAVE_INTERVAL_MONTHS = 200 * 12;

export function getNextAutosaveBoundary(worldMonth: number) {
  return (Math.floor(Math.max(0, worldMonth) / AUTOSAVE_INTERVAL_MONTHS) + 1) * AUTOSAVE_INTERVAL_MONTHS;
}

export class GameYearAutosaveSchedule {
  private nextBoundaryMonth: number;

  constructor(worldMonth: number) {
    this.nextBoundaryMonth = getNextAutosaveBoundary(worldMonth);
  }

  getNextBoundaryMonth() { return this.nextBoundaryMonth; }

  observe(worldMonth: number) {
    if (worldMonth < this.nextBoundaryMonth) return undefined;
    const triggeredBoundaryMonth = this.nextBoundaryMonth;
    this.nextBoundaryMonth = getNextAutosaveBoundary(worldMonth);
    return triggeredBoundaryMonth;
  }
}

export async function chooseAutosaveSlot(repository: Pick<WorldSaveRepository, "listMetadata">): Promise<string> {
  const entries = await repository.listMetadata();
  const existing = AUTOSAVE_SLOT_IDS.map((slotId) => entries.find((entry) => entry.slotId === slotId));
  const emptyIndex = existing.findIndex((entry) => !entry);
  if (emptyIndex >= 0) return AUTOSAVE_SLOT_IDS[emptyIndex];
  return [...existing]
    .map((entry, index) => ({ entry: entry as SaveSlotMetadata, slotId: AUTOSAVE_SLOT_IDS[index] }))
    .sort((a, b) => a.entry.savedAt.localeCompare(b.entry.savedAt) || a.slotId.localeCompare(b.slotId))[0].slotId;
}

export async function findLatestValidSave(repository: Pick<WorldSaveRepository, "get" | "listMetadata">) {
  const metadata = await repository.listMetadata();
  const invalidSlots: Array<{ slotId: string; errors: string[] }> = [];
  const { validateStoredWorldSaveRecord } = await import("./WorldSaveRepository");
  for (const item of metadata) {
    const value = await repository.get(item.slotId);
    const validation = validateStoredWorldSaveRecord(value, item.slotId);
    if (validation.valid && validation.record) return { record: validation.record, invalidSlots };
    invalidSlots.push({ slotId: item.slotId, errors: validation.errors.length ? validation.errors : ["存档数据不存在"] });
  }
  return { record: undefined, invalidSlots };
}

export function renameManualSave(record: StoredWorldSaveRecord, displayName: string): StoredWorldSaveRecord {
  if (record.slotType !== "MANUAL") throw new Error("只有手动存档可以重命名");
  const normalizedName = displayName.trim();
  if (!normalizedName) throw new Error("存档名称不能为空");
  return { ...record, displayName: normalizedName };
}
