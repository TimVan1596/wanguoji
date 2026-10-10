import type { WorldEra } from "../../../Simulation/WorldEra";
import type { WorldEvent, WorldHistoryStore } from "../../../History/WorldHistory";
import { groupHistoryNarratives } from "../../../History/HistoryNarrativeGrouper";
import { getHistorySignificance } from "../../../History/HistorySignificanceRules";
import { DIPLOMACY_EVENT_TYPES } from "../../../History/HistoryMajorEventFilters";
export const ERA_CHRONICLE_PAGE_SIZE = 10;
export interface EraChronicleCursor { beforeMonth: number; remaining: WorldEvent[]; hasOlder: boolean }
export interface EraChroniclePage { events: WorldEvent[]; cursor?: EraChronicleCursor }
export function getEraChronicleEnd(era: Pick<WorldEra, "endMonth">, worldMonth: number) { return Math.min(era.endMonth ?? worldMonth, worldMonth); }
/** Cursor paging retains only one grouped window, not all pages already displayed. */
export function queryEraChroniclePage(store: WorldHistoryStore, era: Pick<WorldEra, "startMonth" | "endMonth">, worldMonth: number, cursor?: EraChronicleCursor): EraChroniclePage {
  const endMonth = getEraChronicleEnd(era, worldMonth);
  if (endMonth < era.startMonth) return { events: [] };
  let remaining = cursor?.remaining ?? [], beforeMonth = cursor?.beforeMonth, hasOlder = cursor?.hasOlder ?? true;
  const events: WorldEvent[] = [];
  for (;;) {
    const count = Math.min(ERA_CHRONICLE_PAGE_SIZE - events.length, remaining.length);
    events.push(...remaining.slice(0, count)); remaining = remaining.slice(count);
    if (events.length === ERA_CHRONICLE_PAGE_SIZE || !hasOlder) break;
    const window = store.getEventWindow({ startMonth: era.startMonth, endMonth: Math.min(endMonth, beforeMonth ?? endMonth), limit: 200 });
    // Windows include complete months/groups. A month cursor survives unrelated appends
    // and retrospective inserts without depending on shifted array indices.
    const oldest = window.events[window.events.length - 1];
    beforeMonth = oldest ? (oldest.monthIndex ?? oldest.year) - 1 : era.startMonth - 1;
    hasOlder = window.hasOlder;
    remaining = groupHistoryNarratives(window.events).filter(event => {
      if (DIPLOMACY_EVENT_TYPES.includes(event.type)) return false;
      const significance = getHistorySignificance(event);
      return significance === "MAJOR" || significance === "LANDMARK";
    });
  }
  return { events, cursor: remaining.length || hasOlder ? { remaining, beforeMonth: beforeMonth!, hasOlder } : undefined };
}

/** Lightweight subscription with explicit reset semantics for hydration/new worlds. */
export function subscribeEraChronicle(store: WorldHistoryStore, onChange: (revision: number, reset: boolean) => void) {
  return store.subscribeAppends(change => onChange(change.revision, change.kind === "reset"));
}
