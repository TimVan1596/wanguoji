import type { FactionStatus, FactionType } from "../Components/Team";

export type FactionIdentityStage = "PROVISIONAL" | "STATE";
export type SovereigntyRank = "LEADER" | "KING" | "EMPEROR";

export interface FactionNameHistoryEntry {
  name: string;
  startMonth: number;
  endMonth?: number;
  reason: string;
}

export interface SovereigntyHistoryEntry {
  rank: SovereigntyRank;
  startMonth: number;
  endMonth?: number;
}

export interface FactionIdentityState {
  name: string;
  displayName: string;
  identityStage: FactionIdentityStage;
  factionType: FactionType;
  status: FactionStatus;
  currentActiveSinceYear: number;
  stateFormationEligibleSinceMonth?: number;
  stateFoundedMonth?: number;
  sovereigntyRank: SovereigntyRank;
  sovereigntyHistory: SovereigntyHistoryEntry[];
  emperorEligibleSinceMonth?: number;
  proclaimedEmperorMonth?: number;
  nameHistory: FactionNameHistoryEntry[];
  cities: unknown[];
}

export type FactionOriginType = "INITIAL" | "REBEL" | "SPLIT" | "FRONTIER";

export interface FactionOrigin {
  type: FactionOriginType;
  foundedMonth: number;
  parentFactionId?: string;
  foundingCityIds?: string[];
  foundingRulerId?: string;
}

export const STATE_FORMATION_MIN_ACTIVE_MONTHS = 60;
export const STATE_FORMATION_MIN_CITIES = 2;
export const STATE_FORMATION_MIN_STABILITY = 55;
export const STATE_FORMATION_REQUIRED_MONTHS = 12;
export const PROVISIONAL_DISSOLUTION_MIN_MONTHS = 50 * 12;
export const PROVISIONAL_DISSOLUTION_MAX_TERRITORY_SHARE = 8;
export const EMPEROR_MIN_KING_MONTHS = 240;
export const EMPEROR_MIN_TERRITORY_SHARE = 50;
export const EMPEROR_MIN_CITY_SHARE = 50;
export const EMPEROR_MIN_STABILITY = 70;
export const EMPEROR_MIN_LEAD_SHARE = 15;
export const EMPEROR_REQUIRED_MONTHS = 60;

export function getInitialIdentityStage(factionType: FactionType): FactionIdentityStage {
  return factionType === "KINGDOM" ? "STATE" : "PROVISIONAL";
}

export function initializeFactionIdentity(
  faction: FactionIdentityState,
  startMonth: number
) {
  faction.displayName = faction.name;
  faction.identityStage = getInitialIdentityStage(faction.factionType);
  faction.sovereigntyRank = faction.identityStage === "STATE" ? "KING" : "LEADER";
  faction.sovereigntyHistory = [
    {
      rank: faction.sovereigntyRank,
      startMonth,
    },
  ];
  faction.nameHistory = [
    {
      name: faction.displayName,
      startMonth,
      reason: "initial",
    },
  ];
  faction.stateFormationEligibleSinceMonth = undefined;
  faction.stateFoundedMonth = faction.identityStage === "STATE" ? startMonth : undefined;
  faction.emperorEligibleSinceMonth = undefined;
  faction.proclaimedEmperorMonth = undefined;
}

export function getFactionDisplayName(faction: Pick<FactionIdentityState, "displayName" | "name">) {
  return faction.displayName || faction.name;
}

export function getFactionDisplayNameAtMonth(
  faction: Pick<FactionIdentityState, "displayName" | "name" | "nameHistory">,
  monthIndex: number
) {
  const matched = faction.nameHistory.find(
    (entry) =>
      monthIndex >= entry.startMonth &&
      (entry.endMonth === undefined || monthIndex <= entry.endMonth)
  );
  return matched?.name ?? getFactionDisplayName(faction);
}

export function renameFactionDisplayName(
  faction: FactionIdentityState,
  nextName: string,
  monthIndex: number,
  reason: string
) {
  const openEntry = faction.nameHistory.find((entry) => entry.endMonth === undefined);
  if (openEntry) {
    openEntry.endMonth = Math.max(openEntry.startMonth, monthIndex - 1);
  }
  faction.nameHistory.push({
    name: nextName,
    startMonth: monthIndex,
    reason,
  });
  faction.displayName = nextName;
}

export function canEvaluateStateFormation(
  faction: Pick<FactionIdentityState, "factionType" | "identityStage">
) {
  return (
    (faction.factionType === "REBEL" || faction.factionType === "SPLIT") &&
    faction.identityStage === "PROVISIONAL"
  );
}

export function isStateFormationEligible(
  faction: Pick<
    FactionIdentityState,
    "status" | "currentActiveSinceYear" | "cities" | "factionType" | "identityStage"
  >,
  monthIndex: number,
  stability: number,
  hasFormalRuler: boolean
) {
  return (
    canEvaluateStateFormation(faction) &&
    faction.status === "ACTIVE" &&
    monthIndex - faction.currentActiveSinceYear >= STATE_FORMATION_MIN_ACTIVE_MONTHS &&
    faction.cities.length >= STATE_FORMATION_MIN_CITIES &&
    stability >= STATE_FORMATION_MIN_STABILITY &&
    hasFormalRuler
  );
}

export function observeStateFormationEligibility(
  faction: FactionIdentityState,
  monthIndex: number,
  stability: number,
  hasFormalRuler: boolean
) {
  if (!isStateFormationEligible(faction, monthIndex, stability, hasFormalRuler)) {
    faction.stateFormationEligibleSinceMonth = undefined;
    return false;
  }
  if (faction.stateFormationEligibleSinceMonth === undefined) {
    faction.stateFormationEligibleSinceMonth = monthIndex;
    return false;
  }
  return (
    monthIndex - faction.stateFormationEligibleSinceMonth >=
    STATE_FORMATION_REQUIRED_MONTHS
  );
}

export type StateFormationBlocker =
  | "UNSUPPORTED_FACTION_TYPE"
  | "ACTIVE_DURATION"
  | "CITY_COUNT"
  | "STABILITY"
  | "CURRENT_RULER"
  | "CONTINUOUS_ELIGIBILITY";

export function getStateFormationBlockers(
  faction: Pick<
    FactionIdentityState,
    | "status"
    | "currentActiveSinceYear"
    | "cities"
    | "factionType"
    | "identityStage"
    | "stateFormationEligibleSinceMonth"
  >,
  monthIndex: number,
  stability: number,
  hasFormalRuler: boolean
): StateFormationBlocker[] {
  const blockers: StateFormationBlocker[] = [];
  if (!canEvaluateStateFormation(faction) || faction.status !== "ACTIVE") {
    blockers.push("UNSUPPORTED_FACTION_TYPE");
    return blockers;
  }
  if (monthIndex - faction.currentActiveSinceYear < STATE_FORMATION_MIN_ACTIVE_MONTHS) {
    blockers.push("ACTIVE_DURATION");
  }
  if (faction.cities.length < STATE_FORMATION_MIN_CITIES) {
    blockers.push("CITY_COUNT");
  }
  if (stability < STATE_FORMATION_MIN_STABILITY) {
    blockers.push("STABILITY");
  }
  if (!hasFormalRuler) {
    blockers.push("CURRENT_RULER");
  }
  if (
    blockers.length === 0 &&
    (faction.stateFormationEligibleSinceMonth === undefined ||
      monthIndex - faction.stateFormationEligibleSinceMonth <
        STATE_FORMATION_REQUIRED_MONTHS)
  ) {
    blockers.push("CONTINUOUS_ELIGIBILITY");
  }
  return blockers;
}

export function shouldApplyProvisionalDissolutionPressure(
  faction: Pick<
    FactionIdentityState,
    | "status"
    | "currentActiveSinceYear"
    | "cities"
    | "factionType"
    | "identityStage"
    | "stateFormationEligibleSinceMonth"
  >,
  monthIndex: number,
  territoryShare: number,
  stability: number,
  hasFormalRuler: boolean
) {
  if (
    faction.status !== "ACTIVE" ||
    faction.identityStage !== "PROVISIONAL" ||
    monthIndex - faction.currentActiveSinceYear < PROVISIONAL_DISSOLUTION_MIN_MONTHS
  ) {
    return false;
  }
  if (
    faction.cities.length >= STATE_FORMATION_MIN_CITIES ||
    territoryShare >= PROVISIONAL_DISSOLUTION_MAX_TERRITORY_SHARE
  ) {
    return false;
  }
  const blockers = getStateFormationBlockers(
    faction,
    monthIndex,
    stability,
    hasFormalRuler
  );
  return blockers.includes("CITY_COUNT") || blockers.includes("STABILITY");
}

export function formFactionState(
  faction: FactionIdentityState,
  stateName: string,
  monthIndex: number
) {
  if (!canEvaluateStateFormation(faction)) {
    return false;
  }
  renameFactionDisplayName(faction, stateName, monthIndex, "state-formation");
  faction.identityStage = "STATE";
  faction.stateFoundedMonth = monthIndex;
  setSovereigntyRank(faction, "KING", monthIndex);
  faction.stateFormationEligibleSinceMonth = undefined;
  return true;
}

export function getSovereigntyRankAtMonth(
  faction: Pick<
    FactionIdentityState,
    "sovereigntyRank" | "sovereigntyHistory" | "identityStage" | "stateFoundedMonth"
  >,
  monthIndex: number
): SovereigntyRank {
  const matched = faction.sovereigntyHistory?.find(
    (entry) =>
      monthIndex >= entry.startMonth &&
      (entry.endMonth === undefined || monthIndex <= entry.endMonth)
  );
  if (matched) {
    return matched.rank;
  }
  if (faction.identityStage === "STATE") {
    return faction.stateFoundedMonth === undefined ||
      monthIndex >= faction.stateFoundedMonth
      ? "KING"
      : "LEADER";
  }
  return "LEADER";
}

export function setSovereigntyRank(
  faction: FactionIdentityState,
  rank: SovereigntyRank,
  monthIndex: number
) {
  if (faction.sovereigntyRank === rank) {
    return;
  }
  if (!faction.sovereigntyHistory) {
    faction.sovereigntyHistory = [
      {
        rank: faction.sovereigntyRank ?? "LEADER",
        startMonth: faction.nameHistory[0]?.startMonth ?? 0,
      },
    ];
  }
  const openEntry = faction.sovereigntyHistory.find(
    (entry) => entry.endMonth === undefined
  );
  if (openEntry) {
    openEntry.endMonth = Math.max(openEntry.startMonth, monthIndex - 1);
  }
  faction.sovereigntyHistory.push({
    rank,
    startMonth: monthIndex,
  });
  faction.sovereigntyRank = rank;
}

export interface EmperorEligibilityInput {
  territoryShare: number;
  cityShare: number;
  stability: number;
  leadShare?: number;
  hasFormalRuler: boolean;
}

export function isEmperorProclamationEligible(
  faction: Pick<
    FactionIdentityState,
    "identityStage" | "sovereigntyRank" | "status" | "stateFoundedMonth"
  >,
  monthIndex: number,
  input: EmperorEligibilityInput
) {
  return (
    faction.identityStage === "STATE" &&
    faction.sovereigntyRank === "KING" &&
    faction.status === "ACTIVE" &&
    faction.stateFoundedMonth !== undefined &&
    monthIndex - faction.stateFoundedMonth >= EMPEROR_MIN_KING_MONTHS &&
    input.territoryShare >= EMPEROR_MIN_TERRITORY_SHARE &&
    input.cityShare >= EMPEROR_MIN_CITY_SHARE &&
    input.stability >= EMPEROR_MIN_STABILITY &&
    (input.leadShare ?? Number.POSITIVE_INFINITY) >= EMPEROR_MIN_LEAD_SHARE &&
    input.hasFormalRuler
  );
}

export function observeEmperorProclamationEligibility(
  faction: FactionIdentityState,
  monthIndex: number,
  input: EmperorEligibilityInput
) {
  if (!isEmperorProclamationEligible(faction, monthIndex, input)) {
    faction.emperorEligibleSinceMonth = undefined;
    return false;
  }
  if (faction.emperorEligibleSinceMonth === undefined) {
    faction.emperorEligibleSinceMonth = monthIndex;
    return false;
  }
  return monthIndex - faction.emperorEligibleSinceMonth >= EMPEROR_REQUIRED_MONTHS;
}

export function proclaimEmperor(faction: FactionIdentityState, monthIndex: number) {
  if (
    faction.identityStage !== "STATE" ||
    faction.sovereigntyRank !== "KING" ||
    faction.stateFoundedMonth === undefined
  ) {
    return false;
  }
  setSovereigntyRank(faction, "EMPEROR", monthIndex);
  faction.proclaimedEmperorMonth = monthIndex;
  faction.emperorEligibleSinceMonth = undefined;
  return true;
}

export function hasFormalStateIdentity(
  faction: Pick<FactionIdentityState, "stateFoundedMonth" | "identityStage">
) {
  return faction.identityStage === "STATE" && faction.stateFoundedMonth !== undefined;
}

export function shouldShowFactionInHistoricalArchive(
  faction: Pick<FactionIdentityState, "status" | "stateFoundedMonth" | "identityStage">
) {
  if (faction.status === "ACTIVE") {
    return true;
  }
  return hasFormalStateIdentity(faction);
}

export function validateFactionIdentities(factions: FactionIdentityState[]) {
  const issues: string[] = [];
  const activeStateNames = new Set<string>();
  factions.forEach((faction) => {
    const openEntries = faction.nameHistory.filter((entry) => entry.endMonth === undefined);
    if (openEntries.length !== 1) {
      issues.push(`faction identity has ${openEntries.length} open names: ${faction.name}`);
    }
    if (openEntries[0]?.name !== faction.displayName) {
      issues.push(`displayName does not match open nameHistory: ${faction.name}`);
    }
    const sorted = [...faction.nameHistory].sort(
      (a, b) => a.startMonth - b.startMonth
    );
    for (let i = 1; i < sorted.length; i++) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      if (previous.endMonth === undefined || previous.endMonth >= current.startMonth) {
        issues.push(`faction nameHistory overlaps: ${faction.name}`);
      }
    }
    const sovereigntyHistory = faction.sovereigntyHistory ?? [
      {
        rank:
          faction.sovereigntyRank ??
          (faction.identityStage === "STATE" ? "KING" : "LEADER"),
        startMonth: faction.stateFoundedMonth ?? faction.nameHistory[0]?.startMonth ?? 0,
      },
    ];
    const sovereigntyRank =
      faction.sovereigntyRank ??
      (faction.identityStage === "STATE" ? "KING" : "LEADER");
    if (faction.identityStage === "STATE" && faction.stateFoundedMonth === undefined) {
      issues.push(`STATE faction missing stateFoundedMonth: ${faction.name}`);
    }
    if (faction.identityStage === "PROVISIONAL" && sovereigntyRank !== "LEADER") {
      issues.push(`PROVISIONAL faction has non-LEADER rank: ${faction.name}`);
    }
    if (
      faction.identityStage === "STATE" &&
      sovereigntyRank !== "KING" &&
      sovereigntyRank !== "EMPEROR"
    ) {
      issues.push(`STATE faction has invalid sovereignty rank: ${faction.name}`);
    }
    if (sovereigntyRank === "EMPEROR" && faction.stateFoundedMonth === undefined) {
      issues.push(`EMPEROR faction missing stateFoundedMonth: ${faction.name}`);
    }
    if (
      faction.proclaimedEmperorMonth !== undefined &&
      faction.stateFoundedMonth !== undefined &&
      faction.proclaimedEmperorMonth < faction.stateFoundedMonth
    ) {
      issues.push(`emperor proclamation before state founding: ${faction.name}`);
    }
    const sovereigntyOpenEntries = sovereigntyHistory.filter(
      (entry) => entry.endMonth === undefined
    );
    if (sovereigntyOpenEntries.length !== 1) {
      issues.push(
        `faction sovereignty has ${sovereigntyOpenEntries.length} open ranks: ${faction.name}`
      );
    }
    if (sovereigntyOpenEntries[0]?.rank !== sovereigntyRank) {
      issues.push(`sovereigntyRank does not match open history: ${faction.name}`);
    }
    const sovereigntySorted = [...sovereigntyHistory].sort(
      (a, b) => a.startMonth - b.startMonth
    );
    for (let i = 1; i < sovereigntySorted.length; i++) {
      const previous = sovereigntySorted[i - 1];
      const current = sovereigntySorted[i];
      if (previous.endMonth === undefined || previous.endMonth >= current.startMonth) {
        issues.push(`faction sovereigntyHistory overlaps: ${faction.name}`);
      }
    }
    if (faction.status === "ACTIVE" && faction.identityStage === "STATE") {
      if (activeStateNames.has(faction.displayName)) {
        issues.push(`duplicated ACTIVE state displayName: ${faction.displayName}`);
      }
      activeStateNames.add(faction.displayName);
    }
  });
  return issues;
}
