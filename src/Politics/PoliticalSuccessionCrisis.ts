import type { WorldEvent } from "../History/WorldHistory";
import type { Ruler } from "./Dynasty";

export interface PoliticalSuccessionShock {
  kind: "CAPITAL_LOSS" | "EMPIRE_SPLIT";
  eventId: string;
  factionId: string;
  predecessorId: string;
  month: number;
  historyGroupId?: string;
  cityIds: string[];
  cityName?: string;
}

/** Only the indexed faction history is supplied, at an actual succession boundary. */
export function derivePoliticalSuccessionShocks(factionId: string, predecessor: Ruler, worldMonth: number, events: readonly WorldEvent[]): PoliticalSuccessionShock[] {
  if (predecessor.accessionYear === undefined) return [];
  const start = Math.max(predecessor.accessionYear, worldMonth - 120);
  const rows: PoliticalSuccessionShock[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    const month = event.monthIndex ?? event.year;
    if (!event.id || seen.has(event.id) || month !== event.year || !Number.isSafeInteger(month) || month < start || month >= worldMonth ||
        event.targetFactionId !== factionId || !event.factionIds?.includes(factionId) || !event.actorFactionId || event.actorFactionId === factionId) continue;
    if (event.type === "capital-fallen" && event.previousOwnerFactionId === factionId && event.cityId && event.cityName && event.metadata?.wasCapital === 1) {
      rows.push({ kind: "CAPITAL_LOSS", eventId: event.id, factionId, predecessorId: predecessor.id, month,
        historyGroupId: event.historyGroupId, cityIds: [event.cityId], cityName: event.cityName });
      seen.add(event.id);
    }
    if (event.type === "empire-split" && event.metadata?.parentFactionId === factionId && typeof event.metadata.foundingCityIds === "string") {
      const cityIds = event.metadata.foundingCityIds.split(",").filter(Boolean);
      if (new Set(cityIds).size !== cityIds.length || cityIds.length < 2 || event.metadata.splitCityCount !== cityIds.length) continue;
      rows.push({ kind: "EMPIRE_SPLIT", eventId: event.id, factionId, predecessorId: predecessor.id, month,
        historyGroupId: event.historyGroupId, cityIds });
      seen.add(event.id);
    }
  }
  return rows.sort((a, b) => b.month - a.month || (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0));
}

/** Different groups and disjoint affected cities prevent counting one political loss twice. */
export function selectIndependentPoliticalShocks(shocks: readonly PoliticalSuccessionShock[], factionId: string | undefined, predecessor: Ruler, worldMonth: number) {
  const valid = shocks.filter(row => row.factionId === factionId && row.predecessorId === predecessor.id &&
    Number.isSafeInteger(row.month) && row.month >= Math.max(predecessor.accessionYear ?? worldMonth, worldMonth - 120) && row.month < worldMonth);
  for (const capital of valid.filter(row => row.kind === "CAPITAL_LOSS" && row.cityIds.length === 1)) {
    const split = valid.find(row => row.kind === "EMPIRE_SPLIT" && row.cityIds.length >= 2 && row.eventId !== capital.eventId &&
      !(row.historyGroupId && row.historyGroupId === capital.historyGroupId) && !row.cityIds.some(id => capital.cityIds.includes(id)));
    if (split) return [capital, split];
  }
  return [];
}
