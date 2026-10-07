import type { WorldEvent } from "../History/WorldHistory";
import { getFactionEventRelation } from "../History/FactionEventRelation";
import { getHistorySignificance } from "../History/HistorySignificanceRules";
import type { RulerHistoricalEvidence } from "./RulerHistoriography";

export interface RulerReignSnapshot {
  month: number;
  population: number;
  territoryShare: number;
  cityCount: number;
  stability: number;
}

export interface RulerChronicle {
  accessionSnapshot: RulerReignSnapshot;
  latestSnapshot?: RulerReignSnapshot;
  endSnapshot?: RulerReignSnapshot;
  notableEventIds: string[];
  citiesCapturedPersonally: number;
  citiesLostDuringReign: number;
  rebellionsDuringReign: number;
  restorationsDuringReign: number;
  completedUnification: boolean;
  peakPopulation: number;
  peakTerritoryShare: number;
  foundedStateName?: string;
  foundedStateMonth?: number;
  proclaimedEmperorMonth?: number;
  deathCause?: string;
  deathCityId?: string;
}

export function createRulerChronicle(snapshot: RulerReignSnapshot): RulerChronicle {
  return {
    accessionSnapshot: snapshot,
    latestSnapshot: snapshot,
    notableEventIds: [],
    citiesCapturedPersonally: 0,
    citiesLostDuringReign: 0,
    rebellionsDuringReign: 0,
    restorationsDuringReign: 0,
    completedUnification: false,
    peakPopulation: snapshot.population,
    peakTerritoryShare: snapshot.territoryShare,
  };
}

export function observeRulerPeak(
  chronicle: RulerChronicle,
  snapshot: RulerReignSnapshot
) {
  chronicle.latestSnapshot = snapshot;
  chronicle.peakPopulation = Math.max(chronicle.peakPopulation, snapshot.population);
  chronicle.peakTerritoryShare = Math.max(
    chronicle.peakTerritoryShare,
    snapshot.territoryShare
  );
}

export function recordPersonalCityCapture(chronicle: RulerChronicle, eventId?: string) {
  chronicle.citiesCapturedPersonally += 1;
  if (eventId) chronicle.notableEventIds.push(eventId);
}

export function finishRulerChronicle(
  chronicle: RulerChronicle,
  snapshot: RulerReignSnapshot,
  deathCause?: string,
  deathCityId?: string
) {
  chronicle.endSnapshot = snapshot;
  chronicle.deathCause = deathCause;
  chronicle.deathCityId = deathCityId;
  observeRulerPeak(chronicle, snapshot);
}

export function getRulerTerritoryDelta(chronicle: RulerChronicle) {
  const end = getRulerEffectiveSnapshot(chronicle);
  return end.territoryShare - chronicle.accessionSnapshot.territoryShare;
}

export function getRulerEffectiveSnapshot(chronicle: RulerChronicle) {
  return chronicle.endSnapshot ?? chronicle.latestSnapshot ?? chronicle.accessionSnapshot;
}

export function buildRulerTags(evidence: RulerHistoricalEvidence) {
  const tags: string[] = [];
  if (evidence.foundedState) tags.push("开国之君");
  if (evidence.proclaimedEmperor) tags.push("称帝");
  if (evidence.completedUnification || evidence.roles.includes("UNIFIER")) tags.push("一统");
  if (evidence.restorationCount > 0 || evidence.roles.includes("RESTORER")) tags.push("复国");
  if (evidence.roles.includes("EXPANDER")) tags.push("开疆");
  if (evidence.roles.includes("DECLINER")) tags.push("国势衰退");
  if (evidence.roles.includes("STEWARD") && !evidence.roles.includes("EXPANDER")) tags.push("守成");
  if (evidence.roles.includes("EXILED_RULER")) tags.push("流亡");
  if (evidence.roles.includes("CONQUEROR")) tags.push("征服者");
  if (evidence.rebellions > 0) tags.push("内忧");
  if (evidence.roles.includes("SHORT_REIGN")) tags.push("短祚");
  if (evidence.deathCause === "战死") tags.push("战死");
  return tags.slice(0, 3);
}

const RULER_EVENT_TYPES = new Set<WorldEvent["type"]>([
  "heir-died",
  "city-captured",
  "city-recovered",
  "capital-fallen",
  "faction-restored",
  "state-founded",
  "emperor-proclaimed",
  "world-unification",
  "empire-split",
  "ruler-captured",
  "dynasty-usurped",
  "ruler-succession",
  "faction-extinct",
  "faction-exiled",
  "faction-dissolved",
  "city-revolt",
  "rebel-faction-founded",
  "frontier-faction-founded",
  "capital-relocated",
  "dynasty-restored",
  "truce-signed",
  "non-aggression-signed",
  "alliance-signed",
  "relation-renewed",
]);

const RULER_EVENT_PRIORITIES: Partial<Record<WorldEvent["type"], number>> = {
  "heir-died": 82,
  "state-founded": 120,
  "emperor-proclaimed": 120,
  "world-unification": 120,
  "faction-restored": 115,
  "ruler-captured": 115,
  "faction-exiled": 110,
  "faction-extinct": 110,
  "faction-dissolved": 100,
  "capital-fallen": 90,
  "capital-relocated": 100,
  "empire-split": 90,
  "dynasty-usurped": 120,
  "ruler-succession": 88,
  "city-recovered": 75,
  "city-captured": 65,
  "truce-signed": 48,
  "non-aggression-signed": 48,
  "alliance-signed": 52,
  "relation-renewed": 30,
};

export function getRulerHistoricalEvents(
  events: WorldEvent[],
  ruler: { id: string; accessionYear: number; endYear?: number },
  factionId: string,
  worldMonth: number,
  notableEventIds: string[],
  limit = 6
) {
  const endMonth = ruler.endYear ?? worldMonth;
  const notable = new Set(notableEventIds);
  const sourceIds = (event: WorldEvent) =>
    typeof event.metadata?.sourceEventIds === "string"
      ? event.metadata.sourceEventIds.split(",")
      : [];
  const candidates = events.filter((event) => {
    const month = event.monthIndex ?? event.year;
    if (month < ruler.accessionYear || month > endMonth || !RULER_EVENT_TYPES.has(event.type)) {
      return false;
    }
    const direct =
      event.rulerId === ruler.id ||
      event.metadata?.rulerId === ruler.id ||
      event.metadata?.previousRulerId === ruler.id ||
      event.metadata?.nextRulerId === ruler.id ||
      event.metadata?.signatoryARulerId === ruler.id ||
      event.metadata?.signatoryBRulerId === ruler.id ||
      notable.has(event.id) ||
      sourceIds(event).some((id) => notable.has(id));
    if (direct) {
      return true;
    }
    if (event.type === "relation-renewed" || event.type === "truce-signed" || event.type === "non-aggression-signed" || event.type === "alliance-signed") {
      return false;
    }
    return event.importance === "major" && isRulerBiographyRelevantEvent(event, factionId);
  });
  const score = (event: WorldEvent) => {
    const direct =
      event.rulerId === ruler.id ||
      event.metadata?.rulerId === ruler.id ||
      event.metadata?.previousRulerId === ruler.id ||
      event.metadata?.nextRulerId === ruler.id;
    const isSignatory = event.metadata?.signatoryARulerId === ruler.id || event.metadata?.signatoryBRulerId === ruler.id;
    return (
      RULER_EVENT_PRIORITIES[event.type] ?? 40
    ) + (direct || isSignatory ? 20 : 0) + (notable.has(event.id) ? 15 : 0) + (event.importance === "major" ? 5 : 0);
  };
  const grouped = new Map<string, WorldEvent>();
  for (const event of candidates) {
    const key = event.historyGroupId ?? event.id;
    const existing = grouped.get(key);
    if (!existing || score(event) > score(existing)) grouped.set(key, event);
  }
  const ranked = [...grouped.values()]
    .sort((a, b) => score(b) - score(a) || (a.monthIndex ?? a.year) - (b.monthIndex ?? b.year) || a.id.localeCompare(b.id))
  const mandatory = ranked.filter((event) => getHistorySignificance(event) === "LANDMARK" || ["capital-relocated", "dynasty-restored", "city-revolt", "rebel-faction-founded", "frontier-faction-founded"].includes(event.type));
  const selected = [...mandatory, ...ranked.filter((event) => !mandatory.includes(event))].slice(0, Math.max(limit, mandatory.length));
  return selected
    .sort((a, b) => (a.monthIndex ?? a.year) - (b.monthIndex ?? b.year) || a.id.localeCompare(b.id));
}

export function isRulerBiographyRelevantEvent(event: WorldEvent, factionId: string) {
  const relation = getFactionEventRelation(event, factionId);
  if (relation === "NONE") return false;
  if (event.type === "city-captured" || event.type === "city-recovered" || event.type === "capital-fallen") {
    return relation === "ACTOR" || relation === "TARGET" || relation === "CONQUEROR" || relation === "CONQUERED";
  }
  return true;
}
