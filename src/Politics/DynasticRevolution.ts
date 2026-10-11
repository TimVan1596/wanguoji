import { selectIndependentPoliticalShocks, type PoliticalSuccessionShock } from "./PoliticalSuccessionCrisis";
import type { Ruler } from "./Dynasty";
import { calculateSuccessionEffect } from "./SuccessionRules";
import worldRandom from "../Simulation/WorldRandom";

export interface DynastyHouseEpoch {
  houseName: string;
  startMonth: number;
  endMonth?: number;
  foundingRulerId: string;
  startReason: "FOUNDING" | "NATURAL_HOUSE_SUCCESSION" | "USURPATION" | "RESTORATION";
  displacedHouseName?: string;
  displacedSuccessorId?: string;
  displacedDesignatedHeirId?: string;
}

export interface RevolutionContext {
  worldMonth: number; identityStage: string; status: string; stability: number; cityCount: number;
  predecessor: Ruler; successor?: Ruler; successionReason: "natural" | "combat" | "captured";
  previousSuccessionMonths: number[];
  factionId?: string;
  politicalShocks?: PoliticalSuccessionShock[];
}

export function getRevolutionEligibility(context: RevolutionContext) {
  const minorSuccessor = Boolean(context.successor && context.worldMonth - context.successor.bornYear < 16 * 12);
  const recordedTransitions = calculateSuccessionEffect(context.worldMonth,
    context.worldMonth - (context.predecessor.accessionYear ?? context.worldMonth), context.previousSuccessionMonths);
  const crisis = calculateSuccessionEffect(context.worldMonth,
    context.worldMonth - (context.predecessor.accessionYear ?? context.worldMonth),
    context.previousSuccessionMonths.concat(minorSuccessor ? [context.worldMonth, context.worldMonth] : []));
  const evidence: string[] = [];
  if (minorSuccessor) evidence.push("MINOR_SUCCESSOR");
  if (recordedTransitions.recentSuccessionCount >= 3) evidence.push("RECENT_SUCCESSION_CHAIN");
  if (context.successionReason !== "natural") evidence.push(context.successionReason === "combat" ? "PREDECESSOR_COMBAT_DEATH" : "PREDECESSOR_CAPTURED");
  if (context.cityCount === 1) evidence.push("ONE_CITY_REMAINING");
  const blockers: string[] = [];
  if (!context.successor) blockers.push("NO_ELIGIBLE_LEGITIMATE_SUCCESSOR");
  if (context.identityStage !== "STATE") blockers.push("NOT_STATE");
  if (context.status !== "ACTIVE" || context.cityCount <= 0) blockers.push("NOT_ACTIVE_STATE");
  // Preserve the existing crisis and violent one-city tiers. The political
  // shock tier requires one independently sourced severe shock plus multiple
  // signs of vulnerability at this succession boundary.
  const compoundExposure = context.cityCount === 1 && context.successionReason !== "natural";
  const independentShocks = selectIndependentPoliticalShocks(context.politicalShocks ?? [], context.factionId, context.predecessor, context.worldMonth);
  const vulnerabilityScore = (context.cityCount <= 2 ? 2 : context.cityCount <= 4 ? 1 : 0) +
    (context.stability <= 45 ? 2 : context.stability <= 60 ? 1 : 0) +
    (crisis.level === "succession-instability" ? 1 : 0) + (minorSuccessor ? 1 : 0);
  const politicalExposure = (independentShocks.length > 0 || context.successionReason !== "natural") && vulnerabilityScore >= 2;
  const riskTier = crisis.level === "succession-crisis" ? "CRISIS" as const
    : compoundExposure ? (crisis.level === "succession-instability" ? "COMPOUND_INSTABILITY" as const : "COMPOUND_SHOCK" as const)
    : politicalExposure ? "POLITICAL_SHOCK" as const : "BLOCKED" as const;
  if (riskTier === "POLITICAL_SHOCK") {
    if (independentShocks.some(shock => shock.kind === "CAPITAL_LOSS")) evidence.push("RECENT_CAPITAL_LOSS");
    if (independentShocks.some(shock => shock.kind === "EMPIRE_SPLIT")) evidence.push("RECENT_EMPIRE_SPLIT");
    if (context.successionReason !== "natural") evidence.push(context.successionReason === "combat" ? "PREDECESSOR_COMBAT_DEATH" : "PREDECESSOR_CAPTURED");
    if (context.cityCount <= 4) evidence.push("FEW_CITIES_REMAINING");
    if (context.stability <= 60) evidence.push("LOW_FACTION_STABILITY");
    if (crisis.level === "succession-instability") evidence.push("RECENT_SUCCESSION_INSTABILITY");
    evidence.push("POLITICAL_VULNERABILITY");
  }
  if (riskTier === "BLOCKED") blockers.push("NO_SUCCESSION_CRISIS");
  if (!evidence.length) blockers.push("SUCCESSOR_NOT_VULNERABLE");
  // The same predecessor outcome can be added by both the general and the
  // political-shock evidence paths. Keep one code per fact in the derived
  // eligibility result; canonical history remains untouched.
  const normalizedEvidence = [...new Set(evidence)];
  return { blockers, evidence: normalizedEvidence, crisis, riskTier, politicalShocks: riskTier === "POLITICAL_SHOCK" ? independentShocks : [],
    observedPoliticalShocks: independentShocks, politicalVulnerability: vulnerabilityScore >= 2, vulnerabilityScore };
}

const EVIDENCE_CHANCE_PERCENT: Readonly<Record<string, number>> = {
  PREDECESSOR_CAPTURED: 3, ONE_CITY_REMAINING: 3, RECENT_SUCCESSION_CHAIN: 2,
  MINOR_SUCCESSOR: 2, PREDECESSOR_COMBAT_DEATH: 1,
};
const MAX_REVOLUTION_CHANCE_PERCENT = 18;

function getRevolutionChanceProfile(context: RevolutionContext, eligibility: ReturnType<typeof getRevolutionEligibility>) {
  if (eligibility.blockers.length) return { chance: 0, baseChance: 0, modifierChance: 0, capped: false, riskMultiplier: 0 };
  // Integer percentage points avoid accumulated float error at the strict roll boundary.
  const basePercent = context.stability <= 30 ? 14 : context.stability <= 45 ? 10 : context.stability <= 60 ? 6 : 4;
  if (eligibility.riskTier === "POLITICAL_SHOCK") {
    const distinctShockCount = new Set(eligibility.politicalShocks.map(shock => shock.eventId)).size + (context.successionReason !== "natural" ? 1 : 0);
    const politicalRiskPercent = Math.min(6, 2 + (distinctShockCount >= 2 ? 1 : 0) +
      (context.cityCount <= 2 ? 1 : 0) + (context.stability <= 45 ? 1 : 0) +
      (eligibility.crisis.level === "succession-instability" || eligibility.evidence.includes("MINOR_SUCCESSOR") ? 1 : 0));
    return { chance: politicalRiskPercent / 100, baseChance: .02, modifierChance: (politicalRiskPercent - 2) / 100,
      capped: politicalRiskPercent === 6, riskMultiplier: 1 };
  }
  const modifierPercent = Object.entries(EVIDENCE_CHANCE_PERCENT)
    .reduce((total, [evidence, percent]) => total + (eligibility.evidence.includes(evidence) ? percent : 0), 0);
  const riskMultiplier = eligibility.riskTier === "CRISIS" ? 1 : eligibility.riskTier === "COMPOUND_INSTABILITY" ? 0.5 : 0.25;
  return { chance: Math.min(MAX_REVOLUTION_CHANCE_PERCENT, basePercent + modifierPercent) * riskMultiplier / 100, riskMultiplier,
    baseChance: basePercent / 100, modifierChance: modifierPercent / 100,
    capped: basePercent + modifierPercent > MAX_REVOLUTION_CHANCE_PERCENT };
}

/** Pure probability from the existing pre-roll authoritative gates and recorded evidence. */
export function getDynasticRevolutionChance(context: RevolutionContext, eligibility = getRevolutionEligibility(context)) {
  return getRevolutionChanceProfile(context, eligibility).chance;
}

/** Exactly one draw at an eligible authoritative succession boundary; observers reuse its result. */
export function evaluateDynasticRevolution(context: RevolutionContext, roll = () => worldRandom.next()) {
  const result = getRevolutionEligibility(context);
  const profile = getRevolutionChanceProfile(context, result);
  const hardEligible = result.blockers.length === 0;
  if (!hardEligible) return { ...result, ...profile, hardEligible, rollAttempted: false, rollResult: undefined, usurpation: false };
  const rollResult = roll();
  const usurpation = rollResult < profile.chance;
  return { ...result, ...profile, hardEligible, rollAttempted: true, rollResult, usurpation,
    blockers: usurpation ? [] : ["ROLL_FAILED"] };
}

export function beginHouseEpoch(epochs: DynastyHouseEpoch[], epoch: DynastyHouseEpoch) {
  const previous = epochs.at(-1);
  if (previous && previous.endMonth === undefined) previous.endMonth = Math.max(previous.startMonth, epoch.startMonth - 1);
  epochs.push(epoch);
}

export function formatRevolutionEvidence(evidence: string[]) {
  const labels: Record<string, string> = { MINOR_SUCCESSOR: "合法继承人未成年", RECENT_SUCCESSION_CHAIN: "近期连续换君",
    RECENT_SUCCESSION_INSTABILITY: "近期继位频繁", PREDECESSOR_COMBAT_DEATH: "前君战死", PREDECESSOR_CAPTURED: "前君被俘处死",
    ONE_CITY_REMAINING: "仅余一城", FEW_CITIES_REMAINING: "所余城市不多", LOW_FACTION_STABILITY: "国家稳定度偏低",
    RECENT_CAPITAL_LOSS: "前君任内近期失都", RECENT_EMPIRE_SPLIT: "前君任内近期发生重大分裂",
    POLITICAL_VULNERABILITY: "继位时存在政治脆弱性", WEAK_STATE_POSITION: "少城且稳定度低" };
  const seen = new Set<string>();
  return evidence.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  }).map((item) => labels[item]).filter(Boolean).join("、");
}
