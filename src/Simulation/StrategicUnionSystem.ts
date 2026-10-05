import type Team from "../Components/Team";
import type { WorldEvent } from "../History/WorldHistory";
import type { DiplomaticRelation } from "../Politics/Diplomacy";
import {
  areFactionsTerritoriallyAdjacent,
  areSameOriginFactions,
  canFormStrategicUnion,
  STRATEGIC_UNION_MAX_WEAKER_CITY_RATIO,
  STRATEGIC_UNION_MAX_WEAKER_TERRITORY_RATIO,
  STRATEGIC_UNION_MIN_ALLIANCE_MONTHS,
  STRATEGIC_UNION_VERY_WEAK_MAX_CITIES,
  STRATEGIC_UNION_VERY_WEAK_MAX_STABILITY,
  STRATEGIC_UNION_VERY_WEAK_TERRITORY_SHARE,
} from "../Politics/StrategicUnionRules";
import { DIPLOMACY_COMMON_THREAT_RATIO, DIPLOMACY_RECENT_WAR_MONTHS } from "../Politics/Diplomacy";
import { calculateTerritoryMetrics, getFactionTerritoryMetric } from "./TerritoryMetrics";

export type StrategicUnionBlocker =
  | "NOT_SAME_ORIGIN"
  | "ALLIANCE_TOO_SHORT"
  | "NOT_ADJACENT"
  | "RECENT_BILATERAL_WAR"
  | "POWER_GAP_TOO_SMALL"
  | "CITY_RATIO_TOO_HIGH"
  | "NO_PRESSURE_TRIGGER";

export interface StrategicUnionCandidate {
  absorbingFaction: Team;
  absorbedFaction: Team;
  alliance: DiplomaticRelation;
  commonThreatFactionId?: string;
  absorbingTerritoryShare: number;
  absorbedTerritoryShare: number;
  bilateralWarFreeMonths: number;
}

export interface StrategicUnionCandidateDiagnostic {
  factionAId: string;
  factionBId: string;
  sameOrigin: boolean;
  allianceMonths: number;
  adjacent: boolean;
  bilateralWarFreeMonths: number;
  territoryRatio: number;
  cityRatio: number;
  weakerStability: number;
  commonThreatStillRelevant: boolean;
  blockers: StrategicUnionBlocker[];
  candidate?: StrategicUnionCandidate;
}

interface StrategicUnionInput {
  teams: Team[];
  relations: DiplomaticRelation[];
  totalCells: number;
  worldMonth: number;
  recentEvents: WorldEvent[];
  blockSize: number;
}

export function diagnoseStrategicUnionCandidates(input: StrategicUnionInput): StrategicUnionCandidateDiagnostic[] {
  const activeById = new Map(input.teams.filter((team) => team.status === "ACTIVE").map((team) => [team.name, team]));
  const metrics = calculateTerritoryMetrics(input.teams, input.totalCells);
  const relations = input.relations.filter((relation) => relation.status === "ALLIANCE")
    .sort((a, b) => a.startedMonth - b.startedMonth || a.factionAId.localeCompare(b.factionAId) || a.factionBId.localeCompare(b.factionBId));

  return relations.flatMap((alliance) => {
    const a = activeById.get(alliance.factionAId);
    const b = activeById.get(alliance.factionBId);
    if (!a || !b) return [];
    const sameOrigin = areSameOriginFactions(a, b);
    const adjacent = areFactionsTerritoriallyAdjacent(a, b, input.blockSize);
    const allianceMonths = input.worldMonth - alliance.startedMonth;
    const bilateralWars = input.recentEvents.filter((event) =>
      isBilateralWarEvent(event, a.name, b.name) && (event.monthIndex ?? event.year) >= input.worldMonth - 60);
    const lastWarMonth = bilateralWars.reduce((latest, event) => Math.max(latest, event.monthIndex ?? event.year), -1);
    const warFreeMonths = lastWarMonth < 0 ? 60 : input.worldMonth - lastWarMonth;
    const aMetric = getFactionTerritoryMetric(metrics, a.name);
    const bMetric = getFactionTerritoryMetric(metrics, b.name);
    const aStronger = aMetric.factionControlledBlocks >= bMetric.factionControlledBlocks;
    const stronger = aStronger ? a : b;
    const weaker = aStronger ? b : a;
    const strongerMetric = getFactionTerritoryMetric(metrics, stronger.name);
    const weakerMetric = getFactionTerritoryMetric(metrics, weaker.name);
    const strongerShare = strongerMetric.controlledTerritoryShare;
    const weakerShare = weakerMetric.controlledTerritoryShare;
    const strongerCities = stronger.cities.length;
    const weakerCities = weaker.cities.length;
    const latestEvents = input.recentEvents.filter((event) => (event.monthIndex ?? event.year) >= input.worldMonth - DIPLOMACY_RECENT_WAR_MONTHS);
    const threatId = alliance.commonThreatFactionId;
    const threat = threatId ? activeById.get(threatId) : undefined;
    const threatShare = threat ? getFactionTerritoryMetric(metrics, threat.name).controlledTerritoryShare : 0;
    const commonThreatStillRelevant = Boolean(threat &&
      threatShare >= Math.max(strongerShare, weakerShare, 1) * DIPLOMACY_COMMON_THREAT_RATIO &&
      (areFactionsTerritoriallyAdjacent(weaker, threat, input.blockSize) || latestEvents.some((event) => isBilateralWarEvent(event, weaker.name, threat.name))) &&
      (areFactionsTerritoriallyAdjacent(stronger, threat, input.blockSize) || latestEvents.some((event) => isBilateralWarEvent(event, stronger.name, threat.name))));
    const weakerStability = weaker.cities.length
      ? weaker.cities.reduce((sum, city) => sum + city.loyalty, 0) / weaker.cities.length
      : 0;
    const bilateralWarFreeMonths = warFreeMonths;
    const evidence = {
      sameOrigin,
      bothActive: true,
      allianceMonths,
      adjacent,
      bilateralWarFreeMonths,
      weakerTerritoryShare: weakerShare,
      strongerTerritoryShare: strongerShare,
      weakerCityCount: weakerCities,
      strongerCityCount: strongerCities,
      weakerStability,
      commonThreatStillRelevant,
    };
    const territoryAsymmetric = weakerShare <= strongerShare * STRATEGIC_UNION_MAX_WEAKER_TERRITORY_RATIO;
    const veryWeak = weakerShare <= STRATEGIC_UNION_VERY_WEAK_TERRITORY_SHARE &&
      weakerCities <= STRATEGIC_UNION_VERY_WEAK_MAX_CITIES &&
      weakerStability <= STRATEGIC_UNION_VERY_WEAK_MAX_STABILITY;
    const blockers: StrategicUnionBlocker[] = [];
    if (!sameOrigin) blockers.push("NOT_SAME_ORIGIN");
    if (allianceMonths < STRATEGIC_UNION_MIN_ALLIANCE_MONTHS || bilateralWarFreeMonths < STRATEGIC_UNION_MIN_ALLIANCE_MONTHS) blockers.push("ALLIANCE_TOO_SHORT");
    if (!adjacent) blockers.push("NOT_ADJACENT");
    if (warFreeMonths < 60) blockers.push("RECENT_BILATERAL_WAR");
    if (!territoryAsymmetric) blockers.push("POWER_GAP_TOO_SMALL");
    if (weakerCities > strongerCities * STRATEGIC_UNION_MAX_WEAKER_CITY_RATIO) blockers.push("CITY_RATIO_TOO_HIGH");
    if (!commonThreatStillRelevant && !veryWeak) blockers.push("NO_PRESSURE_TRIGGER");

    const eligible = blockers.length === 0 && canFormStrategicUnion(evidence);
    const candidate = eligible ? {
      absorbingFaction: stronger,
      absorbedFaction: weaker,
      alliance,
      commonThreatFactionId: commonThreatStillRelevant ? threatId : undefined,
      absorbingTerritoryShare: strongerShare,
      absorbedTerritoryShare: weakerShare,
      bilateralWarFreeMonths: warFreeMonths,
    } : undefined;
    return [{
      factionAId: a.name,
      factionBId: b.name,
      sameOrigin,
      allianceMonths,
      adjacent,
      bilateralWarFreeMonths: warFreeMonths,
      territoryRatio: strongerShare > 0 ? weakerShare / strongerShare : 0,
      cityRatio: strongerCities > 0 ? weakerCities / strongerCities : 0,
      weakerStability,
      commonThreatStillRelevant,
      blockers,
      candidate,
    }];
  });
}

export function findStrategicUnionCandidate(input: StrategicUnionInput): StrategicUnionCandidate | undefined {
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
