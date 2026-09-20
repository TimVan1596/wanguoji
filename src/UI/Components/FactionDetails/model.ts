import { formatWorldDate, formatWorldDuration } from "../../../Simulation/WorldTime";
import {
  EMPEROR_MIN_CITY_SHARE,
  EMPEROR_MIN_KING_MONTHS,
  EMPEROR_MIN_LEAD_SHARE,
  EMPEROR_MIN_STABILITY,
  EMPEROR_MIN_TERRITORY_SHARE,
  EMPEROR_REQUIRED_MONTHS,
  STATE_FORMATION_MIN_ACTIVE_MONTHS,
  STATE_FORMATION_MIN_CITIES,
  STATE_FORMATION_MIN_STABILITY,
  STATE_FORMATION_REQUIRED_MONTHS,
} from "../../../Simulation/FactionIdentity";
import { EMPEROR_EFFECTIVE_STABILITY_BONUS } from "../../../Simulation/SovereigntyModifiers";

export interface FactionDetailsTeamLike {
  name: string;
  displayName?: string;
  factionType?: string;
  identityStage?: string;
  firstFoundedYear?: number;
  currentActiveSinceYear?: number;
  lastExiledYear?: number;
  extinctionYear?: number;
  restorationYears?: number[];
  stateFoundedMonth?: number;
  stateFormationEligibleSinceMonth?: number;
  sovereigntyRank?: string;
  emperorEligibleSinceMonth?: number;
  proclaimedEmperorMonth?: number;
  status?: string;
  cities?: unknown[];
  nameHistory?: Array<{
    name: string;
    startMonth: number;
    endMonth?: number;
  }>;
  origin?: {
    type?: string;
    foundedMonth?: number;
    parentFactionId?: string;
    foundingCityIds?: string[];
    foundingRulerId?: string;
  };
  getDisplayNameAtMonth?: (month: number) => string;
  getCumulativeActiveYears?: (month: number) => number;
}

export interface OverviewSectionsInput {
  team: FactionDetailsTeamLike;
  teams: FactionDetailsTeamLike[];
  cityNameById: Map<string, string>;
  rulerNameById: Map<string, string>;
  worldMonth: number;
  remnantPopulation: number;
  exileLegitimacy?: number;
  foundingKingName?: string;
  foundingEmperorName?: string;
}

export interface EmperorQualificationInput {
  team: FactionDetailsTeamLike;
  worldMonth: number;
  territoryShare: number;
  cityShare: number;
  leadShare?: number;
  effectiveStability: number | undefined;
  hasFormalRuler: boolean;
}

export function resolveFactionNameAtMonthSafe(
  faction: FactionDetailsTeamLike | undefined,
  month: number
) {
  if (!faction) {
    return undefined;
  }
  if (typeof faction.getDisplayNameAtMonth === "function") {
    return faction.getDisplayNameAtMonth(month);
  }
  const matched = faction.nameHistory?.find(
    (entry) =>
      month >= entry.startMonth &&
      (entry.endMonth === undefined || month <= entry.endMonth)
  );
  return matched?.name ?? faction.displayName ?? faction.name;
}

export function getCumulativeActiveMonthsSafe(
  faction: FactionDetailsTeamLike,
  worldMonth: number
) {
  if (typeof faction.getCumulativeActiveYears === "function") {
    return faction.getCumulativeActiveYears(worldMonth);
  }
  const firstFounded = faction.firstFoundedYear ?? 0;
  if (faction.status === "EXTINCT") {
    return Math.max(0, (faction.extinctionYear ?? worldMonth) - firstFounded);
  }
  if (faction.status === "EXILED") {
    return Math.max(0, (faction.lastExiledYear ?? worldMonth) - firstFounded);
  }
  return Math.max(0, worldMonth - firstFounded);
}

export function buildFactionIdentityLines(
  team: FactionDetailsTeamLike,
  teams: FactionDetailsTeamLike[],
  cityNameById: Map<string, string>,
  rulerNameById: Map<string, string>
) {
  const lines: string[] = [];
  const origin = team.origin;
  if (!origin || !origin.type || origin.type === "INITIAL") {
    lines.push("政权来源：初始政权");
  } else {
    const foundedMonth = origin.foundedMonth ?? team.firstFoundedYear ?? 0;
    const parent = teams.find((item) => item.name === origin.parentFactionId);
    const parentName =
      resolveFactionNameAtMonthSafe(parent, foundedMonth) ?? origin.parentFactionId;
    lines.push(
      `政权来源：${parentName ? `${parentName}分裂` : formatIdentityStage(team.factionType)}`
    );
    const firstName = team.nameHistory?.[0]?.name;
    if (firstName && firstName !== team.displayName) {
      lines.push(`前身：${firstName}`);
    }
    const cityNames = (origin.foundingCityIds ?? [])
      .map((id) => cityNameById.get(id))
      .filter(Boolean) as string[];
    if (cityNames.length > 0) {
      lines.push(`发源：${cityNames.join("、")}`);
    }
    const foundingRuler = origin.foundingRulerId
      ? rulerNameById.get(origin.foundingRulerId)
      : undefined;
    if (foundingRuler) {
      lines.push(`首任首领：${foundingRuler}`);
    }
  }
  if (team.identityStage === "STATE") {
    lines.push(`政权等级：${team.sovereigntyRank === "EMPEROR" ? "帝国" : "王国"}`);
    lines.push(
      `正式建国：${
        team.stateFoundedMonth !== undefined
          ? formatWorldDate(team.stateFoundedMonth)
          : "—"
      }`
    );
    if (team.sovereigntyRank === "EMPEROR") {
      lines.push(
        `称帝：${
          team.proclaimedEmperorMonth !== undefined
            ? formatWorldDate(team.proclaimedEmperorMonth)
            : "—"
        }`
      );
      lines.push(`帝统威望：+${EMPEROR_EFFECTIVE_STABILITY_BONUS}稳定`);
    }
  } else {
    lines.push(`政权形态：${formatIdentityStage(team.factionType)} · 尚未正式建国`);
  }
  lines.push(`建立：${formatWorldDate(origin?.foundedMonth ?? team.firstFoundedYear ?? 0)}`);
  return lines;
}

export function buildFactionOverviewSections(input: OverviewSectionsInput) {
  const {
    team,
    teams,
    cityNameById,
    rulerNameById,
    worldMonth,
    remnantPopulation,
    exileLegitimacy,
    foundingKingName,
    foundingEmperorName,
  } = input;
  const origin = team.origin;
  const lineage = origin?.type === "INITIAL" ? undefined : buildLineage(team);
  const identityLines = [
    lineage ? `政权源流：${lineage}` : !origin || origin.type === "INITIAL" ? "政权源流：初始政权" : undefined,
    `建立：${formatWorldDate(origin?.foundedMonth ?? team.firstFoundedYear ?? 0)}`,
    ...buildOriginFactLines(team, teams, cityNameById, rulerNameById),
    team.identityStage === "STATE" && team.stateFoundedMonth !== undefined
      ? `正式建国：${formatWorldDate(team.stateFoundedMonth)}`
      : undefined,
    foundingKingName ? `开国之王：${foundingKingName}` : undefined,
    team.sovereigntyRank === "EMPEROR" && team.proclaimedEmperorMonth !== undefined
      ? `称帝：${formatWorldDate(team.proclaimedEmperorMonth)}`
      : undefined,
    foundingEmperorName ? `开国皇帝：${foundingEmperorName}` : undefined,
  ].filter(Boolean) as string[];

  const legacyLines = buildLegacyLines(
    team,
    worldMonth,
    remnantPopulation,
    exileLegitimacy
  );
  return {
    identityLines,
    legacyLines,
  };
}

export function buildEmperorQualificationLines(input: EmperorQualificationInput) {
  const {
    team,
    worldMonth,
    territoryShare,
    cityShare,
    effectiveStability,
    hasFormalRuler,
  } = input;
  if (team.identityStage !== "STATE" || team.status !== "ACTIVE") {
    return [];
  }
  if (team.sovereigntyRank === "EMPEROR") {
    return [
      "帝统已立",
      `称帝：${
        team.proclaimedEmperorMonth !== undefined
          ? formatWorldDate(team.proclaimedEmperorMonth)
          : "—"
      }`,
    ];
  }
  if (team.sovereigntyRank !== "KING") {
    return [];
  }
  const kingMonths = Math.max(0, worldMonth - (team.stateFoundedMonth ?? worldMonth));
  const safeStability = effectiveStability ?? 0;
  const baseReady =
    kingMonths >= EMPEROR_MIN_KING_MONTHS &&
    territoryShare >= EMPEROR_MIN_TERRITORY_SHARE &&
    cityShare >= EMPEROR_MIN_CITY_SHARE &&
    (input.leadShare ?? -Infinity) >= EMPEROR_MIN_LEAD_SHARE &&
    safeStability >= EMPEROR_MIN_STABILITY &&
    hasFormalRuler;
  const integratingMonths =
    baseReady && team.emperorEligibleSinceMonth !== undefined
      ? Math.max(0, worldMonth - team.emperorEligibleSinceMonth)
      : 0;
  return [
    `王国历史 ${formatProgressDuration(kingMonths, EMPEROR_MIN_KING_MONTHS)}`,
    `诸国领土 ${territoryShare.toFixed(1)}% / ${EMPEROR_MIN_TERRITORY_SHARE}%${territoryShare >= EMPEROR_MIN_TERRITORY_SHARE ? " ✓" : ""}`,
    `城市控制 ${cityShare.toFixed(1)}% / ${EMPEROR_MIN_CITY_SHARE}%${cityShare >= EMPEROR_MIN_CITY_SHARE ? " ✓" : ""}`,
    input.leadShare === undefined
      ? `领先优势 — / ${EMPEROR_MIN_LEAD_SHARE}pp`
      : `领先优势 ${input.leadShare.toFixed(1)}pp / ${EMPEROR_MIN_LEAD_SHARE}pp${input.leadShare >= EMPEROR_MIN_LEAD_SHARE ? " ✓" : ""}`,
    `稳定度 ${effectiveStability ?? "—"} / ${EMPEROR_MIN_STABILITY}${safeStability >= EMPEROR_MIN_STABILITY ? " ✓" : ""}`,
    hasFormalRuler ? "正式君主 ✓" : "正式君主 —",
    baseReady
      ? `帝号资格：政治条件成熟`
      : `连续资格 ${Math.min(integratingMonths, EMPEROR_REQUIRED_MONTHS)} / ${EMPEROR_REQUIRED_MONTHS}个月`,
    baseReady
      ? `整合进程：${Math.min(integratingMonths, EMPEROR_REQUIRED_MONTHS)} / ${EMPEROR_REQUIRED_MONTHS}个月`
      : undefined,
  ].filter(Boolean) as string[];
}

export function buildStateFormationStatusLines(
  team: FactionDetailsTeamLike,
  worldMonth: number,
  stability: number | undefined,
  hasFormalRuler: boolean
) {
  if (team.identityStage === "STATE" || team.status !== "ACTIVE") {
    return [];
  }
  const activeMonths = Math.max(
    0,
    worldMonth - (team.currentActiveSinceYear ?? team.firstFoundedYear ?? worldMonth)
  );
  const cityCount = team.cities?.length ?? 0;
  const safeStability = stability ?? 0;
  const lines = [
    `建国条件：存续 ${Math.min(activeMonths, STATE_FORMATION_MIN_ACTIVE_MONTHS)}/${STATE_FORMATION_MIN_ACTIVE_MONTHS}个月`,
    `建国条件：城市 ${Math.min(cityCount, STATE_FORMATION_MIN_CITIES)}/${STATE_FORMATION_MIN_CITIES}`,
    `建国条件：稳定度 ${safeStability}/${STATE_FORMATION_MIN_STABILITY}`,
  ];
  if (!hasFormalRuler) {
    lines.push("建国条件：正式君主 —");
  }
  if (
    activeMonths >= STATE_FORMATION_MIN_ACTIVE_MONTHS &&
    cityCount >= STATE_FORMATION_MIN_CITIES &&
    safeStability >= STATE_FORMATION_MIN_STABILITY &&
    hasFormalRuler &&
    team.stateFormationEligibleSinceMonth !== undefined
  ) {
    const integratingMonths = Math.max(
      0,
      worldMonth - team.stateFormationEligibleSinceMonth
    );
    lines.push(
      `政治整合中：${Math.min(integratingMonths, STATE_FORMATION_REQUIRED_MONTHS)}/${STATE_FORMATION_REQUIRED_MONTHS}个月`
    );
  }
  return lines;
}

export function buildFactionLifecycleLines(
  team: FactionDetailsTeamLike,
  worldMonth: number,
  remnantPopulation: number,
  exileLegitimacy?: number
) {
  const cumulativeActiveMonths = getCumulativeActiveMonthsSafe(team, worldMonth);
  const firstFoundedYear = team.firstFoundedYear ?? 0;
  const restorationYears = team.restorationYears ?? [];
  if (team.status === "ACTIVE") {
    const lastRestoration = restorationYears.at(-1);
    if (lastRestoration !== undefined) {
      return [
        `初建：${formatWorldDate(firstFoundedYear)}`,
        `最近复国：${formatWorldDate(lastRestoration)}`,
        `本次政权：${formatWorldDuration(worldMonth - (team.currentActiveSinceYear ?? worldMonth))}`,
        `累计在国：${formatWorldDuration(cumulativeActiveMonths)}`,
        `王室延续：${formatWorldDuration(worldMonth - firstFoundedYear)}`,
      ];
    }
    return [
      `建立：${formatWorldDate(firstFoundedYear)}`,
      `国祚：${formatWorldDuration(worldMonth - firstFoundedYear)}`,
      "状态：在国",
    ];
  }
  if (team.status === "EXILED") {
    const exiledYear = team.lastExiledYear ?? worldMonth;
    return [
      `初建：${formatWorldDate(firstFoundedYear)}`,
      `亡国：${formatWorldDate(exiledYear)}`,
      `在国：${formatWorldDuration(cumulativeActiveMonths)}`,
      `流亡：${formatWorldDuration(worldMonth - exiledYear)}`,
      "状态：流亡政权",
      `合法性：${exileLegitimacy ?? "—"}`,
      `残部：${remnantPopulation}人`,
    ];
  }
  return [
    `初建：${formatWorldDate(firstFoundedYear)}`,
    `彻底灭亡：${team.extinctionYear !== undefined ? formatWorldDate(team.extinctionYear) : "—"}`,
    `累计国祚：${formatWorldDuration(cumulativeActiveMonths)}`,
    "状态：已灭亡",
  ];
}

function buildLegacyLines(
  team: FactionDetailsTeamLike,
  worldMonth: number,
  remnantPopulation: number,
  exileLegitimacy?: number
) {
  const cumulativeActiveMonths = getCumulativeActiveMonthsSafe(team, worldMonth);
  const restorationYears = team.restorationYears ?? [];
  const lines = [`国祚：${formatWorldDuration(cumulativeActiveMonths)}`];
  if (restorationYears.length > 0) {
    lines.push(`复国次数：${restorationYears.length}`);
    lines.push(`最近复国：${formatWorldDate(restorationYears.at(-1) ?? 0)}`);
  }
  if (team.status === "EXILED") {
    lines.push(`流亡：${formatWorldDuration(worldMonth - (team.lastExiledYear ?? worldMonth))}`);
    lines.push(`合法性：${exileLegitimacy ?? "—"}`);
    lines.push(`残部：${remnantPopulation}人`);
  } else if (team.status === "EXTINCT") {
    lines.push(
      `彻底灭亡：${team.extinctionYear !== undefined ? formatWorldDate(team.extinctionYear) : "—"}`
    );
  }
  return lines;
}

function buildOriginFactLines(
  team: FactionDetailsTeamLike,
  teams: FactionDetailsTeamLike[],
  cityNameById: Map<string, string>,
  rulerNameById: Map<string, string>
) {
  const origin = team.origin;
  if (!origin || !origin.type || origin.type === "INITIAL") {
    return [];
  }
  const foundedMonth = origin.foundedMonth ?? team.firstFoundedYear ?? 0;
  const parent = teams.find((item) => item.name === origin.parentFactionId);
  const parentName =
    resolveFactionNameAtMonthSafe(parent, foundedMonth) ?? origin.parentFactionId;
  const lines = [
    parentName ? `母体政权：${parentName}` : undefined,
  ];
  const cityNames = (origin.foundingCityIds ?? [])
    .map((id) => cityNameById.get(id))
    .filter(Boolean) as string[];
  if (cityNames.length > 0) {
    lines.push(`发源：${cityNames.join("、")}`);
  }
  const foundingRuler = origin.foundingRulerId
    ? rulerNameById.get(origin.foundingRulerId)
    : undefined;
  if (foundingRuler) {
    lines.push(`首任首领：${foundingRuler}`);
  }
  return lines.filter(Boolean) as string[];
}

function buildLineage(team: FactionDetailsTeamLike) {
  const names = (team.nameHistory ?? []).map((entry) => entry.name);
  if (names.length === 0) {
    return team.displayName ?? team.name;
  }
  const current = team.displayName ?? team.name;
  if (names.at(-1) !== current) {
    names.push(current);
  }
  return [...new Set(names)].join(" → ");
}

function formatProgressDuration(value: number, target: number) {
  return `${formatWorldDuration(Math.min(value, target))} / ${formatWorldDuration(target)}`;
}

function formatIdentityStage(factionType?: string) {
  if (factionType === "FRONTIER") {
    return "边境军";
  }
  if (factionType === "SPLIT") {
    return "分裂政权";
  }
  if (factionType === "KINGDOM") {
    return "正式国家";
  }
  return "义军政权";
}
