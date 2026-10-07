import { DIPLOMACY_EVENT_TYPES } from "./HistoryMajorEventFilters";
import { getFactionColorAtMonth, type FactionColorHistoryEntry } from "../Simulation/FactionColorHistory";
import { getHistoricalFactionIdentity } from "./HistoricalFactionIdentity";
import { formatRulerDiplomacyEvent } from "./RulerDiplomacyFormatter";
import type { WorldEvent, WorldEventCategory } from "./WorldHistory";
import {
  isFeaturedHistoryEvent,
  isMajorPoliticalEvent,
} from "./HistorySignificanceRules";
import {
  getSovereigntyRankAtMonth,
  type FactionIdentityStage,
  type FactionIdentityState,
  type FactionNameHistoryEntry,
  type SovereigntyRank,
  type SovereigntyHistoryEntry,
} from "../Simulation/FactionIdentity";
import { getRegimeStyleNameAtMonth } from "../Simulation/RegimeStyle";
import type { Ruler } from "../Politics/Dynasty";
import { resolveHistoricalRulerDisplay } from "../Politics/HistoricalRulerDisplay";

export const HISTORY_RENDER_BATCH = 200;

export type HistoryFilter = "featured" | "all" | "diplomacy" | WorldEventCategory;

export interface HistoryFactionLike {
  name: string;
  color: number;
  colorHistory?: FactionColorHistoryEntry[];
  displayName?: string;
  identityStage?: string;
  stateFoundedMonth?: number;
  sovereigntyRank?: string;
  sovereigntyHistory?: Array<{
    rank: "LEADER" | "KING" | "EMPEROR";
    startMonth: number;
    endMonth?: number;
  }>;
  nameHistory?: Array<{
    name: string;
    startMonth: number;
    endMonth?: number;
  }>;
}

export function getEventFactionIds(event: WorldEvent) {
  return [
    event.actorFactionId,
    event.targetFactionId,
    event.conquerorFactionId,
    event.previousOwnerFactionId,
    event.founderFactionId,
    ...(event.factionIds ?? []),
    ...(event.relatedFactionIds ?? []),
  ].filter(Boolean) as string[];
}

export function isEventRelatedToFaction(event: WorldEvent, factionName: string) {
  if (getEventFactionIds(event).includes(factionName)) {
    return true;
  }
  if (!event.metadata) {
    return false;
  }
  return Object.values(event.metadata).some((value) => value === factionName);
}

export function getFilteredHistoryEvents(
  events: WorldEvent[],
  filter: HistoryFilter,
  factionFilter?: string
) {
  return events.filter((event) => {
    if (filter === "featured") {
      if (!isFeaturedHistoryEvent(event)) {
        return false;
      }
    } else if (filter === "diplomacy") {
      if (!DIPLOMACY_EVENT_TYPES.includes(event.type)) return false;
    } else if (filter === "politics") {
      if (!isMajorPoliticalEvent(event)) {
        return false;
      }
    } else if (filter !== "all" && event.category !== filter) {
      return false;
    }
    if (factionFilter && !isEventRelatedToFaction(event, factionFilter)) {
      return false;
    }
    return true;
  });
}

export function getRenderedHistoryEvents(
  events: WorldEvent[],
  filter: HistoryFilter,
  visibleCount: number,
  factionFilter?: string
) {
  return getFilteredHistoryEvents(events, filter, factionFilter).slice(0, visibleCount);
}

export function createFactionColorMap(factions: HistoryFactionLike[]) {
  return new Map(factions.map((faction) => [faction.name, faction.color]));
}

export function resolveEventFactionColor(
  event: WorldEvent,
  factionColorById: Map<string, number>,
  factions?: Map<string, HistoryFactionLike>
) {
  const storedColor = event.metadata?.actorFactionColor;
  if (typeof storedColor === "number") return storedColor;
  const faction = event.actorFactionId ? factions?.get(event.actorFactionId) : undefined;
  if (faction?.colorHistory?.length) return getFactionColorAtMonth(faction, event.monthIndex ?? event.year);
  const actorColor =
    event.actorFactionId !== undefined
      ? factionColorById.get(event.actorFactionId)
      : undefined;
  if (actorColor !== undefined) {
    return actorColor;
  }
  const snapshot = event.metadata?.actorFactionColor;
  return typeof snapshot === "number" ? snapshot : undefined;
}

export function resolveFactionHistoricalName(
  factionById: Map<string, HistoryFactionLike>,
  factionId: string | undefined,
  monthIndex: number
) {
  if (!factionId) {
    return "";
  }
  const faction = factionById.get(factionId);
  if (!faction) {
    return factionId;
  }
  return getHistoricalFactionIdentity(faction, monthIndex).name;
}

export function formatHistoryEventTitle(
  event: WorldEvent,
  factionById: Map<string, HistoryFactionLike>,
  rulersById?: Map<string, Ruler>
) {
  const month = event.monthIndex ?? event.year;
  const diplomacy = formatRulerDiplomacyEvent(event, factionById);
  if (diplomacy) return diplomacy;
  const name = (factionId?: string) =>
    resolveFactionHistoricalName(factionById, factionId, month);
  if (event.type === "state-founded") {
    const oldName = stringMeta(event, "oldDisplayName") || name(event.actorFactionId);
    const newName = stringMeta(event, "newDisplayName") || oldName;
    const rulerName = historicalRulerName(event, name, factionById, rulersById);
    return rulerName
      ? `${oldName}正式建国，定国号“${newName}”，首领${rulerName}称王。`
      : `${oldName}正式建国，定国号“${newName}”。`;
  }
  if (event.type === "emperor-proclaimed") {
    const factionName = name(event.actorFactionId);
    const rulerName = historicalRulerName(event, name, factionById, rulersById);
    return rulerName
      ? `${factionName}国威震天下，${factionName}王${rulerName}称帝。`
      : `${factionName}正式建立帝号。`;
  }
  if (event.type === "capital-relocated") {
    return formatCapitalRelocationTitle(event, name);
  }
  if (event.type === "city-captured" || event.type === "capital-fallen") {
    return buildHistoryCityCaptureTitle(
      name(event.actorFactionId),
      name(event.targetFactionId),
      name(event.founderFactionId),
      event.cityName ?? "",
      Number(event.metadata?.wasCapital ?? 0) === 1,
      event.founderFactionId === event.targetFactionId,
      historicalRulerName(event, name, factionById, rulersById)
    );
  }
  if (event.type === "city-recovered") {
    return `${name(event.actorFactionId)}从${name(event.targetFactionId)}手中收复${event.cityName ?? ""}`;
  }
  if (event.metadata?.groupedFoundingEventCount) {
    const parentName = name(
      stringMeta(event, "parentFactionId") || event.targetFactionId
    );
    const factionName = name(event.actorFactionId);
    const cityNames = stringMeta(event, "foundingCityNames");
    const rulerName = stringMeta(event, "foundingRulerName");
    const parentClause = parentName
      ? `${parentName}发生大规模叛乱。`
      : "";
    const cityClause = cityNames
      ? parentName
        ? `${cityNames}脱离${parentName}，`
        : `${cityNames}发生叛乱，`
      : "";
    const rulerClause = rulerName ? `，${rulerName}成为首任君主` : "";
    return `${parentClause}${cityClause}建立${factionName}${rulerClause}。`;
  }
  if (event.metadata?.groupedEventCount) {
    const fallenName = name(event.targetFactionId);
    const conquerorName = name(event.conquerorFactionId);
    const rank = getHistoricalRank(factionById, event.targetFactionId, month);
    const styleName = getHistoricalStyleName(factionById, event.targetFactionId, month);
    const capturedRulerName = stringMeta(event, "capturedRulerName");
    const capturedRulerTitle = stringMeta(event, "capturedRulerTitle");
    const nextRulerName = stringMeta(event, "nextRulerName");
    const nextSuccessionVerb = stringMeta(event, "nextSuccessionVerb") ?? "继位";
    const capturedCityName = stringMeta(event, "capturedCityName");
    const capitalCaptured = Number(event.metadata.capitalCaptured ?? 0) === 1;
    const exiled = Number(event.metadata.exiled ?? 0) === 1;
    const dissolved = Number(event.metadata.dissolved ?? 0) === 1 || rank === "LEADER";
    if (dissolved) {
      return `${fallenName}覆灭。`;
    }
    const opening =
      capturedCityName && conquerorName
        ? `${conquerorName}攻陷${capitalCaptured ? `${fallenName}都` : ""}${capturedCityName}`
        : conquerorName
        ? `${conquerorName}灭${fallenName}`
        : `${fallenName}亡国`;
    const clauses = [
      capturedCityName
        ? rank === "EMPEROR"
          ? `${styleName}亡国`
          : `${fallenName}亡国`
        : undefined,
      capturedRulerTitle || capturedRulerName
        ? `${capturedRulerTitle ?? `${fallenName}王${capturedRulerName}`}被俘处死`
        : undefined,
      nextRulerName ? `${nextRulerName}${nextSuccessionVerb}` : undefined,
      exiled ? (rank === "EMPEROR" ? "帝室流亡" : "王室流亡") : rank === "EMPEROR" ? `${fallenName}帝统断绝，残部亦告消散，${styleName}彻底灭亡` : `${fallenName}王统断绝，残部亦告消散，${styleName}彻底灭亡`,
    ].filter(Boolean);
    return `${opening}，${uniqueStrings(clauses).join("，")}。`;
  }
  if (event.metadata?.groupedRestorationEventCount) {
    return `${name(event.actorFactionId)}国在${event.cityName ?? ""}复国`;
  }
  if (event.type === "faction-exiled") {
    const factionName = name(event.targetFactionId ?? event.factionIds?.[0]);
    const rank = getHistoricalRank(factionById, event.targetFactionId ?? event.factionIds?.[0], month);
    return rank === "EMPEROR"
      ? `${factionName}朝亡国，帝室流亡`
      : `${factionName}失去最后一座城市，${factionName}国亡国`;
  }
  if (event.type === "faction-extinct") {
    const factionName = name(event.targetFactionId ?? event.factionIds?.[0]);
    const styleName = getHistoricalStyleName(factionById, event.targetFactionId ?? event.factionIds?.[0], month);
    const rank = getHistoricalRank(factionById, event.targetFactionId ?? event.factionIds?.[0], month);
    return rank === "EMPEROR"
      ? `${factionName}帝统断绝，残部消散，${styleName}彻底灭亡`
      : `${factionName}王统断绝，残部消散，${styleName}彻底灭亡`;
  }
  if (event.type === "faction-dissolved") {
    const fallenName = name(event.targetFactionId ?? event.factionIds?.[0]);
    const conquerorName = name(event.conquerorFactionId);
    const rank = getHistoricalRank(factionById, event.targetFactionId ?? event.factionIds?.[0], month);
    return rank === "LEADER"
      ? `${conquerorName}平定${formatProvisionalFactionLabel(fallenName)}`
      : `${conquerorName}灭${fallenName}`;
  }
  if (event.type === "faction-restored") {
    return `${name(event.actorFactionId)}国在${event.cityName ?? ""}复国`;
  }
  if (event.type === "world-unification") {
    return `${name(event.actorFactionId)}统一天下`;
  }
  if (event.type === "world-hegemony") {
    return `${name(event.actorFactionId)}确立天下霸权`;
  }
  if (event.type === "world-fractured") {
    return "天下再次分裂";
  }
  if (event.type === "world-era-started") {
    return event.title;
  }
  if (event.type === "empire-split") {
    const parentName = name(event.targetFactionId);
    const cities = stringMeta(event, "foundingCityNames");
    const childName = name(event.actorFactionId);
    return cities
      ? `${cities}脱离${parentName}，${childName}势力建立`
      : `${parentName}发生大规模分裂，${childName}势力建立`;
  }
  if (event.type === "rebel-faction-founded" || event.type === "frontier-faction-founded") {
    return `${name(event.actorFactionId)}兴起`;
  }
  return event.title;
}

export function formatProvisionalFactionLabel(name: string | undefined) {
  if (!name) return "临时势力";
  return /(?:义军|军)$/.test(name) ? name : `${name}义军`;
}

function getHistoricalRank(
  factionById: Map<string, HistoryFactionLike>,
  factionId: string | undefined,
  month: number
) {
  const faction = factionId ? factionById.get(factionId) : undefined;
  if (!faction) {
    return "KING";
  }
  return getSovereigntyRankAtMonth(asIdentityLike(faction), month);
}

function getHistoricalStyleName(
  factionById: Map<string, HistoryFactionLike>,
  factionId: string | undefined,
  month: number
) {
  const faction = factionId ? factionById.get(factionId) : undefined;
  if (!faction) {
    return factionId ?? "";
  }
  return getRegimeStyleNameAtMonth(asIdentityLike(faction), month);
}

function asIdentityLike(
  faction: HistoryFactionLike
): Pick<
  FactionIdentityState,
  | "name"
  | "displayName"
  | "nameHistory"
  | "identityStage"
  | "stateFoundedMonth"
  | "sovereigntyRank"
  | "sovereigntyHistory"
> {
  const identityStage: FactionIdentityStage =
    faction.identityStage === "PROVISIONAL" ? "PROVISIONAL" : "STATE";
  const rank: SovereigntyRank =
    faction.sovereigntyRank === "EMPEROR" || faction.sovereigntyRank === "LEADER"
      ? faction.sovereigntyRank
      : "KING";
  const nameHistory: FactionNameHistoryEntry[] = (faction.nameHistory ?? [
    { name: faction.displayName ?? faction.name, startMonth: 0 },
  ]).map((entry) => ({
    ...entry,
    reason: "reason" in entry && typeof entry.reason === "string" ? entry.reason : "fallback",
  }));
  const sovereigntyHistory: SovereigntyHistoryEntry[] = faction.sovereigntyHistory ?? [
    {
      rank,
      startMonth: 0,
    },
  ];
  return {
    name: faction.name,
    displayName: faction.displayName ?? faction.name,
    nameHistory,
    identityStage,
    stateFoundedMonth: faction.stateFoundedMonth,
    sovereigntyRank: rank,
    sovereigntyHistory,
  };
}

function uniqueStrings(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

export function formatHistoryEventDescription(
  event: WorldEvent,
  factionById: Map<string, HistoryFactionLike>
) {
  // Diplomatic titles already show recorded term/expiry; details expose the evidence.
  // Also applies to old V10 descriptions without rewriting the canonical event.
  if (event.metadata && formatRulerDiplomacyEvent(event, factionById) !== undefined) return undefined;
  const month = event.monthIndex ?? event.year;
  const name = (factionId?: string) =>
    resolveFactionHistoricalName(factionById, factionId, month);
  if (event.type === "city-captured" || event.type === "capital-fallen") {
    return event.cityName ? `${event.cityName}原由${name(event.targetFactionId)}控制。` : event.description;
  }
  if (event.type === "faction-restored") {
    const remnantPopulation = event.metadata?.remnantPopulation;
    return remnantPopulation !== undefined
      ? `${remnantPopulation}名${name(event.actorFactionId)}国残部响应。`
      : event.description;
  }
  if (event.type === "empire-split") {
    return event.description
      ? event.description.replace(event.targetFactionId ?? "", name(event.targetFactionId))
      : undefined;
  }
  if (event.metadata?.groupedEventCount && event.metadata.surrenderedPopulation !== undefined) {
    return `${event.metadata.surrenderedPopulation}名败兵投降。`;
  }
  return event.description;
}

function stringMeta(event: WorldEvent, key: string) {
  const value = event.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function historicalRulerName(
  event: WorldEvent,
  name: (factionId?: string) => string,
  factionById: Map<string, HistoryFactionLike>,
  rulersById?: Map<string, Ruler>
) {
  const rulerId = event.rulerId ?? stringMeta(event, "rulerId");
  const ruler = rulerId ? rulersById?.get(rulerId) : undefined;
  if (ruler && ruler.endYear !== undefined && (ruler.templeName || ruler.posthumousEpithet)) {
    const faction = factionById.get(event.actorFactionId ?? event.targetFactionId ?? "");
    const month = event.monthIndex ?? event.year;
    const rank = faction?.sovereigntyHistory?.find((entry) =>
      month >= entry.startMonth && (entry.endMonth === undefined || month <= entry.endMonth)
    )?.rank;
    return resolveHistoricalRulerDisplay(ruler, name(event.actorFactionId), "compact", { historicalRank: rank });
  }
  return stringMeta(event, "rulerName");
}

function formatCapitalRelocationTitle(
  event: WorldEvent,
  name: (factionId?: string) => string
) {
  const factionName = name(event.actorFactionId);
  const oldCapital = stringMeta(event, "previousCapitalName");
  const newCapital = stringMeta(event, "newCapitalName") ?? event.cityName ?? "";
  if (!oldCapital) {
    return `${factionName}迁都${newCapital}`;
  }
  const cause = stringMeta(event, "cause");
  if (cause === "CAPITAL_DESTROYED") {
    return `${oldCapital}毁于长期战乱，${factionName}遂自${oldCapital}迁都${newCapital}。`;
  }
  const conquerorId = stringMeta(event, "conquerorFactionId");
  const conqueror = conquerorId ? name(conquerorId) : "";
  const rulerName = stringMeta(event, "rulerName");
  const rulerClause = rulerName ? `${rulerName}遂` : `${factionName}遂`;
  return conqueror
    ? `${conqueror}攻陷${factionName}都${oldCapital}，${rulerClause}自${oldCapital}迁都${newCapital}。`
    : `${factionName}自${oldCapital}迁都${newCapital}。`;
}

function buildHistoryCityCaptureTitle(
  attackerName: string,
  previousOwnerName: string,
  founderName: string,
  cityName: string,
  wasCapital: boolean,
  founderCapital: boolean,
  rulerName?: string
) {
  const cityTitle = wasCapital
    ? `${previousOwnerName}都${cityName}`
    : founderCapital
    ? `${founderName}故都${cityName}`
    : cityName;
  const rulerPrefix = rulerName ? `${rulerName}亲征，` : "";
  return `${rulerPrefix}${attackerName}攻陷${cityTitle}`;
}
