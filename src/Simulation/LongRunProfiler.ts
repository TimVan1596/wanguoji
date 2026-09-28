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
  hegemonicOwnerId?: string;
  hegemonicMomentum?: number;
  hegemonicSiegeMultiplier?: number;
  consolidationLeaderId?: string;
  consolidationLeaderCandidateId?: string;
  consolidationLeaderOwnerId?: string;
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

export type LongRunTransitionKind = "ERA_CONFIRMED" | "ERA_REPLACED" | "CYCLE_STAGE_CHANGED" | "WORLD_UNIFIED" | "WORLD_FRAGMENTED" | "LITERAL_MONOPOLY_STARTED" | "LITERAL_MONOPOLY_ENDED" | "DYNASTIC_ORDER_ESTABLISHED" | "DYNASTIC_ORDER_LOST";
export interface LongRunTransition {
  kind: LongRunTransitionKind;
  month: number;
  from?: string;
  to?: string;
  factionId?: string;
}

export interface LongRunSummary {
  profileStartMonth: number;
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
  medianFragmentedDuration?: number;
  longestFragmentedDuration?: number;
  currentCycleStage?: string;
  currentUnifiedAge?: number;
  currentFragmentedAge?: number;
  bottleneck: ConsolidationBottleneckSummary;
  literalUnificationCount: number;
  literalMonopolyEpisodes: number;
  averageLiteralMonopolyDuration?: number;
  currentLiteralMonopolyAge?: number;
  dynasticOrderEstablishedCount: number;
  dynasticOrderLostCount: number;
  completedDynasticOrderEpisodes: number;
  averageDynasticOrderDuration?: number;
  medianDynasticOrderDuration?: number;
  shortestDynasticOrderDuration?: number;
  longestDynasticOrderDuration?: number;
  currentDynasticOrderAge?: number;
}

export interface ConsolidationBottleneckSummary {
  maxFormalTop1TerritoryShare: number;
  maxFormalTop1CityShare: number;
  monthsFormalTop1Above32: number;
  monthsFormalTop1Above40: number;
  monthsFormalTop1Above50: number;
  hegemonicCandidateEpisodes: number;
  hegemonicOwnerChanges: number;
  maxHegemonicMomentum: number;
  maxConsolidationLeaderMomentum: number;
  dynasticOrderBlockerMonths: Record<string, number>;
  top1ProvisionalMonths: number;
  top3ContainsProvisionalMonths: number;
  maxProvisionalTerritoryShare: number;
  maxProvisionalCityCount: number;
  currentTop1Stability?: number;
  minimumStabilityWhileAbove40?: number;
  minimumStabilityWhileAbove50?: number;
  averageStabilityWhileAbove50?: number;
  rawImperialStrain?: number;
  effectiveImperialStrain?: number;
  lowLoyaltyCityCount?: number;
  minimumCityLoyalty?: number;
  averageCapitalDistance?: number;
  monthsAbove50ButStabilityBelow65: number;
  _lastCandidate?: string;
  _lastOwner?: string;
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
  hegemonicOwnerId?: string;
  hegemonicMomentum?: number;
  hegemonicSiegeMultiplier?: number;
  consolidationLeaderId?: string;
  consolidationLeaderCandidateId?: string;
  consolidationLeaderOwnerId?: string;
  consolidationLeaderMomentum?: number;
  stateFormationBlockers?: Record<string, number>;
  provisionalOverageCount?: number;
  controlledBlocks?: number;
  neutralBlocks?: number;
  top1AbsoluteShare?: number;
  top1ControlledShare?: number;
  top2ControlledShare?: number;
  top3ControlledShare?: number;
  formalTop1TerritoryShare?: number;
  formalTop1CityShare?: number;
  top1Provisional?: boolean;
  top3ContainsProvisional?: boolean;
  maxProvisionalTerritoryShare?: number;
  maxProvisionalCityCount?: number;
  dynasticOrderBlockers?: Record<string, boolean>;
  top1Stability?: number;
  rawImperialStrain?: number;
  effectiveImperialStrain?: number;
  lowLoyaltyCityCount?: number;
  minimumCityLoyalty?: number;
  averageCapitalDistance?: number;
  eraType?: string;
  eraCandidateType?: string;
  eraCandidateSinceMonth?: number;
}

function emptyBottleneck(): ConsolidationBottleneckSummary {
  return {
    maxFormalTop1TerritoryShare: 0,
    maxFormalTop1CityShare: 0,
    monthsFormalTop1Above32: 0,
    monthsFormalTop1Above40: 0,
    monthsFormalTop1Above50: 0,
    hegemonicCandidateEpisodes: 0,
    hegemonicOwnerChanges: 0,
    maxHegemonicMomentum: 0,
    maxConsolidationLeaderMomentum: 0,
    dynasticOrderBlockerMonths: {},
    top1ProvisionalMonths: 0,
    top3ContainsProvisionalMonths: 0,
    maxProvisionalTerritoryShare: 0,
    maxProvisionalCityCount: 0,
    monthsAbove50ButStabilityBelow65: 0,
  };
}

class LongRunProfilerStore {
  private snapshots: LongRunProfileSnapshot[] = [];
  private transitions: LongRunTransition[] = [];
  private lastObservedMonth = -1;
  private profileStartMonth = 0;
  private baselineCycleFamily: "UNIFIED" | "FRAGMENTED" = "FRAGMENTED";
  private bottleneck: ConsolidationBottleneckSummary = emptyBottleneck();

  reset(profileStartMonth = 0, baselineCycleFamily: "UNIFIED" | "FRAGMENTED" = "FRAGMENTED") {
    this.snapshots = [];
    this.lastObservedMonth = -1;
    this.transitions = [];
    this.profileStartMonth = profileStartMonth;
    this.baselineCycleFamily = baselineCycleFamily;
    this.bottleneck = emptyBottleneck();
  }

  observe(
    worldMonth: number,
    teams: Team[],
    monthlyStepMs?: number,
    counts: LongRunProfileCounts = {}
  ): LongRunProfileSnapshot | undefined {
    this.observeBottleneck(counts);
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

  private observeBottleneck(counts: LongRunProfileCounts) {
    const b = this.bottleneck;
    const top1Territory = counts.formalTop1TerritoryShare ?? 0;
    const top1City = counts.formalTop1CityShare ?? 0;
    b.maxFormalTop1TerritoryShare = Math.max(b.maxFormalTop1TerritoryShare, top1Territory);
    b.maxFormalTop1CityShare = Math.max(b.maxFormalTop1CityShare, top1City);
    if (top1Territory > 32) b.monthsFormalTop1Above32 += 1;
    if (top1Territory > 40) b.monthsFormalTop1Above40 += 1;
    if (top1Territory > 50) b.monthsFormalTop1Above50 += 1;
    if (counts.hegemonicCandidateId && counts.hegemonicCandidateId !== b._lastCandidate) b.hegemonicCandidateEpisodes += 1;
    if (counts.hegemonicOwnerId && b._lastOwner && counts.hegemonicOwnerId !== b._lastOwner) b.hegemonicOwnerChanges += 1;
    b._lastCandidate = counts.hegemonicCandidateId;
    b._lastOwner = counts.hegemonicOwnerId;
    b.maxHegemonicMomentum = Math.max(b.maxHegemonicMomentum, counts.hegemonicMomentum ?? 0);
    b.maxConsolidationLeaderMomentum = Math.max(b.maxConsolidationLeaderMomentum, counts.consolidationLeaderMomentum ?? 0);
    if (counts.top1Provisional) b.top1ProvisionalMonths += 1;
    if (counts.top3ContainsProvisional) b.top3ContainsProvisionalMonths += 1;
    b.maxProvisionalTerritoryShare = Math.max(b.maxProvisionalTerritoryShare, counts.maxProvisionalTerritoryShare ?? 0);
    b.maxProvisionalCityCount = Math.max(b.maxProvisionalCityCount, counts.maxProvisionalCityCount ?? 0);
    b.currentTop1Stability = counts.top1Stability;
    if (top1Territory > 40) b.minimumStabilityWhileAbove40 = Math.min(b.minimumStabilityWhileAbove40 ?? Infinity, counts.top1Stability ?? 100);
    if (top1Territory > 50) {
      b.minimumStabilityWhileAbove50 = Math.min(b.minimumStabilityWhileAbove50 ?? Infinity, counts.top1Stability ?? 100);
      b.averageStabilityWhileAbove50 = ((b.averageStabilityWhileAbove50 ?? 0) + (counts.top1Stability ?? 0)) / 2;
      if ((counts.top1Stability ?? 100) < 65) b.monthsAbove50ButStabilityBelow65 += 1;
    }
    b.rawImperialStrain = counts.rawImperialStrain;
    b.effectiveImperialStrain = counts.effectiveImperialStrain;
    b.lowLoyaltyCityCount = counts.lowLoyaltyCityCount;
    b.minimumCityLoyalty = counts.minimumCityLoyalty;
    b.averageCapitalDistance = counts.averageCapitalDistance;
    Object.entries(counts.dynasticOrderBlockers ?? {}).forEach(([key, value]) => { b.dynasticOrderBlockerMonths[key] = (b.dynasticOrderBlockerMonths[key] ?? 0) + (value ? 1 : 0); });
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
    return deriveLongRunSummary(worldMonth, eras, this.transitions, currentCycleStage, this.profileStartMonth, this.baselineCycleFamily, this.bottleneck);
  }
}

export function deriveLongRunSummary(
  worldMonth: number,
  eras: Array<{ startMonth: number; endMonth?: number; type: string }>,
  transitions: LongRunTransition[],
  currentCycleStage?: string,
  profileStartMonth = 0,
  baselineCycleFamily: "UNIFIED" | "FRAGMENTED" = "FRAGMENTED"
  , bottleneck = emptyBottleneck()
): LongRunSummary {
  const durations = eras.map((era) => Math.max(0, (era.endMonth ?? worldMonth) - era.startMonth));
  const competitive = eras.filter((era) => ["MULTIPOLAR", "DUAL_RIVALRY", "HEGEMONY"].includes(era.type)).map((era) => Math.max(0, (era.endMonth ?? worldMonth) - era.startMonth));
  const starts = transitions.filter((item) => item.kind === "WORLD_UNIFIED" || item.kind === "WORLD_FRAGMENTED").sort((a, b) => a.month - b.month);
  const episodes = (startKind: LongRunTransitionKind, endKind: LongRunTransitionKind) => starts.flatMap((start, index) => {
    if (start.kind !== startKind) return [];
    const end = starts.slice(index + 1).find((item) => item.kind === endKind);
    return end ? [Math.max(0, end.month - start.month)] : [];
  });
  const unifiedEpisodes = episodes("WORLD_UNIFIED", "WORLD_FRAGMENTED");
  const fragmentedEpisodes = episodes("WORLD_FRAGMENTED", "WORLD_UNIFIED");
  const completed = (kind: LongRunTransitionKind) => starts.filter((item) => item.kind === kind).length;
  const stats = (values: number[]) => {
    if (!values.length) return undefined;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
    return { average: values.reduce((sum, value) => sum + value, 0) / values.length, median, shortest: Math.min(...values), longest: Math.max(...values) };
  };
  const eraStats = stats(durations); const competitiveStats = stats(competitive);
  const gaps = eras.slice(1).reduce((sum, era, index) => sum + Math.max(0, era.startMonth - (eras[index].endMonth ?? worldMonth) - 1), 0);
  const overlaps = eras.slice(1).reduce((sum, era, index) => sum + Math.max(0, (eras[index].endMonth ?? worldMonth) - era.startMonth + 1), 0);
  const unifiedStats = stats(unifiedEpisodes); const fragmentedStats = stats(fragmentedEpisodes);
  const last = starts.at(-1);
  const literal = transitions.filter((item) => item.kind === "LITERAL_MONOPOLY_STARTED" || item.kind === "LITERAL_MONOPOLY_ENDED").sort((a, b) => a.month - b.month);
  const literalEpisodes = literal.flatMap((start, index) => start.kind === "LITERAL_MONOPOLY_STARTED" ? literal.slice(index + 1).find((item) => item.kind === "LITERAL_MONOPOLY_ENDED") ? [literal.slice(index + 1).find((item) => item.kind === "LITERAL_MONOPOLY_ENDED")!.month - start.month] : [] : []);
  const orders = transitions.filter((item) => item.kind === "DYNASTIC_ORDER_ESTABLISHED" || item.kind === "DYNASTIC_ORDER_LOST").sort((a, b) => a.month - b.month);
  const orderEpisodes = orders.flatMap((start, index) => start.kind === "DYNASTIC_ORDER_ESTABLISHED" ? orders.slice(index + 1).find((item) => item.kind === "DYNASTIC_ORDER_LOST") ? [orders.slice(index + 1).find((item) => item.kind === "DYNASTIC_ORDER_LOST")!.month - start.month] : [] : []);
  const stat = (values: number[]) => values.length ? { average: values.reduce((a, b) => a + b, 0) / values.length, median: [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)], min: Math.min(...values), max: Math.max(...values) } : undefined;
  const literalStats = stat(literalEpisodes); const orderStats = stat(orderEpisodes);
  const currentFamily = last ? last.kind === "WORLD_UNIFIED" ? "UNIFIED" : "FRAGMENTED" : baselineCycleFamily;
  const currentStart = last?.month ?? profileStartMonth;
  const currentLiteral = literal.at(-1)?.kind === "LITERAL_MONOPOLY_STARTED" ? Math.max(0, worldMonth - literal.at(-1)!.month) : undefined;
  const currentOrder = orders.at(-1)?.kind === "DYNASTIC_ORDER_ESTABLISHED" ? Math.max(0, worldMonth - orders.at(-1)!.month) : undefined;
  return { profileStartMonth, worldAge: worldMonth, eraCount: eras.length, averageEraDuration: eraStats?.average, medianEraDuration: eraStats?.median, shortestEraDuration: eraStats?.shortest, longestEraDuration: eraStats?.longest, competitiveEraCount: competitive.length, competitiveEraAverageDuration: competitiveStats?.average, eraGapMonths: gaps, eraOverlapMonths: overlaps, eraTransitionsPerCentury: worldMonth > 0 ? (Math.max(0, eras.length - 1) * 1200) / worldMonth : undefined, unificationCount: completed("WORLD_UNIFIED"), fragmentationCount: completed("WORLD_FRAGMENTED"), completedUnifiedEpisodes: unifiedEpisodes.length, averageUnifiedDuration: unifiedStats?.average, medianUnifiedDuration: unifiedStats?.median, shortestUnifiedDuration: unifiedStats?.shortest, longestUnifiedDuration: unifiedStats?.longest, completedFragmentedEpisodes: fragmentedEpisodes.length, averageFragmentedDuration: fragmentedStats?.average, medianFragmentedDuration: fragmentedStats?.median, longestFragmentedDuration: fragmentedStats?.longest, currentUnifiedAge: currentFamily === "UNIFIED" ? Math.max(0, worldMonth - currentStart) : undefined, currentFragmentedAge: currentFamily === "FRAGMENTED" ? Math.max(0, worldMonth - currentStart) : undefined, currentCycleStage, bottleneck, literalUnificationCount: literal.filter((x) => x.kind === "LITERAL_MONOPOLY_STARTED").length, literalMonopolyEpisodes: literalEpisodes.length, averageLiteralMonopolyDuration: literalStats?.average, currentLiteralMonopolyAge: currentLiteral, dynasticOrderEstablishedCount: orders.filter((x) => x.kind === "DYNASTIC_ORDER_ESTABLISHED").length, dynasticOrderLostCount: orders.filter((x) => x.kind === "DYNASTIC_ORDER_LOST").length, completedDynasticOrderEpisodes: orderEpisodes.length, averageDynasticOrderDuration: orderStats?.average, medianDynasticOrderDuration: orderStats?.median, shortestDynasticOrderDuration: orderStats?.min, longestDynasticOrderDuration: orderStats?.max, currentDynasticOrderAge: currentOrder };
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
    hegemonicOwnerId: counts.hegemonicOwnerId,
    hegemonicMomentum: counts.hegemonicMomentum,
    hegemonicSiegeMultiplier: counts.hegemonicSiegeMultiplier,
    consolidationLeaderId: counts.consolidationLeaderId,
    consolidationLeaderCandidateId: counts.consolidationLeaderCandidateId,
    consolidationLeaderOwnerId: counts.consolidationLeaderOwnerId,
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
