import {
  RULER_TAG_CONQUEROR_CAPTURE_COUNT,
  RULER_TAG_DECLINE_TERRITORY_DELTA,
  RULER_TAG_EXPANSION_TERRITORY_DELTA,
  RULER_TAG_SHORT_REIGN_MONTHS,
  RULER_TAG_STEWARD_MIN_REIGN_MONTHS,
} from "../config/simulation";
import { formatWorldDuration } from "../Simulation/WorldTime";
import type { WorldEvent } from "../History/WorldHistory";
import { getFactionEventRelation } from "../History/FactionEventRelation";
import {
  evaluateReignOutcome,
  formatTerritoryTransition,
} from "./ReignOutcomeRules";

export interface RulerReignSnapshot {
  month: number;
  population: number;
  territoryShare: number;
  cityCount: number;
  stability: number;
}

export interface RulerChronicle {
  accessionSnapshot: RulerReignSnapshot;
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
  chronicle.peakPopulation = Math.max(chronicle.peakPopulation, snapshot.population);
  chronicle.peakTerritoryShare = Math.max(
    chronicle.peakTerritoryShare,
    snapshot.territoryShare
  );
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
  const end = chronicle.endSnapshot ?? chronicle.accessionSnapshot;
  return end.territoryShare - chronicle.accessionSnapshot.territoryShare;
}

export function buildRulerTags(
  chronicle: RulerChronicle,
  reignMonths: number
) {
  const tags: string[] = [];
  const end = chronicle.endSnapshot ?? chronicle.accessionSnapshot;
  const outcome = evaluateReignOutcome(chronicle.accessionSnapshot, end);

  if (chronicle.foundedStateName) {
    tags.push("开国之君");
  }
  if (chronicle.proclaimedEmperorMonth !== undefined) {
    tags.push("称帝");
  }
  if (
    outcome.outcome === "EXPANSION" ||
    outcome.territoryDelta >= RULER_TAG_EXPANSION_TERRITORY_DELTA ||
    outcome.cityDelta >= 2
  ) {
    tags.push("开疆");
  }
  if (chronicle.citiesCapturedPersonally >= RULER_TAG_CONQUEROR_CAPTURE_COUNT) {
    tags.push("征服者");
  }
  if (chronicle.completedUnification) {
    tags.push("一统");
  }
  if (reignMonths <= RULER_TAG_SHORT_REIGN_MONTHS) {
    tags.push("短祚");
  }
  if (
    outcome.outcome === "DECLINE" &&
    (outcome.territoryDelta <= RULER_TAG_DECLINE_TERRITORY_DELTA ||
      outcome.cityDelta <= -2 ||
      outcome.stabilityDelta <= -18)
  ) {
    tags.push("国势衰退");
  }
  if (chronicle.rebellionsDuringReign > 0) {
    tags.push("内忧");
  }
  if (chronicle.deathCause === "战死") {
    tags.push("战死");
  }
  if (chronicle.deathCause === "流亡") {
    tags.push("流亡");
  }
  if (
    tags.length === 0 &&
    reignMonths >= RULER_TAG_STEWARD_MIN_REIGN_MONTHS &&
    Math.abs(outcome.territoryDelta) < 0.04 &&
    end.stability >= 65
  ) {
    tags.push("守成");
  }
  return tags.slice(0, 3);
}

export function buildRulerAssessment(
  rulerName: string,
  chronicle: RulerChronicle,
  reignMonths: number,
  accessionAge?: number
) {
  const tags = buildRulerTags(chronicle, reignMonths);
  const end = chronicle.endSnapshot ?? chronicle.accessionSnapshot;
  const start = chronicle.accessionSnapshot;
  const outcome = evaluateReignOutcome(start, end);
  const territoryDelta = outcome.territoryDelta;
  const cityDelta = outcome.cityDelta;
  const parts: string[] = [];

  if (accessionAge !== undefined) {
    parts.push(accessionAge < 16 ? `${accessionAge}岁幼年即位。` : `${accessionAge}岁即位。`);
  }

  if (tags.includes("一统")) {
    parts.push(`${rulerName}在位期间完成天下统一。`);
  } else if (tags.includes("开疆")) {
    parts.push(
      `开疆之君，在位期间${formatTerritoryTransition(start.territoryShare, end.territoryShare)}。`
    );
  } else if (tags.includes("国势衰退")) {
    parts.push(
      `国势衰退，在位期间${formatTerritoryTransition(start.territoryShare, end.territoryShare)}。`
    );
  } else if (outcome.outcome === "EXPANSION") {
    parts.push(
      `国势扩张，在位期间${formatTerritoryTransition(start.territoryShare, end.territoryShare)}。`
    );
  } else if (outcome.outcome === "IMPROVEMENT") {
    parts.push(`国势渐进，在位期间人口与稳定有所改善。`);
  } else if (outcome.outcome === "MIXED") {
    parts.push(`功过相参，在位期间国势有升有降。`);
  } else if (tags.includes("守成")) {
    parts.push(`守成之君，在位${formatWorldDuration(reignMonths)}，国家版图基本稳定。`);
  } else {
    parts.push(`${rulerName}在位${formatWorldDuration(reignMonths)}。`);
  }

  if (chronicle.citiesCapturedPersonally > 0) {
    parts.push(`亲征攻陷${chronicle.citiesCapturedPersonally}座城市。`);
  } else if (cityDelta !== 0) {
    parts.push(`治下城市${cityDelta > 0 ? "增加" : "减少"}${Math.abs(cityDelta)}座。`);
  }
  if (chronicle.rebellionsDuringReign > 0) {
    parts.push(`统治期间发生${chronicle.rebellionsDuringReign}次重大内乱。`);
  }
  if (chronicle.deathCause) {
    parts.push(`结局：${chronicle.deathCause}。`);
  }
  if (parts.length === 1 && Math.abs(territoryDelta) >= 0.01) {
    parts.push(`领土变化${territoryDelta > 0 ? "+" : ""}${(territoryDelta * 100).toFixed(1)}%。`);
  }
  return parts.slice(0, 4);
}

const RULER_EVENT_TYPES = new Set<WorldEvent["type"]>([
  "city-captured",
  "city-recovered",
  "capital-fallen",
  "faction-restored",
  "state-founded",
  "emperor-proclaimed",
  "world-unification",
  "empire-split",
  "ruler-captured",
  "ruler-succession",
  "faction-extinct",
  "faction-exiled",
  "faction-dissolved",
]);

const RULER_EVENT_PRIORITIES: Partial<Record<WorldEvent["type"], number>> = {
  "state-founded": 120,
  "emperor-proclaimed": 120,
  "world-unification": 120,
  "faction-restored": 115,
  "ruler-captured": 115,
  "faction-exiled": 110,
  "faction-extinct": 110,
  "faction-dissolved": 100,
  "capital-fallen": 90,
  "empire-split": 90,
  "ruler-succession": 88,
  "city-recovered": 75,
  "city-captured": 65,
};

export function getRulerHistoricalEvents(
  events: WorldEvent[],
  ruler: { id: string; accessionYear: number; endYear?: number },
  factionId: string,
  worldMonth: number,
  notableEventIds: string[]
) {
  const endMonth = ruler.endYear ?? worldMonth;
  const notable = new Set(notableEventIds);
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
      notable.has(event.id);
    if (direct) {
      return true;
    }
    return event.importance === "major" && getFactionEventRelation(event, factionId) !== "NONE";
  });
  const score = (event: WorldEvent) => {
    const direct =
      event.rulerId === ruler.id ||
      event.metadata?.rulerId === ruler.id ||
      event.metadata?.previousRulerId === ruler.id ||
      event.metadata?.nextRulerId === ruler.id;
    return (
      RULER_EVENT_PRIORITIES[event.type] ?? 40
    ) + (direct ? 20 : 0) + (notable.has(event.id) ? 15 : 0) + (event.importance === "major" ? 5 : 0);
  };
  const grouped = new Map<string, WorldEvent>();
  for (const event of candidates) {
    const key = event.historyGroupId ?? event.id;
    const existing = grouped.get(key);
    if (!existing || score(event) > score(existing)) grouped.set(key, event);
  }
  return [...grouped.values()]
    .sort((a, b) => score(b) - score(a) || (a.monthIndex ?? a.year) - (b.monthIndex ?? b.year) || a.id.localeCompare(b.id))
    .slice(0, 6)
    .sort((a, b) => (a.monthIndex ?? a.year) - (b.monthIndex ?? b.year) || a.id.localeCompare(b.id));
}
