import { groupHistoryNarratives } from "../../../History/HistoryNarrativeGrouper";
import { getFilteredHistoryEvents, type HistoryFilter } from "../../../History/HistoryRenderRules";
import { matchesMajorEventFilter, type MajorEventFilter } from "../../../History/HistoryMajorEventFilters";
import type { WorldEvent } from "../../../History/WorldHistory";

export interface HistoryBrowsingOptions {
  filter: HistoryFilter; eventTypeFilter?: MajorEventFilter; factionId?: string; startMonth?: number; endMonth?: number;
}
/** UI-only state; append payloads only, never an archive/seen-id collection. */
export class HistoryBrowsingSession {
  followingLatest = true;
  unseenCount = 0;
  scroll(scrollTop: number) {
    this.followingLatest = scrollTop <= 32;
    if (this.followingLatest) this.unseenCount = 0;
  }
  reset() { this.followingLatest = true; this.unseenCount = 0; }
  append(events: readonly WorldEvent[], options: HistoryBrowsingOptions) {
    if (this.followingLatest) return;
    const inRange = events.filter(event => (event.monthIndex ?? event.year) >= (options.startMonth ?? -Infinity)
      && (event.monthIndex ?? event.year) <= (options.endMonth ?? Infinity));
    const matching = getFilteredHistoryEvents(groupHistoryNarratives(inRange), options.filter, options.factionId)
      .filter(event => options.filter !== "featured" || matchesMajorEventFilter(event, options.eventTypeFilter));
    this.unseenCount += matching.length;
  }
}
