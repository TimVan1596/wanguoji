import {
  getFactionEventRelation,
  type FactionEventRelation,
} from "./FactionEventRelation";
import {
  formatHistoryEventTitle,
  resolveFactionHistoricalName,
  type HistoryFactionLike,
} from "./HistoryRenderRules";
import type { WorldEvent } from "./WorldHistory";
import {
  getSovereigntyRankAtMonth,
  type FactionIdentityStage,
  type FactionIdentityState,
  type FactionNameHistoryEntry,
  type SovereigntyRank,
  type SovereigntyHistoryEntry,
} from "../Simulation/FactionIdentity";
import { getRegimeStyleNameAtMonth } from "../Simulation/RegimeStyle";

export interface FactionHistoryFactionLike extends HistoryFactionLike {
  identityStage?: "PROVISIONAL" | "STATE" | string;
  stateFoundedMonth?: number;
  sovereigntyRank?: "LEADER" | "KING" | "EMPEROR" | string;
  sovereigntyHistory?: Array<{
    rank: "LEADER" | "KING" | "EMPEROR";
    startMonth: number;
    endMonth?: number;
  }>;
}

export function formatFactionHistoryEvent(
  event: WorldEvent,
  factionId: string,
  factionById: Map<string, FactionHistoryFactionLike>
) {
  const relation = getFactionEventRelation(event, factionId);
  if (relation === "NONE") {
    return undefined;
  }
  const month = event.monthIndex ?? event.year;
  const name = (id?: string) => resolveFactionHistoricalName(factionById, id, month);
  const selectedName = name(factionId);

  if (event.metadata?.groupedFoundingEventCount || event.type === "empire-split") {
    return formatFounding(event, relation, factionId, factionById);
  }
  if (event.type === "state-founded") {
    const oldName = stringMeta(event, "oldDisplayName") || selectedName;
    const newName = stringMeta(event, "newDisplayName") || selectedName;
    const rulerName = stringMeta(event, "rulerName");
    return rulerName
      ? `${oldName}正式建国，定国号“${newName}”，${rulerName}称王。`
      : `${oldName}正式建国，定国号“${newName}”。`;
  }
  if (event.type === "emperor-proclaimed") {
    const rulerName = stringMeta(event, "rulerName");
    const styleName = getStyleName(factionById, factionId, month);
    return rulerName
      ? `${selectedName}王${rulerName}称帝，${styleName}建立。`
      : `${styleName}建立帝号。`;
  }
  if (event.type === "faction-dissolved") {
    return relation === "CONQUEROR"
      ? `${selectedName}平定${name(event.targetFactionId) ?? "临时势力"}。`
      : `${selectedName}覆灭。`;
  }
  if (event.metadata?.groupedEventCount) {
    return formatCollapse(event, relation, factionId, factionById);
  }
  if (event.metadata?.groupedRestorationEventCount || event.type === "faction-restored") {
    return event.cityName
      ? `${selectedName}在${event.cityName}复国。`
      : `${selectedName}复国。`;
  }
  if (event.type === "faction-exiled") {
    if (relation === "CONQUEROR") {
      const fallenName = name(event.targetFactionId);
      const cityName = stringMeta(event, "capturedCityName") || event.cityName;
      return cityName
        ? `${selectedName}攻陷${fallenName}都${cityName}，灭${fallenName}。`
        : `${selectedName}灭${fallenName}。`;
    }
    const rulerTitle = stringMeta(event, "rulerTitle") || stringMeta(event, "rulerName");
    return rulerTitle
      ? `${selectedName}亡国，${rulerTitle}率王室流亡。`
      : `${selectedName}亡国，王室流亡。`;
  }
  if (event.type === "faction-extinct") {
    if (relation === "CONQUEROR") {
      const fallenName = name(event.targetFactionId);
      return `${fallenName}彻底灭亡，${selectedName}消除其残部。`;
    }
    const styleName = getStyleName(factionById, factionId, month);
    const rank = getRank(factionById, factionId, month);
    if (rank === "EMPEROR") {
      return `${selectedName}帝统断绝，残部消散，${styleName}彻底灭亡。`;
    }
    return `${selectedName}王统断绝，残部消散，${styleName}彻底灭亡。`;
  }
  if (event.type === "world-unification") {
    return `${selectedName}统一天下。`;
  }
  if (event.type === "world-fractured") {
    return `${selectedName}的一统局面瓦解。`;
  }
  return formatHistoryEventTitle(event, factionById);
}

function formatFounding(
  event: WorldEvent,
  relation: FactionEventRelation,
  factionId: string,
  factionById: Map<string, FactionHistoryFactionLike>
) {
  const month = event.monthIndex ?? event.year;
  const name = (id?: string) => resolveFactionHistoricalName(factionById, id, month);
  const childName = name(event.actorFactionId);
  const parentId = stringMeta(event, "parentFactionId") || event.targetFactionId;
  const parentName = name(parentId);
  const cityNames = stringMeta(event, "foundingCityNames");
  const rulerName = stringMeta(event, "foundingRulerName");
  const rulerClause = rulerName ? `，${rulerName}成为首任首领` : "";
  if (relation === "PARENT") {
    return cityNames
      ? `${cityNames}脱离${parentName}，${childName}建立。`
      : `${childName}脱离${parentName}而起。`;
  }
  const originClause = cityNames
    ? `${cityNames}脱离${parentName || "旧政权"}，`
    : parentName
    ? `脱离${parentName}，`
    : "";
  const suffix = event.actorFactionId === factionId ? "，成为本政权的前身" : "";
  return `${originClause}${childName}建立${rulerClause}${suffix}。`;
}

function formatCollapse(
  event: WorldEvent,
  relation: FactionEventRelation,
  factionId: string,
  factionById: Map<string, FactionHistoryFactionLike>
) {
  const month = event.monthIndex ?? event.year;
  const name = (id?: string) => resolveFactionHistoricalName(factionById, id, month);
  const fallenId = event.targetFactionId;
  const fallenName = name(fallenId);
  const conquerorName = name(event.conquerorFactionId);
  const cityName = stringMeta(event, "capturedCityName");
  const exiled = Number(event.metadata?.exiled ?? 0) === 1;
  if (relation === "CONQUEROR") {
    const opening = cityName ? `${conquerorName}攻陷${fallenName}都${cityName}` : `${conquerorName}击败${fallenName}`;
    const rulerTitle = stringMeta(event, "capturedRulerTitle");
    const rulerClause = rulerTitle ? `；${rulerTitle}被俘处死` : "";
    const result = exiled ? `灭${fallenName}` : `${fallenName}彻底灭亡`;
    return `${opening}，${result}${rulerClause}。`;
  }
  const rank = getRank(factionById, factionId, month);
  if (rank === "LEADER") {
    return `${fallenName}覆灭。`;
  }
  const rulerTitle = stringMeta(event, "capturedRulerTitle");
  const rulerClause = rulerTitle ? `${rulerTitle}被俘处死，` : "";
  const opening = cityName && conquerorName ? `${conquerorName}攻陷${fallenName}都${cityName}，` : "";
  if (rank === "EMPEROR") {
    return exiled
      ? `${opening}${fallenName}朝亡国，${rulerClause}帝室流亡。`
      : `${fallenName}帝统断绝，残部消散，${fallenName}朝彻底灭亡。`;
  }
  return exiled
    ? `${opening}${fallenName}亡国，${rulerClause}王室流亡。`
    : `${fallenName}王统断绝，残部消散，${fallenName}国彻底灭亡。`;
}

function getStyleName(
  factionById: Map<string, FactionHistoryFactionLike>,
  factionId: string,
  month: number
) {
  const faction = factionById.get(factionId);
  if (!faction) {
    return factionId;
  }
  return getRegimeStyleNameAtMonth(asIdentityLike(faction), month);
}

function getRank(
  factionById: Map<string, FactionHistoryFactionLike>,
  factionId: string,
  month: number
) {
  const faction = factionById.get(factionId);
  if (!faction) {
    return "KING";
  }
  return getSovereigntyRankAtMonth(asIdentityLike(faction), month);
}

function asIdentityLike(
  faction: FactionHistoryFactionLike
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

function stringMeta(event: WorldEvent, key: string) {
  const value = event.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}
