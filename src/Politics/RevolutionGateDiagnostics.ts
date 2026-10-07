import { isRuntimeDebugEnabled } from "../Runtime/DebugMode";
import type { RevolutionContext, evaluateDynasticRevolution } from "./DynasticRevolution";

const BLOCKERS = ["NO_ELIGIBLE_LEGITIMATE_SUCCESSOR", "NOT_STATE", "NOT_ACTIVE_STATE",
  "NO_SUCCESSION_CRISIS", "SUCCESSOR_NOT_VULNERABLE", "ROLL_FAILED"] as const;
function emptyCounters() {
  return { successionBoundaryCheckCount: 0, hasLegitimateSuccessorCount: 0, crisisEligibleCount: 0,
    vulnerabilityEligibleCount: 0, hardEligibleBeforeRollCount: 0, rollAttemptCount: 0,
    rollFailedCount: 0, usurpationCount: 0 };
}
function emptyChanceBuckets() {
  return { base: { "4%": 0, "6%": 0, "10%": 0, "14%": 0 } as Record<string, number>,
    final: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`${i + 4}%`, 0])) as Record<string, number>,
    modifierAppliedCount: 0, cappedCount: 0 };
}
interface BoundaryObservation {
  factionId: string; factionName: string; month: number; stability: number; evidence: string[];
  crisisLevel: string; computedChance: number; baseChance: number; modifierChance: number; capped: boolean;
  hardEligible: boolean; rollAttempted: boolean; rollResult?: number; usurpation: boolean; blockers: string[];
  successionReason: RevolutionContext["successionReason"]; successorAgeMonths?: number;
}

/** Observes the already-computed result. Never draws RNG or enters the save DTO. */
export class RevolutionGateDiagnostics {
  private counters = emptyCounters();
  private chanceBuckets = emptyChanceBuckets();
  private blockerCounts = Object.fromEntries(BLOCKERS.map(key => [key, 0])) as Record<typeof BLOCKERS[number], number>;
  private recentEligibleBoundaries: BoundaryObservation[] = [];
  private recentBoundaryChecks: BoundaryObservation[] = [];
  constructor(private readonly enabled = isRuntimeDebugEnabled) {}
  reset() {
    this.counters = emptyCounters(); this.chanceBuckets = emptyChanceBuckets();
    BLOCKERS.forEach(key => { this.blockerCounts[key] = 0; });
    this.recentEligibleBoundaries = []; this.recentBoundaryChecks = [];
  }
  record(factionId: string, factionName: string, context: RevolutionContext, result: ReturnType<typeof evaluateDynasticRevolution>) {
    if (!this.enabled()) return;
    const counters = this.counters, blockers = new Set(result.blockers);
    counters.successionBoundaryCheckCount++;
    if (context.successor) counters.hasLegitimateSuccessorCount++;
    if (!blockers.has("NO_SUCCESSION_CRISIS")) counters.crisisEligibleCount++;
    if (!blockers.has("SUCCESSOR_NOT_VULNERABLE")) counters.vulnerabilityEligibleCount++;
    if (result.hardEligible) counters.hardEligibleBeforeRollCount++;
    BLOCKERS.forEach(key => { if (blockers.has(key)) this.blockerCounts[key]++; });
    if (blockers.has("ROLL_FAILED")) counters.rollFailedCount++;
    if (result.usurpation) counters.usurpationCount++;
    const observation: BoundaryObservation = { factionId, factionName, month: context.worldMonth,
      stability: context.stability, evidence: [...result.evidence], crisisLevel: result.crisis.level,
      computedChance: result.chance, baseChance: result.baseChance, modifierChance: result.modifierChance, capped: result.capped,
      hardEligible: result.hardEligible, rollAttempted: result.rollAttempted, rollResult: result.rollResult,
      usurpation: result.usurpation, blockers: [...result.blockers], successionReason: context.successionReason,
      successorAgeMonths: context.successor ? context.worldMonth - context.successor.bornYear : undefined };
    this.recentBoundaryChecks.unshift(observation);
    this.recentBoundaryChecks.length = Math.min(10, this.recentBoundaryChecks.length);
    if (result.rollAttempted) {
      counters.rollAttemptCount++;
      this.chanceBuckets.base[`${Math.round(result.baseChance * 100)}%`]++;
      this.chanceBuckets.final[`${Math.round(result.chance * 100)}%`]++;
      if (result.modifierChance > 0) this.chanceBuckets.modifierAppliedCount++;
      if (result.capped) this.chanceBuckets.cappedCount++;
      this.recentEligibleBoundaries.unshift(observation);
      this.recentEligibleBoundaries.length = Math.min(10, this.recentEligibleBoundaries.length);
    }
  }
  snapshot() {
    const clone = (boundary: BoundaryObservation) => ({ ...boundary, evidence: [...boundary.evidence], blockers: [...boundary.blockers] });
    return { scope: "debug session; resets on new world/load", enabled: this.enabled(),
      counterSemantics: "Crisis/vulnerability counts are independent; all hard gates are required before the single roll. Stability affects chance only.",
      chanceBucketSemantics: "Base and final chance buckets each partition roll attempts; modifier/capped counts overlap those buckets.",
      ...this.counters, blockerCounts: { ...this.blockerCounts },
      chanceBuckets: { base: { ...this.chanceBuckets.base }, final: { ...this.chanceBuckets.final },
        modifierAppliedCount: this.chanceBuckets.modifierAppliedCount, cappedCount: this.chanceBuckets.cappedCount },
      recentEligibleBoundaries: this.recentEligibleBoundaries.map(clone),
      recentBoundaryChecks: this.recentBoundaryChecks.map(clone) };
  }
}
