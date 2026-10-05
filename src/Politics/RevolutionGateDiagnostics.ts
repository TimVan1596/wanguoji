import { isRuntimeDebugEnabled } from "../Runtime/DebugMode";
import type { RevolutionContext, evaluateDynasticRevolution } from "./DynasticRevolution";

const BLOCKERS = ["NO_ELIGIBLE_LEGITIMATE_SUCCESSOR", "NOT_STATE", "NOT_ACTIVE_STATE", "STABILITY_TOO_HIGH",
  "NO_SUCCESSION_CRISIS", "SUCCESSOR_NOT_VULNERABLE", "ROLL_FAILED"] as const;
function emptyCounters() {
  return { successionBoundaryCheckCount: 0, hasLegitimateSuccessorCount: 0, crisisEligibleCount: 0,
    vulnerabilityEligibleCount: 0, stabilityEligibleCount: 0, fullyEligibleBeforeRollCount: 0,
    rollFailedCount: 0, usurpationCount: 0 };
}
interface EligibleBoundary {
  factionId: string; factionName: string; month: number; stability: number; evidence: string[];
  successionReason: RevolutionContext["successionReason"]; successorAgeMonths: number;
}

/** Observes the already-computed result. Never draws RNG or enters the save DTO. */
export class RevolutionGateDiagnostics {
  private counters = emptyCounters();
  private blockerCounts = Object.fromEntries(BLOCKERS.map(key => [key, 0])) as Record<typeof BLOCKERS[number], number>;
  private recentFullyEligibleBoundaries: EligibleBoundary[] = [];
  constructor(private readonly enabled = isRuntimeDebugEnabled) {}
  reset() {
    this.counters = emptyCounters();
    BLOCKERS.forEach(key => { this.blockerCounts[key] = 0; });
    this.recentFullyEligibleBoundaries = [];
  }
  record(factionId: string, factionName: string, context: RevolutionContext, result: ReturnType<typeof evaluateDynasticRevolution>) {
    if (!this.enabled()) return;
    const counters = this.counters, blockers = new Set(result.blockers);
    counters.successionBoundaryCheckCount++;
    if (context.successor) counters.hasLegitimateSuccessorCount++;
    if (!blockers.has("NO_SUCCESSION_CRISIS")) counters.crisisEligibleCount++;
    if (!blockers.has("SUCCESSOR_NOT_VULNERABLE")) counters.vulnerabilityEligibleCount++;
    if (!blockers.has("STABILITY_TOO_HIGH")) counters.stabilityEligibleCount++;
    BLOCKERS.forEach(key => { if (blockers.has(key)) this.blockerCounts[key]++; });
    if (blockers.has("ROLL_FAILED")) counters.rollFailedCount++;
    if (result.usurpation) counters.usurpationCount++;
    if (result.usurpation || blockers.has("ROLL_FAILED")) {
      counters.fullyEligibleBeforeRollCount++;
      this.recentFullyEligibleBoundaries.unshift({ factionId, factionName, month: context.worldMonth,
        stability: context.stability, evidence: [...result.evidence], successionReason: context.successionReason,
        successorAgeMonths: context.worldMonth - context.successor!.bornYear });
      this.recentFullyEligibleBoundaries.length = Math.min(10, this.recentFullyEligibleBoundaries.length);
    }
  }
  snapshot() {
    return { scope: "debug session; resets on new world/load", enabled: this.enabled(),
      counterSemantics: "Individual gate counts are independent; fullyEligibleBeforeRollCount requires all gates.",
      ...this.counters, blockerCounts: { ...this.blockerCounts },
      recentFullyEligibleBoundaries: this.recentFullyEligibleBoundaries.map(boundary => ({ ...boundary, evidence: [...boundary.evidence] })) };
  }
}
