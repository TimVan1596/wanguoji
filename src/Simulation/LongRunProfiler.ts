import type Team from "../Components/Team";

export interface LongRunProfileSnapshot {
  worldMonth: number;
  activeFactions: number;
  exiledFactions: number;
  extinctFactions: number;
  totalFactions: number;
  activeCities: number;
  archivedCities: number;
  runtimePlayers: number;
  totalRulers: number;
  historyEvents: number;
  factionSnapshots: number;
  worldEras: number;
  fragmentationAge?: number;
  unifiedAge?: number;
  cycleStage?: string;
  consolidationModifier?: number;
  dynasticGraceMultiplier?: number;
  dynasticFatigueMultiplier?: number;
  hegemonicCandidateId?: string;
  hegemonicMomentum?: number;
  hegemonicSiegeMultiplier?: number;
  consolidationLeaderId?: string;
  consolidationLeaderMomentum?: number;
  stateFormationBlockers?: Record<string, number>;
  provisionalOverageCount?: number;
  controlledBlocks?: number;
  neutralBlocks?: number;
  top1AbsoluteShare?: number;
  top1ControlledShare?: number;
  top2ControlledShare?: number;
  top3ControlledShare?: number;
  eraType?: string;
  eraCandidateType?: string;
  eraCandidateSinceMonth?: number;
  monthlyStepMs?: number;
}

export const LONG_RUN_PROFILE_INTERVAL_MONTHS = 1200;

export type LongRunTransitionKind = "ERA_CONFIRMED" | "ERA_REPLACED" | "CYCLE_STAGE_CHANGED" | "WORLD_UNIFIED" | "WORLD_FRAGMENTED" | "DYNASTIC_ORDER_ESTABLISHED" | "DYNASTIC_ORDER_LOST";
export interface LongRunTransition {
  kind: LongRunTransitionKind;
  month: number;
  from?: string;
  to?: string;
  factionId?: string;
}

export interface LongRunSummary {
  worldAge: number;
  eraCount: number;
  averageEraDuration?: number;
  medianEraDuration?: number;
  shortestEraDuration?: number;
  longestEraDuration?: number;
  competitiveEraCount: number;
  competitiveEraAverageDuration?: number;
  eraGapMonths: number;
  eraOverlapMonths: number;
  eraTransitionsPerCentury?: number;
  unificationCount: number;
  fragmentationCount: number;
  completedUnifiedEpisodes: number;
  averageUnifiedDuration?: number;
  medianUnifiedDuration?: number;
  longestUnifiedDuration?: number;
  shortestUnifiedDuration?: number;
  completedFragmentedEpisodes: number;
  averageFragmentedDuration?: number;
  longestFragmentedDuration?: number;
  currentCycleStage?: string;
}

export interface LongRunProfileCounts {
  archivedCities?: number;
  totalRulers?: number;
  historyEvents?: number;
  factionSnapshots?: number;
  worldEras?: number;
  fragmentationAge?: number;
  unifiedAge?: number;
  cycleStage?: string;
  consolidationModifier?: number;
  dynasticGraceMultiplier?: number;
  dynasticFatigueMultiplier?: number;
  hegemonicCandidateId?: string;
  hegemonicMomentum?: number;
  hegemonicSiegeMultiplier?: number;
  consolidationLeaderId?: string;
  consolidationLeaderMomentum?: number;
  stateFormationBlockers?: Record<string, number>;
  provisionalOverageCount?: number;
  controlledBlocks?: number;
  neutralBlocks?: number;
  top1AbsoluteShare?: number;
  top1ControlledShare?: number;
  top2ControlledShare?: number;
  top3ControlledShare?: number;
  eraType?: string;
  eraCandidateType?: string;
  eraCandidateSinceMonth?: number;
}

class LongRunProfilerStore {
  private snapshots: LongRunProfileSnapshot[] = [];
  private transitions: LongRunTransition[] = [];
  private lastObservedMonth = -1;

  reset() {
    this.snapshots = [];
    this.lastObservedMonth = -1;
    this.transitions = [];
  }

  observe(
    worldMonth: number,
    teams: Team[],
    monthlyStepMs?: number,
    counts: LongRunProfileCounts = {}
  ): LongRunProfileSnapshot | undefined {
    if (
      this.lastObservedMonth >= 0 &&
      worldMonth - this.lastObservedMonth < LONG_RUN_PROFILE_INTERVAL_MONTHS
    ) {
      return undefined;
    }
    this.lastObservedMonth = worldMonth;
    const snapshot = buildLongRunProfileSnapshot(
      worldMonth,
      teams,
      monthlyStepMs,
      counts
    );
    this.snapshots.push(snapshot);
    return snapshot;
  }

  getSnapshots() {
    return [...this.snapshots];
  }

  recordTransition(transition: LongRunTransition) {
    const previous = this.transitions[this.transitions.length - 1];
    if (previous && previous.kind === transition.kind && previous.month === transition.month && previous.from === transition.from && previous.to === transition.to) return;
    this.transitions.push({ ...transition });
  }

  getTransitions() { return [...this.transitions]; }

  getSummary(worldMonth: number, eras: Array<{ startMonth: number; endMonth?: number; type: string }>, currentCycleStage?: string) {
    return deriveLongRunSummary(worldMonth, eras, this.transitions, currentCycleStage);
  }
}

export function deriveLongRunSummary(
  worldMonth: number,
  eras: Array<{ startMonth: number; endMonth?: number; type: string }>,
  transitions: LongRunTransition[],
  currentCycleStage?: string
): LongRunSummary {
  const durations = eras.map((era) => Math.max(0, (era.endMonth ?? worldMonth) - era.startMonth));
  const competitive = eras.filter((era) => ["MULTIPOLAR", "DUAL_RIVALRY", "HEGEMONY"].includes(era.type)).map((era) => Math.max(0, (era.endMonth ?? worldMonth) - era.startMonth));
  const completed = (kind: LongRunTransitionKind) => transitions.filter((item) => item.kind === kind).length;
  const stats = (values: number[]) => values.length ? { average: values.reduce((sum, value) => sum + value, 0) / values.length, median: [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)], shortest: Math.min(...values), longest: Math.max(...values) } : undefined;
  const eraStats = stats(durations); const competitiveStats = stats(competitive);
  const gaps = eras.slice(1).reduce((sum, era, index) => sum + Math.max(0, era.startMonth - (eras[index].endMonth ?? worldMonth) - 1), 0);
  const overlaps = eras.slice(1).reduce((sum, era, index) => sum + Math.max(0, (eras[index].endMonth ?? worldMonth) - era.startMonth + 1), 0);
  return { worldAge: worldMonth, eraCount: eras.length, averageEraDuration: eraStats?.average, medianEraDuration: eraStats?.median, shortestEraDuration: eraStats?.shortest, longestEraDuration: eraStats?.longest, competitiveEraCount: competitive.length, competitiveEraAverageDuration: competitiveStats?.average, eraGapMonths: gaps, eraOverlapMonths: overlaps, eraTransitionsPerCentury: worldMonth > 0 ? (Math.max(0, eras.length - 1) * 1200) / worldMonth : undefined, unificationCount: completed("WORLD_UNIFIED"), fragmentationCount: completed("WORLD_FRAGMENTED"), completedUnifiedEpisodes: completed("WORLD_UNIFIED"), completedFragmentedEpisodes: completed("WORLD_FRAGMENTED"), currentCycleStage };
}

export function buildLongRunProfileSnapshot(
  worldMonth: number,
  teams: Pick<Team, "status" | "cities" | "players">[],
  monthlyStepMs?: number,
  counts: LongRunProfileCounts = {}
): LongRunProfileSnapshot {
  const activeFactions = teams.filter((team) => team.status === "ACTIVE").length;
  const exiledFactions = teams.filter((team) => team.status === "EXILED").length;
  const extinctFactions = teams.filter((team) => team.status === "EXTINCT").length;
  return {
    worldMonth,
    activeFactions,
    exiledFactions,
    extinctFactions,
    totalFactions: teams.length,
    activeCities: teams.reduce((sum, team) => sum + team.cities.length, 0),
    archivedCities: counts.archivedCities ?? 0,
    runtimePlayers: teams.reduce(
      (sum, team) => sum + (team.players?.children?.size ?? 0),
      0
    ),
    totalRulers: counts.totalRulers ?? 0,
    historyEvents: counts.historyEvents ?? 0,
    factionSnapshots: counts.factionSnapshots ?? 0,
    worldEras: counts.worldEras ?? 0,
    fragmentationAge: counts.fragmentationAge,
    unifiedAge: counts.unifiedAge,
    cycleStage: counts.cycleStage,
    consolidationModifier: counts.consolidationModifier,
    dynasticGraceMultiplier: counts.dynasticGraceMultiplier,
    dynasticFatigueMultiplier: counts.dynasticFatigueMultiplier,
    hegemonicCandidateId: counts.hegemonicCandidateId,
    hegemonicMomentum: counts.hegemonicMomentum,
    hegemonicSiegeMultiplier: counts.hegemonicSiegeMultiplier,
    consolidationLeaderId: counts.consolidationLeaderId,
    consolidationLeaderMomentum: counts.consolidationLeaderMomentum,
    stateFormationBlockers: counts.stateFormationBlockers,
    provisionalOverageCount: counts.provisionalOverageCount,
    controlledBlocks: counts.controlledBlocks,
    neutralBlocks: counts.neutralBlocks,
    top1AbsoluteShare: counts.top1AbsoluteShare,
    top1ControlledShare: counts.top1ControlledShare,
    top2ControlledShare: counts.top2ControlledShare,
    top3ControlledShare: counts.top3ControlledShare,
    eraType: counts.eraType,
    eraCandidateType: counts.eraCandidateType,
    eraCandidateSinceMonth: counts.eraCandidateSinceMonth,
    monthlyStepMs,
  };
}

const LongRunProfiler = new LongRunProfilerStore();

export default LongRunProfiler;
