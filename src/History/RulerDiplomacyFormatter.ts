import { formatRecordedRulerTitle } from "../Politics/RulerTitleRules";
import type { WorldEvent } from "./WorldHistory";
import { formatDiplomacyRecordedNarrative } from "../Politics/DiplomacyPresentation";
import type { HistoryFactionLike } from "./HistoryRenderRules";
import { getHistoricalFactionIdentity } from "./HistoricalFactionIdentity";

export function formatRulerDiplomacyEvent(
  event: WorldEvent,
  factionById: Map<string, HistoryFactionLike>,
  rulerId?: string,
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
  const narrative = formatDiplomacyRecordedNarrative(event.type, month, metadata, {
    factionAName: names[0], factionBName: names[1],
    commonThreatName: typeof metadata.commonThreatFactionId === "string" ? name(metadata.commonThreatFactionId) : undefined,
  });
  if (rulerId && event.type !== "relation-renewed") {
    const side = metadata.signatoryARulerId === rulerId ? "A" : metadata.signatoryBRulerId === rulerId ? "B" : undefined;
    const title = side ? metadata[`signatory${side}Title`] : undefined;
    if (side) return `${typeof title === "string" && title ? `${formatRecordedRulerTitle(title, side === "A" ? names[0] : names[1])}亲自签署：` : "本人参与签署："}${narrative}`;
  }
  return narrative;
}
