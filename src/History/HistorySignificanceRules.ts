import type { WorldEvent } from "./WorldHistory";
import { getFactionEventRelation } from "./FactionEventRelation";

export type HistorySignificance = "MINOR" | "NORMAL" | "MAJOR" | "LANDMARK";

const MAJOR_POLITICAL_TYPES = new Set<WorldEvent["type"]>([
  "world-born",
  "world-unification",
  "world-fractured",
  "world-era-started",
  "world-hegemony",
  "empire-split",
  "state-founded",
  "emperor-proclaimed",
  "faction-exiled",
  "faction-extinct",
  "faction-restored",
  "rebel-faction-founded",
  "frontier-faction-founded",
  "capital-relocated",
  "dynasty-restored",
  "dynasty-line-ended",
  "god-restoration",
  "god-rebellion",
]);

const LANDMARK_TYPES = new Set<WorldEvent["type"]>([
  "world-born",
  "world-unification",
  "world-fractured",
  "world-era-started",
  "empire-split",
  "state-founded",
  "emperor-proclaimed",
  "faction-exiled",
  "faction-extinct",
  "faction-restored",
  "rebel-faction-founded",
  "frontier-faction-founded",
]);

const ROUTINE_POLITICAL_TYPES = new Set<WorldEvent["type"]>([
  "ruler-died",
  "ruler-acceded",
  "ruler-succession",
  "city-founded",
  "city-revolt",
  "population-surrendered",
  "population-milestone",
  "population-leader",
]);

export function isMajorPoliticalEvent(event: WorldEvent) {
  if (getHistorySignificance(event) === "LANDMARK") {
    return true;
  }
  if (event.type === "ruler-captured") {
    return Boolean(event.targetFactionId || event.metadata?.captorFactionId);
  }
  if (event.type === "territory-milestone") {
    const milestone = Number(event.metadata?.milestone ?? 0);
    return milestone >= 25;
  }
  if (ROUTINE_POLITICAL_TYPES.has(event.type)) {
    return false;
  }
  return event.category === "politics" && event.importance === "major";
}

export function getHistorySignificance(event: WorldEvent): HistorySignificance {
  if (
    event.metadata?.groupedEventCount ||
    event.metadata?.groupedFoundingEventCount ||
    event.metadata?.groupedRestorationEventCount ||
    LANDMARK_TYPES.has(event.type)
  ) {
    return "LANDMARK";
  }
  if (event.type === "capital-fallen") {
    return "MAJOR";
  }
  if (event.type === "territory-milestone") {
    const milestone = Number(event.metadata?.milestone ?? 0);
    return milestone >= 25 ? "MAJOR" : "NORMAL";
  }
  if (event.type === "ruler-captured") {
    return "MAJOR";
  }
  if (MAJOR_POLITICAL_TYPES.has(event.type)) {
    return "MAJOR";
  }
  if (
    event.type === "population-surrendered" ||
    event.type === "population-milestone" ||
    event.type === "population-leader"
  ) {
    return "MINOR";
  }
  if (ROUTINE_POLITICAL_TYPES.has(event.type)) {
    return "NORMAL";
  }
  return event.importance === "major" ? "MAJOR" : "NORMAL";
}

export function isFeaturedHistoryEvent(event: WorldEvent) {
  const significance = getHistorySignificance(event);
  if (significance !== "MAJOR" && significance !== "LANDMARK") {
    return false;
  }
  if (
    event.type === "capital-fallen" ||
    event.type === "city-captured" ||
    event.type === "city-revolt" ||
    event.type === "ruler-captured"
  ) {
    return Boolean(
      event.metadata?.groupedEventCount ||
        event.metadata?.groupedFoundingEventCount ||
        event.metadata?.groupedRestorationEventCount
    );
  }
  return true;
}

export function isLandmarkHistoryEvent(event: WorldEvent) {
  return getHistorySignificance(event) === "LANDMARK";
}

export function getMajorPoliticalEventsForFaction(
  events: WorldEvent[],
  factionId: string
) {
  return events.filter(
    (event) =>
      isMajorPoliticalEvent(event) &&
      getFactionEventRelation(event, factionId) !== "NONE"
  );
}

export function selectMajorTimelineMarkers(
  events: WorldEvent[],
  factionId: string,
  limit = 10
) {
  const ranked = getMajorPoliticalEventsForFaction(events, factionId)
    .map((event) => ({
      event,
      score: getEventMarkerScore(event),
    }))
    .sort((a, b) => b.score - a.score || getEventMonth(a.event) - getEventMonth(b.event))
    .slice(0, limit)
    .sort((a, b) => getEventMonth(a.event) - getEventMonth(b.event));
  return ranked.map((item) => item.event);
}

function getEventMarkerScore(event: WorldEvent) {
  if (event.type === "world-unification") {
    return 100;
  }
  if (event.type === "state-founded") {
    return 90;
  }
  if (event.type === "emperor-proclaimed") {
    return 92;
  }
  if (
    event.type === "faction-exiled" ||
    event.type === "faction-extinct" ||
    event.type === "faction-restored"
  ) {
    return 85;
  }
  if (event.type === "empire-split" || event.type === "world-fractured") {
    return 80;
  }
  if (event.type === "rebel-faction-founded" || event.type === "frontier-faction-founded") {
    return 75;
  }
  if (event.type === "territory-milestone") {
    return 65;
  }
  return event.importance === "major" ? 50 : 10;
}

function getEventMonth(event: WorldEvent) {
  return event.monthIndex ?? event.year;
}
