import type { SaveSlotMetadata } from "./WorldSaveRepository";
import { formatWorldDate } from "../Simulation/WorldTime";

export function getSaveSlotPrimaryLabel(slot: SaveSlotMetadata) {
  if (slot.slotType === "AUTOSAVE") return `自动存档 · ${formatWorldDate(slot.worldMonth)}`;
  if (slot.slotType === "RECOVERY") return slot.displayName ?? "最近恢复点";
  return slot.displayName ?? slot.slotId;
}
