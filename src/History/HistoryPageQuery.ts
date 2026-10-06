import { groupHistoryNarratives } from "./HistoryNarrativeGrouper";
import { getFilteredHistoryEvents, type HistoryFilter } from "./HistoryRenderRules";
import type { WorldHistoryStore, WorldEvent } from "./WorldHistory";
import { frameAttribution } from "../Simulation/FrameAttribution";

/** Read-only UI query over the authoritative history index. Each temporary window is
 * bounded by a page plus complete narrative chains, never a full-history publication. */
export function queryHistoryPage(store: WorldHistoryStore, options: {
  visibleCount: number; filter: HistoryFilter; factionId?: string; startMonth?: number; endMonth?: number;
}) {
  return frameAttribution.measure("history UI query derivation", () => {
    const result: WorldEvent[] = [];
    let beforeIndex: number | undefined;
    for (;;) {
      const window = store.getEventWindow({ ...options, limit: 200, beforeIndex,
        predicate: (event) => getFilteredHistoryEvents([event],
          options.filter === "featured" ? "all" : options.filter, options.factionId).length > 0 });
      const grouped = groupHistoryNarratives(window.events);
      const display = options.filter === "featured"
        ? getFilteredHistoryEvents(grouped, "featured", options.factionId) : grouped;
      for (const event of display) {
        if (result.length === options.visibleCount) return { events: result, hasMore: true };
        result.push(event);
      }
      if (!window.hasOlder) return { events: result, hasMore: false };
      beforeIndex = window.nextIndex;
    }
  });
}
