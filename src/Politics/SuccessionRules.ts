import {
  SUCCESSION_CRISIS_LOYALTY_MULTIPLIER,
  SUCCESSION_CRISIS_REBELLION_MULTIPLIER,
  SUCCESSION_INSTABILITY_LOYALTY_MULTIPLIER,
  SUCCESSION_INSTABILITY_REBELLION_MULTIPLIER,
  SUCCESSION_LONG_REIGN_MONTHS,
  SUCCESSION_LONG_REIGN_SHOCK_MONTHS,
  SUCCESSION_LOOKBACK_MONTHS,
  SUCCESSION_SHOCK_LOYALTY_MULTIPLIER,
  SUCCESSION_SHOCK_REBELLION_MULTIPLIER,
  SUCCESSION_SHOCK_MONTHS,
} from "../config/simulation";

export type SuccessionEffectLevel =
  | "succession-shock"
  | "succession-instability"
  | "succession-crisis";

export interface SuccessionEffectRule {
  level: SuccessionEffectLevel;
  durationYears: number;
  loyaltyRecoveryMultiplier: number;
  rebellionRiskMultiplier: number;
  recentSuccessionCount: number;
}

export interface RulerGivenNamePool {
  singleNames: string[];
  doubleNamePrefixes: string[];
  doubleNameSuffixes: string[];
  doubleNameChancePercent?: number;
}

export function calculateSuccessionEffect(
  year: number,
  reignYears: number,
  previousSuccessionYears: number[],
  shockMultiplier = 1
): SuccessionEffectRule {
  const recentSuccessionCount =
    previousSuccessionYears.filter(
      (successionYear) => year - successionYear <= SUCCESSION_LOOKBACK_MONTHS
    ).length + 1;

  if (recentSuccessionCount >= 3) {
    return {
      level: "succession-crisis",
      durationYears: scaleDuration(SUCCESSION_LONG_REIGN_SHOCK_MONTHS, shockMultiplier),
      loyaltyRecoveryMultiplier: softenMultiplier(
        SUCCESSION_CRISIS_LOYALTY_MULTIPLIER,
        shockMultiplier
      ),
      rebellionRiskMultiplier: softenMultiplier(
        SUCCESSION_CRISIS_REBELLION_MULTIPLIER,
        shockMultiplier
      ),
      recentSuccessionCount,
    };
  }

  if (recentSuccessionCount >= 2) {
    return {
      level: "succession-instability",
      durationYears: scaleDuration(SUCCESSION_SHOCK_MONTHS, shockMultiplier),
      loyaltyRecoveryMultiplier: softenMultiplier(
        SUCCESSION_INSTABILITY_LOYALTY_MULTIPLIER,
        shockMultiplier
      ),
      rebellionRiskMultiplier: softenMultiplier(
        SUCCESSION_INSTABILITY_REBELLION_MULTIPLIER,
        shockMultiplier
      ),
      recentSuccessionCount,
    };
  }

  return {
    level: "succession-shock",
    durationYears:
      reignYears >= SUCCESSION_LONG_REIGN_MONTHS
        ? scaleDuration(SUCCESSION_LONG_REIGN_SHOCK_MONTHS, shockMultiplier)
        : scaleDuration(SUCCESSION_SHOCK_MONTHS, shockMultiplier),
    loyaltyRecoveryMultiplier: softenMultiplier(
      SUCCESSION_SHOCK_LOYALTY_MULTIPLIER,
      shockMultiplier
    ),
    rebellionRiskMultiplier: softenMultiplier(
      SUCCESSION_SHOCK_REBELLION_MULTIPLIER,
      shockMultiplier
    ),
    recentSuccessionCount,
  };
}

function scaleDuration(duration: number, multiplier: number) {
  return Math.max(1, Math.round(duration * multiplier));
}

function softenMultiplier(multiplier: number, shockMultiplier: number) {
  if (multiplier >= 1) {
    return 1 + (multiplier - 1) * shockMultiplier;
  }
  return 1 - (1 - multiplier) * shockMultiplier;
}

export function pickRulerGivenName(
  names: string[] | RulerGivenNamePool,
  recentNames: string[],
  roll: (maxExclusive: number) => number
) {
  if (!Array.isArray(names)) {
    return pickRulerGivenNameFromPool(names, recentNames, roll);
  }
  const historical = new Set(recentNames);
  const recent = new Set(recentNames.slice(-8));
  const neverUsedCandidates = names.filter((name) => !historical.has(name));
  const recentSafeCandidates = names.filter((name) => !recent.has(name));
  const pool =
    neverUsedCandidates.length > 0
      ? neverUsedCandidates
      : recentSafeCandidates.length > 0
      ? recentSafeCandidates
      : names.filter((name) => name !== recentNames[recentNames.length - 1]);
  const finalPool = pool.length > 0 ? pool : names;
  return finalPool[roll(finalPool.length)];
}

function pickRulerGivenNameFromPool(
  pool: RulerGivenNamePool,
  recentNames: string[],
  roll: (maxExclusive: number) => number
) {
  const doubleChance = pool.doubleNameChancePercent ?? 24;
  const preferDouble = roll(100) < doubleChance;
  const primaryPool = preferDouble
    ? createDoubleGivenNames(pool)
    : pool.singleNames;
  const fallbackPool = preferDouble
    ? pool.singleNames
    : createDoubleGivenNames(pool);
  return pickFromNamePool(
    primaryPool.length > 0 ? primaryPool : fallbackPool,
    fallbackPool,
    recentNames,
    roll
  );
}

function createDoubleGivenNames(pool: RulerGivenNamePool) {
  const names: string[] = [];
  pool.doubleNamePrefixes.forEach((prefix) => {
    pool.doubleNameSuffixes.forEach((suffix) => {
      if (prefix !== suffix) {
        names.push(`${prefix}${suffix}`);
      }
    });
  });
  return names;
}

function pickFromNamePool(
  primaryPool: string[],
  fallbackPool: string[],
  recentNames: string[],
  roll: (maxExclusive: number) => number
) {
  const historical = new Set(recentNames);
  const recent = new Set(recentNames.slice(-8));
  const candidates = primaryPool.filter((name) => !historical.has(name));
  const fallbackCandidates = fallbackPool.filter((name) => !historical.has(name));
  const recentSafeCandidates = primaryPool.filter((name) => !recent.has(name));
  const recentSafeFallbackCandidates = fallbackPool.filter((name) => !recent.has(name));
  const pool =
    candidates.length > 0
      ? candidates
      : fallbackCandidates.length > 0
      ? fallbackCandidates
      : recentSafeCandidates.length > 0
      ? recentSafeCandidates
      : recentSafeFallbackCandidates.length > 0
      ? recentSafeFallbackCandidates
      : primaryPool.filter((name) => name !== recentNames[recentNames.length - 1]);
  const finalPool = pool.length > 0 ? pool : [...primaryPool, ...fallbackPool];
  return finalPool[roll(finalPool.length)];
}
