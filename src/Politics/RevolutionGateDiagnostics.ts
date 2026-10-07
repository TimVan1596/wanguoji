import { isRuntimeDebugEnabled } from "../Runtime/DebugMode";
import type { RevolutionContext, evaluateDynasticRevolution } from "./DynasticRevolution";

const BLOCKERS = ["NO_ELIGIBLE_LEGITIMATE_SUCCESSOR", "NOT_STATE", "NOT_ACTIVE_STATE",
  "NO_SUCCESSION_CRISIS", "SUCCESSOR_NOT_VULNERABLE", "ROLL_FAILED"] as const;
function emptyCounters() {
  return { successionBoundaryCheckCount: 0, hasLegitimateSuccessorCount: 0, crisisEligibleCount: 0,
    vulnerabilityEligibleCount: 0, lowerRiskEligibleCount: 0, hardEligibleBeforeRollCount: 0, rollAttemptCount: 0,
    rollFailedCount: 0, usurpationCount: 0 };
}
function emptyChanceBuckets() {
  return { base: { "4%": 0, "6%": 0, "10%": 0, "14%": 0 } as Record<string, number>,
    final: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`${i + 4}%`, 0])) as Record<string, number>,
    tiers: { CRISIS: 0, COMPOUND_INSTABILITY: 0, COMPOUND_SHOCK: 0 }, modifierAppliedCount: 0, cappedCount: 0 };
}
interface BoundaryObservation {
  factionId: string; factionName: string; month: number; stability: number; evidence: string[];
  riskTier: string; riskMultiplier: number; crisisLevel: string; computedChance: number; baseChance: number; modifierChance: number; capped: boolean;
  hardEligible: boolean; rollAttempted: boolean; rollResult?: number; usurpation: boolean; blockers: string[];
  successionReason: RevolutionContext["successionReason"]; successorAgeMonths?: number;
}

/** Observes the already-computed result. Never draws RNG or enters the save DTO. */
export class RevolutionGateDiagnostics {
  private sessionStartMonth = 0;
  private lastObservedMonth = 0;
  private expectedUsurpationCount = 0;
  private counters = emptyCounters();
  private chanceBuckets = emptyChanceBuckets();
  private blockerCounts = Object.fromEntries(BLOCKERS.map(key => [key, 0])) as Record<typeof BLOCKERS[number], number>;
  private recentEligibleBoundaries: BoundaryObservation[] = [];
  private recentBoundaryChecks: BoundaryObservation[] = [];
  constructor(private readonly enabled = isRuntimeDebugEnabled) {}
  reset(worldMonth = 0) {
    this.sessionStartMonth = worldMonth; this.lastObservedMonth = worldMonth; this.expectedUsurpationCount = 0;
    this.counters = emptyCounters(); this.chanceBuckets = emptyChanceBuckets();
    BLOCKERS.forEach(key => { this.blockerCounts[key] = 0; });
    this.recentEligibleBoundaries = []; this.recentBoundaryChecks = [];
  }
  record(factionId: string, factionName: string, context: RevolutionContext, result: ReturnType<typeof evaluateDynasticRevolution>) {
    if (!this.enabled()) return;
    this.lastObservedMonth = context.worldMonth;
    const counters = this.counters, blockers = new Set(result.blockers);
    counters.successionBoundaryCheckCount++;
    if (context.successor) counters.hasLegitimateSuccessorCount++;
    if (result.crisis.level === "succession-crisis") counters.crisisEligibleCount++;
    if (result.hardEligible && result.riskTier !== "CRISIS") counters.lowerRiskEligibleCount++;
    if (!blockers.has("SUCCESSOR_NOT_VULNERABLE")) counters.vulnerabilityEligibleCount++;
    if (result.hardEligible) counters.hardEligibleBeforeRollCount++;
    BLOCKERS.forEach(key => { if (blockers.has(key)) this.blockerCounts[key]++; });
    if (blockers.has("ROLL_FAILED")) counters.rollFailedCount++;
    if (result.usurpation) counters.usurpationCount++;
    const observation: BoundaryObservation = { factionId, factionName, month: context.worldMonth,
      stability: context.stability, evidence: [...result.evidence], crisisLevel: result.crisis.level,
      riskTier: result.riskTier, riskMultiplier: result.riskMultiplier, computedChance: result.chance, baseChance: result.baseChance, modifierChance: result.modifierChance, capped: result.capped,
      hardEligible: result.hardEligible, rollAttempted: result.rollAttempted, rollResult: result.rollResult,
      usurpation: result.usurpation, blockers: [...result.blockers], successionReason: context.successionReason,
      successorAgeMonths: context.successor ? context.worldMonth - context.successor.bornYear : undefined };
    this.recentBoundaryChecks.unshift(observation);
    this.recentBoundaryChecks.length = Math.min(10, this.recentBoundaryChecks.length);
    if (result.rollAttempted) {
      counters.rollAttemptCount++;
      this.expectedUsurpationCount += result.chance;
      if (result.riskTier !== "BLOCKED") this.chanceBuckets.tiers[result.riskTier]++;
      this.chanceBuckets.base[`${Math.round(result.baseChance * 100)}%`]++;
      const finalKey = `${Math.round(result.chance * 10000) / 100}%`;
      this.chanceBuckets.final[finalKey] = (this.chanceBuckets.final[finalKey] ?? 0) + 1;
      if (result.modifierChance > 0) this.chanceBuckets.modifierAppliedCount++;
      if (result.capped) this.chanceBuckets.cappedCount++;
      this.recentEligibleBoundaries.unshift(observation);
      this.recentEligibleBoundaries.length = Math.min(10, this.recentEligibleBoundaries.length);
    }
  }
  snapshot(worldMonth = this.lastObservedMonth) {
    const elapsedWorldYears = Math.max(0, worldMonth - this.sessionStartMonth) / 12;
    const per1000Years = (count: number) => elapsedWorldYears > 0 ? count * 1000 / elapsedWorldYears : null;
    const clone = (boundary: BoundaryObservation) => ({ ...boundary, evidence: [...boundary.evidence], blockers: [...boundary.blockers] });
    return { scope: "debug session; resets on new world/load", enabled: this.enabled(),
      counterSemantics: "crisisEligibleCount counts the original highest crisis tier; lowerRiskEligibleCount counts hard-eligible compound lower tiers. NO_SUCCESSION_CRISIS means neither highest crisis nor sufficient compound exposure. Rates cover only months since new world/load; null means insufficient denominator.",
      chanceBucketSemantics: "Base and final chance buckets each partition roll attempts; modifier/capped counts overlap those buckets.",
      ...this.counters, worldMonth, sessionStartMonth: this.sessionStartMonth, elapsedWorldYears,
      eligibleRollsPer1000Years: per1000Years(this.counters.rollAttemptCount),
      expectedUsurpationCount: this.expectedUsurpationCount,
      expectedUsurpationsPer1000Years: per1000Years(this.expectedUsurpationCount),
      estimatedWorldYearsPerExpectedUsurpation: elapsedWorldYears > 0 && this.expectedUsurpationCount > 0
        ? elapsedWorldYears / this.expectedUsurpationCount : null,
      actualUsurpationsPer1000Years: per1000Years(this.counters.usurpationCount),
      blockerCounts: { ...this.blockerCounts },
      chanceBuckets: { base: { ...this.chanceBuckets.base }, final: { ...this.chanceBuckets.final },
        tiers: { ...this.chanceBuckets.tiers }, modifierAppliedCount: this.chanceBuckets.modifierAppliedCount, cappedCount: this.chanceBuckets.cappedCount },
      recentEligibleBoundaries: this.recentEligibleBoundaries.map(clone),
      recentBoundaryChecks: this.recentBoundaryChecks.map(clone) };
  }
}
