import Team from "../Components/Team";
import WorldHistory from "../History/WorldHistory";
import { getRegimeStyleNameAtMonth } from "./RegimeStyle";
import {
  calculateTerritoryMetrics,
  getFactionTerritoryMetric,
} from "./TerritoryMetrics";
import type { WorldPhase } from "./WorldPhase";

export type WorldEraType =
  | "MULTIPOLAR"
  | "DUAL_RIVALRY"
  | "HEGEMONY"
  | "DYNASTIC"
  | "UNIFIED"
  | "FRAGMENTATION";

export interface WorldEraMetrics {
  territoryShares: Record<string, number>;
  absoluteTerritoryShares?: Record<string, number>;
  cityShares: Record<string, number>;
  stability?: Record<string, number>;
}

export interface WorldEra {
  id: string;
  type: WorldEraType;
  name: string;
  identityKey: string;
  startMonth: number;
  endMonth?: number;
  confirmedMonth: number;
  dominantFactionIds: string[];
  cohortLabelSnapshot?: string;
  triggerReasonCodes: string[];
  explanation: string;
  formationMetrics?: WorldEraMetrics;
}

interface EraCandidate {
  type: WorldEraType;
  name: string;
  identityKey: string;
  dominantFactionIds: string[];
  cohortLabelSnapshot?: string;
  triggerReasonCodes: string[];
  explanation: string;
  formationMetrics?: WorldEraMetrics;
}

interface EraMetric {
  team: Team;
  displayName: string;
  territoryShare: number;
  absoluteTerritoryShare: number;
  cityShare: number;
}

interface CandidateState {
  candidate: EraCandidate;
  sinceMonth: number;
}

export interface WorldEraCandidateDiagnostics {
  type: WorldEraType;
  name: string;
  sinceMonth: number;
  sustainedMonths: number;
  requiredMonths: number;
}

type Listener = (eras: WorldEra[]) => void;

export const WORLD_ERA_REQUIRED_MONTHS = 360;
export const WORLD_ERA_MIN_DURATION_MONTHS = 360;
export const WORLD_ERA_REQUIRED_MONTHS_BY_TYPE: Record<WorldEraType, number> = {
  MULTIPOLAR: 360,
  DUAL_RIVALRY: 360,
  HEGEMONY: 360,
  DYNASTIC: 360,
  UNIFIED: 360,
  FRAGMENTATION: 360,
};
export const WORLD_ERA_MIN_DURATION_MONTHS_BY_TYPE: Record<WorldEraType, number> = {
  MULTIPOLAR: 360,
  DUAL_RIVALRY: 360,
  HEGEMONY: 360,
  DYNASTIC: 360,
  UNIFIED: 360,
  FRAGMENTATION: 360,
};
export const MULTIPOLAR_CHAPTER_RENEWAL_MIN_MONTHS = 72 * 12;
export const MULTIPOLAR_CHAPTER_RENEWAL_REPLACED_COUNT = 2;
export const ERA_EXIT_GRACE_MONTHS = 36;

class WorldEraStore {
  private eras: WorldEra[] = [];
  private candidateState: CandidateState | undefined;
  private listeners = new Set<Listener>();
  private batchDepth = 0;
  private batchDirty = false;
  private sequence = 0;
  private lastObservedMonth = -1;
  private staleSinceMonth: number | undefined;

  reset() {
    this.eras = [];
    this.candidateState = undefined;
    this.sequence = 0;
    this.lastObservedMonth = -1;
    this.staleSinceMonth = undefined;
    this.notify();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getEras());
    return () => {
      this.listeners.delete(listener);
    };
  }

  beginBatchNotifications() {
    this.batchDepth += 1;
  }

  endBatchNotifications() {
    this.batchDepth = Math.max(0, this.batchDepth - 1);
    if (this.batchDepth === 0 && this.batchDirty) {
      this.batchDirty = false;
      this.notify();
    }
  }

  getEras() {
    return [...this.eras];
  }

  getCurrentEra() {
    return this.eras.find((era) => era.endMonth === undefined);
  }

  getCandidateDiagnostics(month = this.lastObservedMonth): WorldEraCandidateDiagnostics | undefined {
    if (!this.candidateState) {
      return undefined;
    }
    return {
      type: this.candidateState.candidate.type,
      name: this.candidateState.candidate.name,
      sinceMonth: this.candidateState.sinceMonth,
      sustainedMonths: Math.max(0, month - this.candidateState.sinceMonth),
      requiredMonths: getEraRequiredMonths(this.candidateState.candidate.type),
    };
  }

  getCurrentEraValidityDiagnostics(month = this.lastObservedMonth) {
    return {
      staleSinceMonth: this.staleSinceMonth,
      staleMonths: this.staleSinceMonth === undefined
        ? 0
        : Math.max(0, month - this.staleSinceMonth),
      graceMonths: ERA_EXIT_GRACE_MONTHS,
      isStale: this.staleSinceMonth !== undefined,
    };
  }

  observe(month: number, teams: Team[], totalCells: number, worldPhase: WorldPhase) {
    if (month === this.lastObservedMonth) {
      return;
    }
    this.lastObservedMonth = month;
    const candidate = classifyEra(teams, totalCells, month, worldPhase, this.getCurrentEra());
    if (!candidate) {
      this.candidateState = undefined;
      const current = this.getCurrentEra();
      if (current) {
        this.staleSinceMonth ??= month;
        if (month - this.staleSinceMonth >= ERA_EXIT_GRACE_MONTHS) {
          current.endMonth = Math.max(current.startMonth, month - 1);
          this.staleSinceMonth = undefined;
          this.notify();
        }
      }
      return;
    }
    this.staleSinceMonth = undefined;
    const current = this.getCurrentEra();
    const renewMultipolarChapter =
      current !== undefined && shouldRenewMultipolarChapter(current, candidate, month);
    if (current && !renewMultipolarChapter && shouldContinueEra(current, candidate)) {
      this.candidateState = undefined;
      return;
    }
    if (renewMultipolarChapter) {
      this.candidateState = { candidate, sinceMonth: month };
      this.confirmCandidate(month, month);
      return;
    }
    const initialEra = !current && this.eras.length === 0 && month === 0;
    const override = false;
    if (
      !override &&
      current &&
      month - current.startMonth < getEraMinimumDuration(current.type)
    ) {
      return;
    }
    if (
      !this.candidateState ||
      !isSameCandidate(this.candidateState.candidate, candidate)
    ) {
      this.candidateState = { candidate, sinceMonth: month };
      if (initialEra) {
        this.confirmCandidate(month, month);
      }
      return;
    }
    if (
      month - this.candidateState.sinceMonth >=
      getEraRequiredMonths(this.candidateState.candidate.type)
    ) {
      this.confirmCandidate(this.candidateState.sinceMonth, month);
    }
  }

  private confirmCandidate(startMonth: number, confirmationMonth: number) {
    if (!this.candidateState) {
      return;
    }
    const candidate = this.candidateState.candidate;
    const current = this.getCurrentEra();
    if (current && shouldContinueEra(current, candidate)) {
      this.candidateState = undefined;
      return;
    }
    if (current) {
      current.endMonth = Math.max(current.startMonth, startMonth - 1);
    }
    const era: WorldEra = {
      id: `world-era-${this.sequence++}-${candidate.type}-${startMonth}`,
      type: candidate.type,
      name: candidate.name,
      identityKey: candidate.identityKey,
      startMonth,
      confirmedMonth: confirmationMonth,
      dominantFactionIds: candidate.dominantFactionIds,
      cohortLabelSnapshot: candidate.cohortLabelSnapshot,
      triggerReasonCodes: candidate.triggerReasonCodes,
      explanation: candidate.explanation,
      formationMetrics: candidate.formationMetrics,
    };
    this.eras.push(era);
    this.candidateState = undefined;
    this.staleSinceMonth = undefined;
    WorldHistory.addWorldEraStarted(confirmationMonth, era);
    this.notify();
  }

  private notify() {
    if (this.batchDepth > 0) {
      this.batchDirty = true;
      return;
    }
    const eras = this.getEras();
    this.listeners.forEach((listener) => listener(eras));
  }
}

export function classifyEra(
  teams: Team[],
  totalCells: number,
  month: number,
  worldPhase: WorldPhase,
  currentEra?: WorldEra
): EraCandidate | undefined {
  const active = teams.filter((team) => team.status === "ACTIVE");
  const territoryMetrics = calculateTerritoryMetrics(teams, totalCells);
  const power = active
    .map((team) => toEraMetric(team, territoryMetrics, active))
    .sort((a, b) => b.territoryShare - a.territoryShare);
  const top1 = power[0];
  const top2 = power[1];
  const top3 = power[2];
  const formal = power.filter((metric) => metric.team.identityStage === "STATE");
  const formalTop1 = formal[0];
  const formalTop2 = formal[1];

  if (active.length <= 1 && top1) {
    return buildCandidate("UNIFIED", `${top1.displayName}一统`, [top1], [
      "world-unified",
    ], `${top1.displayName}成为天下唯一存续的主要势力。`);
  }

  if (
    worldPhase === "IMPERIAL_FRACTURE" &&
    (currentEra?.type === "DYNASTIC" || currentEra?.type === "UNIFIED")
  ) {
    return buildCandidate("FRAGMENTATION", "天下再裂", formal.slice(0, 2), [
      "imperial-fracture",
    ], `${currentEra.name}秩序瓦解，天下重新出现多方割据。`);
  }

  if (
    formalTop1 &&
    formalTop1.team.sovereigntyRank === "EMPEROR" &&
    formalTop1.territoryShare >= 60 &&
    formalTop1.cityShare >= 55 &&
    hasClearLead(formalTop1.territoryShare, formalTop2?.territoryShare ?? 0)
  ) {
    const styleName = getRegimeStyleNameAtMonth(formalTop1.team, month);
    return buildCandidate("DYNASTIC", styleName, [formalTop1], [
      "emperor-dominance",
    ], `${styleName}长期控制当前诸国领土的${formatPercent(formalTop1.territoryShare)}与${formatPercent(formalTop1.cityShare)}的城市，明显领先诸国。`);
  }

  if (
    top1 &&
    top1.territoryShare >= 35 &&
    ((top2?.territoryShare ?? 0) < 22 ||
      top1.territoryShare >= (top2?.territoryShare ?? 0) * 2)
  ) {
    return buildCandidate("HEGEMONY", `${top1.displayName}霸天下`, [top1], [
      "single-hegemony",
    ], `${top1.displayName}控制当前诸国领土的${formatPercent(top1.territoryShare)}，明显压过第二强国。`);
  }

  if (
    power.length >= 3 &&
    top1 &&
    top3 &&
    top3.territoryShare >= 20 &&
    top1.territoryShare / Math.max(top3.territoryShare, 1) <= 1.25
  ) {
    return buildMultipolarCandidate(power.slice(0, 3));
  }

  if (
    top1 &&
    top2 &&
    top1.territoryShare >= 22 &&
    top2.territoryShare >= 22 &&
    top1.territoryShare + top2.territoryShare >= 55 &&
    top1.territoryShare / Math.max(top2.territoryShare, 1) <= 1.8
  ) {
    return buildCandidate(
      "DUAL_RIVALRY",
      `${top1.displayName}${top2.displayName}争霸`,
      [top1, top2],
      ["dual-rivalry"],
      `${top1.displayName}、${top2.displayName}合计控制当前诸国领土的${formatPercent(top1.territoryShare + top2.territoryShare)}，实力接近。`
    );
  }

  if (
    power.length >= 3 &&
    top1 &&
    top3 &&
    top1.territoryShare < 35 &&
    top3.territoryShare >= 10
  ) {
    return buildMultipolarCandidate(power.slice(0, 3));
  }

  if (month === 0 && power.length >= 3) {
    return buildMultipolarCandidate(power.slice(0, 3));
  }

  return undefined;
}

function buildMultipolarCandidate(metrics: EraMetric[]) {
  const top1 = metrics[0];
  const cohortNames = metrics.map((metric) => metric.displayName).join("、");
  return buildCandidate(
    "MULTIPOLAR",
    "群雄争衡",
    metrics,
    ["multipolar-balance"],
    `${cohortNames}等国长期并立，尚无一国形成压倒性优势；最强者控制当前诸国领土的${formatPercent(top1?.territoryShare ?? 0)}。`
  );
}

function toEraMetric(
  team: Team,
  territoryMetrics: ReturnType<typeof calculateTerritoryMetrics>,
  activeTeams: Team[]
): EraMetric {
  const activeCityCount = Math.max(1, activeTeams.reduce((sum, item) => sum + item.cities.length, 0));
  const territory = getFactionTerritoryMetric(territoryMetrics, team.name);
  return {
    team,
    displayName: team.displayName || team.name,
    territoryShare: territory.controlledTerritoryShare,
    absoluteTerritoryShare: territory.absoluteWorldShare,
    cityShare: (team.cities.length / activeCityCount) * 100,
  };
}

function buildCandidate(
  type: WorldEraType,
  name: string,
  metrics: EraMetric[],
  triggerReasonCodes: string[],
  explanation: string
): EraCandidate {
  const cohortLabelSnapshot =
    type === "MULTIPOLAR"
      ? metrics.map((metric) => metric.displayName).join(" · ")
      : undefined;
  return {
    type,
    name,
    identityKey: createEraIdentityKey(type, metrics.map((metric) => metric.team.name), name),
    dominantFactionIds: metrics.map((metric) => metric.team.name),
    cohortLabelSnapshot,
    triggerReasonCodes,
    explanation,
    formationMetrics: {
      territoryShares: Object.fromEntries(
        metrics.map((metric) => [metric.team.name, round(metric.territoryShare)])
      ),
      absoluteTerritoryShares: Object.fromEntries(
        metrics.map((metric) => [metric.team.name, round(metric.absoluteTerritoryShare)])
      ),
      cityShares: Object.fromEntries(
        metrics.map((metric) => [metric.team.name, round(metric.cityShare)])
      ),
    },
  };
}

function hasClearLead(top1: number, top2: number) {
  return top1 - top2 >= 20 || top1 >= top2 * 1.8;
}

function isSameCandidate(a: EraCandidate, b: EraCandidate) {
  return (
    a.type === b.type &&
    a.identityKey === b.identityKey
  );
}

function shouldContinueEra(era: WorldEra, candidate: EraCandidate) {
  return era.type === candidate.type && era.identityKey === candidate.identityKey;
}

function shouldRenewMultipolarChapter(
  era: WorldEra,
  candidate: EraCandidate,
  month: number
) {
  if (era.type !== "MULTIPOLAR" || candidate.type !== "MULTIPOLAR") {
    return false;
  }
  if (month - era.startMonth < MULTIPOLAR_CHAPTER_RENEWAL_MIN_MONTHS) {
    return false;
  }
  const overlap = countOverlap(era.dominantFactionIds, candidate.dominantFactionIds);
  return (
    era.dominantFactionIds.length - overlap >=
    MULTIPOLAR_CHAPTER_RENEWAL_REPLACED_COUNT
  );
}

function countOverlap(a: string[], b: string[]) {
  const bSet = new Set(b);
  return a.filter((item) => bSet.has(item)).length;
}

function createEraIdentityKey(type: WorldEraType, factionIds: string[], name: string) {
  if (type === "DUAL_RIVALRY") {
    return `${type}:${[...factionIds].sort().join("|")}`;
  }
  if (type === "MULTIPOLAR") {
    return `${type}:${[...factionIds].sort().join("|")}`;
  }
  if (type === "FRAGMENTATION") {
    return `${type}:${name}`;
  }
  return `${type}:${factionIds.join("|") || name}`;
}

function getEraRequiredMonths(type: WorldEraType) {
  return WORLD_ERA_REQUIRED_MONTHS_BY_TYPE[type] ?? WORLD_ERA_REQUIRED_MONTHS;
}

function getEraMinimumDuration(type: WorldEraType) {
  return WORLD_ERA_MIN_DURATION_MONTHS_BY_TYPE[type] ?? WORLD_ERA_MIN_DURATION_MONTHS;
}

function formatPercent(value: number) {
  return `${round(value).toFixed(1)}%`;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

const WorldEraRegistry = new WorldEraStore();

export default WorldEraRegistry;
