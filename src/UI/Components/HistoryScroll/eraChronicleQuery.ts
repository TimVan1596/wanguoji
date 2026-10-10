import type { WorldEra } from "../../../Simulation/WorldEra";
import type { WorldEvent, WorldHistoryStore } from "../../../History/WorldHistory";
import { groupHistoryNarratives } from "../../../History/HistoryNarrativeGrouper";
import { getHistorySignificance } from "../../../History/HistorySignificanceRules";
import { DIPLOMACY_EVENT_TYPES } from "../../../History/HistoryMajorEventFilters";
export const ERA_CHRONICLE_PAGE_SIZE = 10;
export interface EraChronicleCursor { beforeIndex: number; remaining: WorldEvent[]; hasOlder: boolean }
export interface EraChroniclePage { events: WorldEvent[]; cursor?: EraChronicleCursor }
export function getEraChronicleEnd(era: Pick<WorldEra, "endMonth">, worldMonth: number) { return Math.min(era.endMonth ?? worldMonth, worldMonth); }
/** Cursor paging retains only one grouped window, not all pages already displayed. */
export function queryEraChroniclePage(store: WorldHistoryStore, era: Pick<WorldEra, "startMonth" | "endMonth">, worldMonth: number, cursor?: EraChronicleCursor): EraChroniclePage {
  const endMonth = getEraChronicleEnd(era, worldMonth);
  if (endMonth < era.startMonth) return { events: [] };
  let remaining = cursor?.remaining ?? [], beforeIndex = cursor?.beforeIndex, hasOlder = cursor?.hasOlder ?? true;
  const events: WorldEvent[] = [];
  for (;;) {
    const count = Math.min(ERA_CHRONICLE_PAGE_SIZE - events.length, remaining.length);
    events.push(...remaining.slice(0, count)); remaining = remaining.slice(count);
    if (events.length === ERA_CHRONICLE_PAGE_SIZE || !hasOlder) break;
    const window = store.getEventWindow({ startMonth: era.startMonth, endMonth, beforeIndex, limit: 200 });
    beforeIndex = window.nextIndex; hasOlder = window.hasOlder;
    remaining = groupHistoryNarratives(window.events).filter(event => {
      if (DIPLOMACY_EVENT_TYPES.includes(event.type)) return false;
      const significance = getHistorySignificance(event);
      return significance === "MAJOR" || significance === "LANDMARK";
    });
  }
  return { events, cursor: remaining.length || hasOlder ? { remaining, beforeIndex: beforeIndex!, hasOlder } : undefined };
}
