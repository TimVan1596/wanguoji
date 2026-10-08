import { getHistoricalFactionIdentity } from "./HistoricalFactionIdentity";
import type { WorldEvent } from "./WorldHistory";
import type { Ruler } from "../Politics/Dynasty";
import { formatHistoryEventTitle, formatHistoryEventDescription, type HistoryFactionLike } from "./HistoryRenderRules";

// One card's title, description and details always share the same event object/ID.
export function getHistoryCardPresentation(event: WorldEvent, expandedId: string | undefined,
  factions: Map<string, HistoryFactionLike>, rulers?: Map<string, Ruler>) {
  return { id: event.id, event, expanded: expandedId === event.id,
    title: formatHistoryEventTitle(event, factions, rulers),
    description: formatHistoryEventDescription(event, factions) };
}

export function getHistoryCardFactionView<T extends HistoryFactionLike>(factions: Map<string, T>, month: number) {
  return new Map([...factions].map(([id, faction]) => {
    const identity = getHistoricalFactionIdentity(faction, month);
    return [id, { ...faction, displayName: identity.name, color: identity.color } as T];
  }));
}
