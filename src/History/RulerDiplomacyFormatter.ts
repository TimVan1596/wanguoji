import type { WorldEvent } from "./WorldHistory";
import { formatDiplomacyRecordedNarrative } from "../Politics/DiplomacyPresentation";
import type { HistoryFactionLike } from "./HistoryRenderRules";
import { getHistoricalFactionIdentity } from "./HistoricalFactionIdentity";

export function formatRulerDiplomacyEvent(
  event: WorldEvent,
  factionById: Map<string, HistoryFactionLike>,
) {
  if (event.type !== "relation-renewed" && event.type !== "truce-signed" && event.type !== "non-aggression-signed" && event.type !== "alliance-signed") return undefined;
  const metadata = event.metadata ?? {};
  const month = event.monthIndex ?? event.year;
  const name = (id: string) => {
    const faction = factionById.get(id);
    return faction ? getHistoricalFactionIdentity(faction, month).name : id;
  };
  const names = (event.factionIds ?? []).slice(0, 2).map(name);
  if (names.length !== 2) return event.title;
  return formatDiplomacyRecordedNarrative(event.type, month, metadata, {
    factionAName: names[0], factionBName: names[1],
    commonThreatName: typeof metadata.commonThreatFactionId === "string" ? name(metadata.commonThreatFactionId) : undefined,
  });
}
