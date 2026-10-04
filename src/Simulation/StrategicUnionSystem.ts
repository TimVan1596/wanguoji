import type Team from "../Components/Team";
import type { DiplomaticRelation } from "../Politics/Diplomacy";
import {
  areFactionsTerritoriallyAdjacent,
  areSameOriginFactions,
  canFormStrategicUnion,
  STRATEGIC_UNION_MAX_WEAKER_TERRITORY_RATIO,
} from "../Politics/StrategicUnionRules";
import { calculateTerritoryMetrics, getFactionTerritoryMetric } from "./TerritoryMetrics";
import type { WorldEvent } from "../History/WorldHistory";
import { DIPLOMACY_COMMON_THREAT_RATIO, DIPLOMACY_RECENT_WAR_MONTHS } from "../Politics/Diplomacy";

export interface StrategicUnionCandidate {
  absorbingFaction: Team;
  absorbedFaction: Team;
  alliance: DiplomaticRelation;
  commonThreatFactionId?: string;
  absorbingTerritoryShare: number;
  absorbedTerritoryShare: number;
  bilateralWarFreeMonths: number;
}

export function findStrategicUnionCandidate(input: {
  teams: Team[];
  relations: DiplomaticRelation[];
  totalCells: number;
  worldMonth: number;
  recentEvents: WorldEvent[];
  blockSize: number;
}): StrategicUnionCandidate | undefined {
  const activeById = new Map(input.teams.filter((team) => team.status === "ACTIVE").map((team) => [team.name, team]));
  const metrics = calculateTerritoryMetrics(input.teams, input.totalCells);
  const relations = input.relations.filter((relation) => relation.status === "ALLIANCE")
    .sort((a, b) => a.startedMonth - b.startedMonth || a.factionAId.localeCompare(b.factionAId) || a.factionBId.localeCompare(b.factionBId));

  for (const alliance of relations) {
    const a = activeById.get(alliance.factionAId);
    const b = activeById.get(alliance.factionBId);
    if (!a || !b || !areSameOriginFactions(a, b)) continue;
    if (!areFactionsTerritoriallyAdjacent(a, b, input.blockSize)) continue;
    const allianceMonths = input.worldMonth - alliance.startedMonth;
    const bilateralWars = input.recentEvents.filter((event) =>
      isBilateralWarEvent(event, a.name, b.name) && (event.monthIndex ?? event.year) >= input.worldMonth - 60);
    const lastWarMonth = bilateralWars.reduce((latest, event) => Math.max(latest, event.monthIndex ?? event.year), -1);
    const warFreeMonths = lastWarMonth < 0 ? 60 : input.worldMonth - lastWarMonth;
    const aMetric = getFactionTerritoryMetric(metrics, a.name);
    const bMetric = getFactionTerritoryMetric(metrics, b.name);
    const aStronger = aMetric.factionControlledBlocks > bMetric.factionControlledBlocks;
    if (aMetric.factionControlledBlocks === bMetric.factionControlledBlocks) continue;
    const stronger = aStronger ? a : b;
    const weaker = aStronger ? b : a;
    const strongerShare = getFactionTerritoryMetric(metrics, stronger.name).controlledTerritoryShare;
    const weakerShare = getFactionTerritoryMetric(metrics, weaker.name).controlledTerritoryShare;
    const strongerCities = stronger.cities.length;
    const weakerCities = weaker.cities.length;
    const latestEvents = input.recentEvents.filter((event) => (event.monthIndex ?? event.year) >= input.worldMonth - DIPLOMACY_RECENT_WAR_MONTHS);
    const commonThreatFactionId = alliance.commonThreatFactionId;
    const threat = commonThreatFactionId ? activeById.get(commonThreatFactionId) : undefined;
    const threatShare = threat ? getFactionTerritoryMetric(metrics, threat.name).controlledTerritoryShare : 0;
    const threatPressure = Boolean(threat &&
      threatShare >= Math.max(strongerShare, weakerShare, 1) * DIPLOMACY_COMMON_THREAT_RATIO &&
      (areFactionsTerritoriallyAdjacent(weaker, threat, input.blockSize) || latestEvents.some((event) => isBilateralWarEvent(event, weaker.name, threat.name))) &&
      (areFactionsTerritoriallyAdjacent(stronger, threat, input.blockSize) || latestEvents.some((event) => isBilateralWarEvent(event, stronger.name, threat.name))));
    const stability = weaker.cities.length
      ? weaker.cities.reduce((sum, city) => sum + city.loyalty, 0) / weaker.cities.length
      : 0;
    if (!canFormStrategicUnion({
      sameOrigin: true,
      bothActive: true,
      allianceMonths,
      adjacent: true,
      bilateralWarFreeMonths: warFreeMonths,
      weakerTerritoryShare: weakerShare,
      strongerTerritoryShare: strongerShare,
      weakerCityCount: weakerCities,
      strongerCityCount: strongerCities,
      weakerStability: stability,
      commonThreatStillRelevant: threatPressure,
    })) continue;
    if (weakerShare > strongerShare * STRATEGIC_UNION_MAX_WEAKER_TERRITORY_RATIO && !threatPressure) continue;
    return {
      absorbingFaction: stronger,
      absorbedFaction: weaker,
      alliance,
      commonThreatFactionId: threatPressure ? commonThreatFactionId : undefined,
      absorbingTerritoryShare: strongerShare,
      absorbedTerritoryShare: weakerShare,
      bilateralWarFreeMonths: warFreeMonths,
    };
  }
  return undefined;
}

function isBilateralWarEvent(event: WorldEvent, aId: string, bId: string) {
  if (event.type !== "city-captured" && event.type !== "capital-fallen") return false;
  const factions = new Set([...(event.factionIds ?? []), event.actorFactionId, event.targetFactionId]
    .filter((id): id is string => Boolean(id)));
  return factions.has(aId) && factions.has(bId);
}
