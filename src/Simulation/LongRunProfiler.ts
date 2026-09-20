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
  monthlyStepMs?: number;
}

export const LONG_RUN_PROFILE_INTERVAL_MONTHS = 1200;

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
}

class LongRunProfilerStore {
  private snapshots: LongRunProfileSnapshot[] = [];
  private lastObservedMonth = -1;

  reset() {
    this.snapshots = [];
    this.lastObservedMonth = -1;
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
    monthlyStepMs,
  };
}

const LongRunProfiler = new LongRunProfilerStore();

export default LongRunProfiler;
