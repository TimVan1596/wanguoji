import type {auditMilitaryUsurpers} from './MilitaryUsurpation';
import { isRuntimeDebugEnabled } from "../Runtime/DebugMode";
import { MilitaryPoliticalDiagnostics } from "./MilitaryPoliticalDiagnostics";
import type { RevolutionContext, evaluateDynasticRevolution } from "./DynasticRevolution";

const BLOCKERS = ["NO_ELIGIBLE_LEGITIMATE_SUCCESSOR", "NOT_STATE", "NOT_ACTIVE_STATE",
  "NO_SUCCESSION_CRISIS", "SUCCESSOR_NOT_VULNERABLE", "ROLL_FAILED"] as const;
function emptyCounters() {
  return { successionBoundaryCheckCount: 0, hasLegitimateSuccessorCount: 0, crisisEligibleCount: 0,
    vulnerabilityEligibleCount: 0, capitalLossEvidenceBoundaryCount: 0, empireSplitEvidenceBoundaryCount: 0,
    violentPredecessorBoundaryCount: 0, politicalVulnerabilityBoundaryCount: 0, lowerRiskEligibleCount: 0, politicalShockEligibleCount: 0, hardEligibleBeforeRollCount: 0, rollAttemptCount: 0,
    rollFailedCount: 0, usurpationCount: 0 };
}
function emptyChanceBuckets() {
  return { base: { "2%": 0, "4%": 0, "6%": 0, "10%": 0, "14%": 0 } as Record<string, number>,
    final: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`${i + 2}%`, 0])) as Record<string, number>,
    tiers: { CRISIS: 0, COMPOUND_INSTABILITY: 0, COMPOUND_SHOCK: 0, POLITICAL_SHOCK: 0 }, modifierAppliedCount: 0, cappedCount: 0 };
}
interface BoundaryObservation {
  factionId: string; factionName: string; month: number; stability: number; evidence: string[];
  riskTier: string; riskMultiplier: number; crisisLevel: string; computedChance: number; baseChance: number; modifierChance: number; capped: boolean;
  hardEligible: boolean; rollAttempted: boolean; rollResult?: number; usurpation: boolean; blockers: string[];
  successionReason: RevolutionContext["successionReason"]; successorAgeMonths?: number;
}

/** Observes the already-computed result. Never draws RNG or enters the save DTO. */
export class RevolutionGateDiagnostics {
  private personal={successfulOpportunities:0,withEligibleMilitary:0,qualifiedCandidateChecks:0,personalAccessions:0,generatedAccessions:0,blocked:{} as Record<string,number>};
  private military = new MilitaryPoliticalDiagnostics();
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
    this.personal={successfulOpportunities:0,withEligibleMilitary:0,qualifiedCandidateChecks:0,personalAccessions:0,generatedAccessions:0,blocked:{}};
    this.military.reset();
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
    const observedShocks = result.observedPoliticalShocks ?? [];
    this.military.observe(context.military, observedShocks.length > 0 || context.successionReason !== "natural" || result.crisis.level === "succession-crisis",
      result.baselineChance, result.chance, result.rollAttempted, result.usurpation);
    if (observedShocks.some(shock => shock.kind === "CAPITAL_LOSS")) counters.capitalLossEvidenceBoundaryCount++;
    if (observedShocks.some(shock => shock.kind === "EMPIRE_SPLIT")) counters.empireSplitEvidenceBoundaryCount++;
    if (context.successionReason !== "natural") counters.violentPredecessorBoundaryCount++;
    if (result.politicalVulnerability) counters.politicalVulnerabilityBoundaryCount++;
    if (result.crisis.level === "succession-crisis") counters.crisisEligibleCount++;
    if (result.hardEligible && (result.riskTier === "COMPOUND_SHOCK" || result.riskTier === "COMPOUND_INSTABILITY")) counters.lowerRiskEligibleCount++;
    if (result.hardEligible && result.riskTier === "POLITICAL_SHOCK") counters.politicalShockEligibleCount++;
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
      const baseKey = `${Math.round(result.baseChance * 100)}%`;
      this.chanceBuckets.base[baseKey] = (this.chanceBuckets.base[baseKey] ?? 0) + 1;
      const finalKey = `${Math.round(result.chance * 10000) / 100}%`;
      this.chanceBuckets.final[finalKey] = (this.chanceBuckets.final[finalKey] ?? 0) + 1;
      if (result.modifierChance > 0) this.chanceBuckets.modifierAppliedCount++;
      if (result.capped) this.chanceBuckets.cappedCount++;
      this.recentEligibleBoundaries.unshift(observation);
      this.recentEligibleBoundaries.length = Math.min(10, this.recentEligibleBoundaries.length);
    }
  }
  recordPersonalCandidates(audit:ReturnType<typeof auditMilitaryUsurpers>,selectedId?:string){
    if(!this.enabled())return;
    this.personal.successfulOpportunities++;this.personal.withEligibleMilitary+=Number(audit.eligible.length>0);this.personal.qualifiedCandidateChecks+=audit.eligible.length;
    if(selectedId)this.personal.personalAccessions++;else this.personal.generatedAccessions++;
    for(const [key,value] of Object.entries(audit.blocked))this.personal.blocked[key]=(this.personal.blocked[key]??0)+value;
  }
  snapshot(worldMonth = this.lastObservedMonth) {
    const elapsedWorldYears = Math.max(0, worldMonth - this.sessionStartMonth) / 12;
    const per1000Years = (count: number) => elapsedWorldYears > 0 ? count * 1000 / elapsedWorldYears : null;
    const clone = (boundary: BoundaryObservation) => ({ ...boundary, evidence: [...boundary.evidence], blockers: [...boundary.blockers] });
    const recordedBuckets = Object.entries(this.chanceBuckets.final).filter(([, count]) => count > 0).map(([key]) => parseFloat(key));
    return { chineseSummary: `篡朝诊断（本次观察会话，读取时重置）\n实际观察：${elapsedWorldYears.toFixed(2)}年\n真实继位边界：${this.counters.successionBoundaryCheckCount}次\n有失都证据的继位：${this.counters.capitalLossEvidenceBoundaryCount}次\n有重大分裂证据的继位：${this.counters.empireSplitEvidenceBoundaryCount}次\n前君暴力结局的继位：${this.counters.violentPredecessorBoundaryCount}次\n存在政治脆弱性的继位：${this.counters.politicalVulnerabilityBoundaryCount}次\n原最高级危机合格：${this.counters.crisisEligibleCount}次\n原复合危机合格：${this.counters.lowerRiskEligibleCount}次\n新政治重创合格：${this.counters.politicalShockEligibleCount}次\n实际抽签：${this.counters.rollAttemptCount}次\n抽签概率范围：${recordedBuckets.length ? `${Math.min(...recordedBuckets)}%～${Math.max(...recordedBuckets)}%` : "暂无抽签"}\n期望篡朝：${this.expectedUsurpationCount.toFixed(3)}次\n实际篡朝：${this.counters.usurpationCount}次\n每千世界年条件期望：${per1000Years(this.expectedUsurpationCount)?.toFixed(3) ?? "暂无观察时间"}次\n以上证据统计来自已发生继位；当前候选预览仅显示原继承危机，不扫描新增历史冲击。`, scope: "debug session; resets on new world/load", enabled: this.enabled(),
      counterSemantics: "capitalLossEvidenceBoundaryCount and empireSplitEvidenceBoundaryCount count completed succession boundaries with valid faction history evidence; violentPredecessorBoundaryCount counts combat/captured terminations; politicalVulnerabilityBoundaryCount counts boundaries meeting the multi-signal vulnerability threshold. politicalShockEligibleCount is the new severe-shock plus vulnerability tier. Candidate previews do not scan new historical evidence. Rates cover only months since new world/load.",
      chanceBucketSemantics: "Base and final chance buckets each partition roll attempts; modifier/capped counts overlap those buckets.",
      ...this.counters, personalCandidateSelection:{...this.personal,blocked:{...this.personal.blocked}}, military: this.military.snapshot(), worldMonth, sessionStartMonth: this.sessionStartMonth, elapsedWorldYears,
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
