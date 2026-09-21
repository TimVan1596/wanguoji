import type Team from "../Components/Team";

export type WorldCycleStage =
  | "FRAGMENTED"
  | "CONSOLIDATING"
  | "UNIFIED_EARLY"
  | "UNIFIED_MATURE"
  | "DYNASTIC_FATIGUE";

export interface WorldCycleState {
  lastUnificationMonth?: number;
  currentUnificationStartMonth?: number;
  dynasticOrderFactionId?: string;
  dynasticOrderStartMonth?: number;
  dynasticOrderCandidateFactionId?: string;
  dynasticOrderCandidateSinceMonth?: number;
  dynasticOrderExitSinceMonth?: number;
  hegemonicCandidateFactionId?: string;
  hegemonicCandidateSinceMonth?: number;
  hegemonicFactionId?: string;
  hegemonicMomentum?: number;
  consolidationLeaderCandidateFactionId?: string;
  consolidationLeaderCandidateSinceMonth?: number;
  consolidationLeaderFactionId?: string;
  consolidationLeaderMomentum?: number;
  fragmentationStartMonth: number;
}

export interface WorldCycleDiagnostics {
  stage: WorldCycleStage;
  fragmentationAge: number;
  unifiedAge: number;
  consolidationModifier: number;
  dynasticGraceMultiplier: number;
  dynasticFatigueMultiplier: number;
  hegemonicCandidateId?: string;
  hegemonicMomentum: number;
  hegemonicSiegeMultiplier: number;
  consolidationLeaderId?: string;
  consolidationLeaderMomentum: number;
  dynasticOrderFactionId?: string;
}

export interface WorldCycleTeamMetric {
  team: Team;
  territoryShare: number;
  cityShare?: number;
  stability: number;
}

export const CONSOLIDATION_START_MONTH = 40 * 12;
export const CONSOLIDATION_CAP_MONTH = 80 * 12;
export const DYNASTIC_ORDER_REQUIRED_MONTHS = 24;
export const DYNASTIC_ORDER_EXIT_REQUIRED_MONTHS = 12;
export const DYNASTIC_ORDER_TERRITORY_ENTER = 60;
export const DYNASTIC_ORDER_CITY_ENTER = 55;
export const DYNASTIC_ORDER_STABILITY_ENTER = 65;
export const DYNASTIC_ORDER_TOP2_ENTER_MAX = 20;
export const DYNASTIC_ORDER_TERRITORY_EXIT = 50;
export const DYNASTIC_ORDER_TOP2_EXIT = 25;
export const UNIFIED_GRACE_MONTH = 60 * 12;
export const UNIFIED_GRACE_END_MONTH = 100 * 12;
export const DYNASTIC_FATIGUE_START_MONTH = 100 * 12;
export const DYNASTIC_FATIGUE_CAP_MONTH = 140 * 12;
export const EARLY_DYNASTY_STRAIN_MULTIPLIER = 0.6;
export const FATIGUE_STRAIN_MULTIPLIER = 1.3;
export const HEGEMONIC_CANDIDATE_TERRITORY = 32;
export const HEGEMONIC_CANDIDATE_STABILITY = 60;
export const HEGEMONIC_CANDIDATE_LEAD = 5;
export const HEGEMONIC_MOMENTUM_START_MONTHS = 60;
export const HEGEMONIC_MOMENTUM_CAP_MONTHS = 180;
export const HEGEMONIC_MOMENTUM_DECAY_PER_MONTH = 1 / 72;
export const HEGEMONIC_SIEGE_MULTIPLIER_CAP = 1.18;
export const HEGEMONIC_CAPTURE_LOYALTY_BONUS_CAP = 10;
export const CONSOLIDATION_LEADER_START_FRAGMENTATION_MONTH = 50 * 12;
export const CONSOLIDATION_LEADER_TERRITORY = 22;
export const CONSOLIDATION_LEADER_STABILITY = 60;
export const CONSOLIDATION_LEADER_LEAD = 3;
export const CONSOLIDATION_LEADER_RATIO = 1.1;
export const CONSOLIDATION_LEADER_REQUIRED_MONTHS = 60;
export const CONSOLIDATION_LEADER_CAP_MONTHS = 120;
export const CONSOLIDATION_LEADER_SIEGE_MULTIPLIER_CAP = 1.1;
export const CONSOLIDATION_LEADER_DECAY_PER_MONTH = 1 / 48;

export function createInitialWorldCycleState(startMonth = 0): WorldCycleState {
  return {
    fragmentationStartMonth: startMonth,
  };
}

export function recordWorldUnified(
  state: WorldCycleState,
  month: number
): WorldCycleState {
  return {
    ...state,
    lastUnificationMonth: month,
    currentUnificationStartMonth: month,
    dynasticOrderCandidateFactionId: undefined,
    dynasticOrderCandidateSinceMonth: undefined,
    dynasticOrderExitSinceMonth: undefined,
  };
}

export function recordWorldFragmented(
  state: WorldCycleState,
  month: number
): WorldCycleState {
  return {
    ...state,
    currentUnificationStartMonth: undefined,
    dynasticOrderFactionId: undefined,
    dynasticOrderStartMonth: undefined,
    dynasticOrderCandidateFactionId: undefined,
    dynasticOrderCandidateSinceMonth: undefined,
    dynasticOrderExitSinceMonth: undefined,
    fragmentationStartMonth: month,
  };
}

export function getWorldCycleDiagnostics(
  state: WorldCycleState,
  month: number
): WorldCycleDiagnostics {
  const unifiedAge =
    getOrderStartMonth(state) === undefined
      ? 0
      : Math.max(0, month - (getOrderStartMonth(state) ?? month));
  const fragmentationAge =
    getOrderStartMonth(state) === undefined
      ? Math.max(0, month - state.fragmentationStartMonth)
      : 0;
  const consolidationModifier = getConsolidationPressure(fragmentationAge);
  const dynasticGraceMultiplier = getDynasticGraceMultiplier(unifiedAge);
  const dynasticFatigueMultiplier = getDynasticFatigueMultiplier(unifiedAge);
  const hegemonicMomentum = state.hegemonicMomentum ?? 0;
  const consolidationLeaderMomentum = state.consolidationLeaderMomentum ?? 0;
  const expansionMomentum = getExpansionMomentum(
    hegemonicMomentum,
    consolidationLeaderMomentum
  );
  return {
    stage:
      getOrderStartMonth(state) !== undefined
        ? unifiedAge < UNIFIED_GRACE_MONTH
          ? "UNIFIED_EARLY"
          : unifiedAge < DYNASTIC_FATIGUE_START_MONTH
          ? "UNIFIED_MATURE"
          : "DYNASTIC_FATIGUE"
        : consolidationModifier > 0
        ? "CONSOLIDATING"
        : "FRAGMENTED",
    fragmentationAge,
    unifiedAge,
    consolidationModifier,
    dynasticGraceMultiplier,
    dynasticFatigueMultiplier,
    hegemonicCandidateId:
      state.hegemonicFactionId ??
      state.hegemonicCandidateFactionId ??
      state.consolidationLeaderFactionId ??
      state.consolidationLeaderCandidateFactionId,
    hegemonicMomentum,
    hegemonicSiegeMultiplier: getHegemonicSiegeMultiplier(
      expansionMomentum,
      consolidationModifier,
      getOrderStartMonth(state) !== undefined
    ),
    consolidationLeaderId:
      state.consolidationLeaderFactionId ??
      state.consolidationLeaderCandidateFactionId,
    consolidationLeaderMomentum,
    dynasticOrderFactionId: state.dynasticOrderFactionId,
  };
}

export function getConsolidationPressure(fragmentationAgeMonths: number) {
  return smoothStep(
    fragmentationAgeMonths,
    CONSOLIDATION_START_MONTH,
    CONSOLIDATION_CAP_MONTH
  );
}

export function getDynasticGraceMultiplier(unifiedAgeMonths: number) {
  if (unifiedAgeMonths <= UNIFIED_GRACE_MONTH) {
    return EARLY_DYNASTY_STRAIN_MULTIPLIER;
  }
  const release = smoothStep(
    unifiedAgeMonths,
    UNIFIED_GRACE_MONTH,
    UNIFIED_GRACE_END_MONTH
  );
  return lerp(EARLY_DYNASTY_STRAIN_MULTIPLIER, 1, release);
}

export function getDynasticFatigueMultiplier(unifiedAgeMonths: number) {
  const fatigue = smoothStep(
    unifiedAgeMonths,
    DYNASTIC_FATIGUE_START_MONTH,
    DYNASTIC_FATIGUE_CAP_MONTH
  );
  return lerp(1, FATIGUE_STRAIN_MULTIPLIER, fatigue);
}

export function getUnifiedImperialStrainMultiplier(unifiedAgeMonths: number) {
  return Math.max(
    0.42,
    getDynasticGraceMultiplier(unifiedAgeMonths) *
      getDynasticFatigueMultiplier(unifiedAgeMonths)
  );
}

export function getUnifiedRebellionChanceMultiplier(unifiedAgeMonths: number) {
  const grace = getDynasticGraceMultiplier(unifiedAgeMonths);
  const fatigueRatio =
    (getDynasticFatigueMultiplier(unifiedAgeMonths) - 1) /
    (FATIGUE_STRAIN_MULTIPLIER - 1);
  return Math.max(0.45, Math.max(0.5, grace) * lerp(1, 1.2, fatigueRatio));
}

export function getConsolidationRebellionChanceMultiplier(pressure: number) {
  return Math.max(0.45, 1 - pressure * 0.45);
}

export function getConsolidationImperialStrainMultiplier(pressure: number) {
  return Math.max(0.78, 1 - pressure * 0.22);
}

export function observeHegemonicMomentum(
  state: WorldCycleState,
  metrics: WorldCycleTeamMetric[],
  month: number
): WorldCycleState {
  const ranked = getFormalActiveRanked(metrics);
  const top1 = ranked[0];
  const top2 = ranked[1];
  const fragmentationAge =
    getOrderStartMonth(state) === undefined
      ? Math.max(0, month - state.fragmentationStartMonth)
      : 0;
  let nextState = observeConsolidationLeaderMomentum(
    state,
    top1,
    top2,
    month,
    fragmentationAge
  );
  const eligible =
    top1 &&
    top1.territoryShare >= HEGEMONIC_CANDIDATE_TERRITORY &&
    top1.stability >= HEGEMONIC_CANDIDATE_STABILITY &&
    top1.territoryShare - (top2?.territoryShare ?? 0) >= HEGEMONIC_CANDIDATE_LEAD;

  if (!eligible) {
    const decayed = Math.max(0, (nextState.hegemonicMomentum ?? 0) - HEGEMONIC_MOMENTUM_DECAY_PER_MONTH);
    return {
      ...nextState,
      hegemonicMomentum: decayed,
      hegemonicFactionId: decayed > 0 ? nextState.hegemonicFactionId : undefined,
      hegemonicCandidateFactionId: decayed > 0 ? nextState.hegemonicCandidateFactionId : undefined,
      hegemonicCandidateSinceMonth:
        decayed > 0 ? nextState.hegemonicCandidateSinceMonth : undefined,
    };
  }

  if (nextState.hegemonicCandidateFactionId !== top1.team.name) {
    const decayed = Math.max(0, (nextState.hegemonicMomentum ?? 0) - HEGEMONIC_MOMENTUM_DECAY_PER_MONTH);
    return {
      ...nextState,
      hegemonicCandidateFactionId: top1.team.name,
      hegemonicCandidateSinceMonth: month,
      hegemonicFactionId: decayed > 0 ? nextState.hegemonicFactionId : undefined,
      hegemonicMomentum: decayed,
    };
  }

  const since = nextState.hegemonicCandidateSinceMonth ?? month;
  const rawMomentum = smoothStep(
    month - since,
    HEGEMONIC_MOMENTUM_START_MONTHS,
    HEGEMONIC_MOMENTUM_CAP_MONTHS
  );
  return {
    ...nextState,
    hegemonicFactionId: rawMomentum > 0 ? top1.team.name : nextState.hegemonicFactionId,
    hegemonicMomentum: Math.max(nextState.hegemonicMomentum ?? 0, rawMomentum),
  };
}

function observeConsolidationLeaderMomentum(
  state: WorldCycleState,
  top1: WorldCycleTeamMetric | undefined,
  top2: WorldCycleTeamMetric | undefined,
  month: number,
  fragmentationAge: number
): WorldCycleState {
  const lead = top1 ? top1.territoryShare - (top2?.territoryShare ?? 0) : 0;
  const ratio =
    top1 && top2 ? top1.territoryShare / Math.max(top2.territoryShare, 1) : Number.POSITIVE_INFINITY;
  const eligible =
    fragmentationAge >= CONSOLIDATION_LEADER_START_FRAGMENTATION_MONTH &&
    top1 &&
    top1.territoryShare >= CONSOLIDATION_LEADER_TERRITORY &&
    top1.stability >= CONSOLIDATION_LEADER_STABILITY &&
    (lead >= CONSOLIDATION_LEADER_LEAD || ratio >= CONSOLIDATION_LEADER_RATIO);

  if (!eligible) {
    const decayed = Math.max(
      0,
      (state.consolidationLeaderMomentum ?? 0) -
        CONSOLIDATION_LEADER_DECAY_PER_MONTH
    );
    return {
      ...state,
      consolidationLeaderMomentum: decayed,
      consolidationLeaderFactionId:
        decayed > 0 ? state.consolidationLeaderFactionId : undefined,
      consolidationLeaderCandidateFactionId:
        decayed > 0 ? state.consolidationLeaderCandidateFactionId : undefined,
      consolidationLeaderCandidateSinceMonth:
        decayed > 0 ? state.consolidationLeaderCandidateSinceMonth : undefined,
    };
  }

  if (state.consolidationLeaderCandidateFactionId !== top1.team.name) {
    const decayed = Math.max(
      0,
      (state.consolidationLeaderMomentum ?? 0) -
        CONSOLIDATION_LEADER_DECAY_PER_MONTH
    );
    return {
      ...state,
      consolidationLeaderCandidateFactionId: top1.team.name,
      consolidationLeaderCandidateSinceMonth: month,
      consolidationLeaderFactionId:
        decayed > 0 ? state.consolidationLeaderFactionId : undefined,
      consolidationLeaderMomentum: decayed,
    };
  }

  const since = state.consolidationLeaderCandidateSinceMonth ?? month;
  const rawMomentum = smoothStep(
    month - since,
    CONSOLIDATION_LEADER_REQUIRED_MONTHS,
    CONSOLIDATION_LEADER_CAP_MONTHS
  );
  return {
    ...state,
    consolidationLeaderFactionId:
      rawMomentum > 0 ? top1.team.name : state.consolidationLeaderFactionId,
    consolidationLeaderMomentum: Math.max(
      state.consolidationLeaderMomentum ?? 0,
      rawMomentum
    ),
  };
}

function getExpansionMomentum(hegemonicMomentum: number, leaderMomentum: number) {
  const leaderEquivalent =
    leaderMomentum *
    ((CONSOLIDATION_LEADER_SIEGE_MULTIPLIER_CAP - 1) /
      (HEGEMONIC_SIEGE_MULTIPLIER_CAP - 1)) /
    1.35;
  return Math.max(hegemonicMomentum, leaderEquivalent);
}

export function getHegemonicSiegeMultiplier(
  momentum: number,
  fragmentationPressure: number,
  dynasticOrderActive: boolean
) {
  const macro = 1 + fragmentationPressure * 0.35;
  const effectiveMomentum = dynasticOrderActive ? momentum * 0.25 : momentum;
  return Math.min(
    HEGEMONIC_SIEGE_MULTIPLIER_CAP,
    1 + (HEGEMONIC_SIEGE_MULTIPLIER_CAP - 1) * effectiveMomentum * macro
  );
}

export function getHegemonicCaptureLoyaltyBonus(
  momentum: number,
  fragmentationPressure: number,
  dynasticOrderActive: boolean
) {
  const multiplier = getHegemonicSiegeMultiplier(
    momentum,
    fragmentationPressure,
    dynasticOrderActive
  );
  return getHegemonicCaptureLoyaltyBonusFromSiegeMultiplier(multiplier);
}

export function getHegemonicCaptureLoyaltyBonusFromSiegeMultiplier(
  multiplier: number
) {
  const ratio =
    (multiplier - 1) / Math.max(0.01, HEGEMONIC_SIEGE_MULTIPLIER_CAP - 1);
  return Math.round(HEGEMONIC_CAPTURE_LOYALTY_BONUS_CAP * ratio);
}

export function getLeadingConsolidationFaction(
  metrics: WorldCycleTeamMetric[]
) {
  const ranked = getFormalActiveRanked(metrics);
  const top1 = ranked[0];
  const top2 = ranked[1];
  if (!top1 || top1.territoryShare < 32 || top1.stability < 60) {
    return undefined;
  }
  const secondShare = top2?.territoryShare ?? 0;
  if (top1.territoryShare - secondShare < 8 && top1.territoryShare < secondShare * 1.25) {
    return undefined;
  }
  return top1.team.name;
}

export function observeDynasticOrder(
  state: WorldCycleState,
  metrics: WorldCycleTeamMetric[],
  month: number
): WorldCycleState {
  const ranked = metrics
    .filter(
      (metric) =>
        metric.team.status === "ACTIVE" &&
        metric.team.identityStage === "STATE" &&
        (metric.team.sovereigntyRank === "KING" ||
          metric.team.sovereigntyRank === "EMPEROR")
    )
    .sort((a, b) => b.territoryShare - a.territoryShare);
  const top1 = ranked[0];
  const top2 = ranked[1];

  if (state.dynasticOrderFactionId) {
    const current = ranked.find(
      (metric) => metric.team.name === state.dynasticOrderFactionId
    );
    const challenged =
      !current ||
      current.territoryShare < DYNASTIC_ORDER_TERRITORY_EXIT ||
      (top2 && top2.team.name !== current.team.name && top2.territoryShare >= DYNASTIC_ORDER_TOP2_EXIT);
    if (!challenged) {
      return { ...state, dynasticOrderExitSinceMonth: undefined };
    }
    const exitSince = state.dynasticOrderExitSinceMonth ?? month;
    if (month - exitSince < DYNASTIC_ORDER_EXIT_REQUIRED_MONTHS) {
      return { ...state, dynasticOrderExitSinceMonth: exitSince };
    }
    return {
      ...state,
      dynasticOrderFactionId: undefined,
      dynasticOrderStartMonth: undefined,
      dynasticOrderCandidateFactionId: undefined,
      dynasticOrderCandidateSinceMonth: undefined,
      dynasticOrderExitSinceMonth: undefined,
      fragmentationStartMonth: month,
    };
  }

  if (
    !top1 ||
    top1.territoryShare < DYNASTIC_ORDER_TERRITORY_ENTER ||
    (top1.cityShare ?? 0) < DYNASTIC_ORDER_CITY_ENTER ||
    top1.stability < DYNASTIC_ORDER_STABILITY_ENTER ||
    (top2?.territoryShare ?? 0) > DYNASTIC_ORDER_TOP2_ENTER_MAX
  ) {
    return {
      ...state,
      dynasticOrderCandidateFactionId: undefined,
      dynasticOrderCandidateSinceMonth: undefined,
    };
  }
  if (state.dynasticOrderCandidateFactionId !== top1.team.name) {
    return {
      ...state,
      dynasticOrderCandidateFactionId: top1.team.name,
      dynasticOrderCandidateSinceMonth: month,
    };
  }
  const since = state.dynasticOrderCandidateSinceMonth ?? month;
  if (month - since < DYNASTIC_ORDER_REQUIRED_MONTHS) {
    return state;
  }
  return {
    ...state,
    dynasticOrderFactionId: top1.team.name,
    dynasticOrderStartMonth: since,
    dynasticOrderCandidateFactionId: undefined,
    dynasticOrderCandidateSinceMonth: undefined,
    dynasticOrderExitSinceMonth: undefined,
    lastUnificationMonth: state.lastUnificationMonth ?? since,
  };
}

export function getWorldCycleOrderFactionId(state: WorldCycleState) {
  return state.currentUnificationStartMonth !== undefined
    ? undefined
    : state.dynasticOrderFactionId;
}

function getOrderStartMonth(state: WorldCycleState) {
  return state.currentUnificationStartMonth ?? state.dynasticOrderStartMonth;
}

function getFormalActiveRanked(metrics: WorldCycleTeamMetric[]) {
  return metrics
    .filter(
      (metric) =>
        metric.team.status === "ACTIVE" &&
        metric.team.identityStage === "STATE" &&
        (metric.team.sovereigntyRank === "KING" ||
          metric.team.sovereigntyRank === "EMPEROR")
    )
    .sort((a, b) => b.territoryShare - a.territoryShare);
}

function smoothStep(value: number, start: number, end: number) {
  if (value <= start) {
    return 0;
  }
  if (value >= end) {
    return 1;
  }
  return (value - start) / Math.max(1, end - start);
}

function lerp(start: number, end: number, ratio: number) {
  return start + (end - start) * Math.max(0, Math.min(1, ratio));
}
