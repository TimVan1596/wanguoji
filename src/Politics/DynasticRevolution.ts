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
  if (crisis.level !== "succession-crisis") blockers.push("NO_SUCCESSION_CRISIS");
  if (!evidence.length) blockers.push("SUCCESSOR_NOT_VULNERABLE");
  return { blockers, evidence, crisis };
}

const EVIDENCE_CHANCE_PERCENT: Readonly<Record<string, number>> = {
  PREDECESSOR_CAPTURED: 3, ONE_CITY_REMAINING: 3, RECENT_SUCCESSION_CHAIN: 2,
  MINOR_SUCCESSOR: 2, PREDECESSOR_COMBAT_DEATH: 1,
};
const MAX_REVOLUTION_CHANCE_PERCENT = 18;

function getRevolutionChanceProfile(context: RevolutionContext, eligibility: ReturnType<typeof getRevolutionEligibility>) {
  if (eligibility.blockers.length) return { chance: 0, baseChance: 0, modifierChance: 0, capped: false };
  // Integer percentage points avoid accumulated float error at the strict roll boundary.
  const basePercent = context.stability <= 30 ? 14 : context.stability <= 45 ? 10 : context.stability <= 60 ? 6 : 4;
  const modifierPercent = Object.entries(EVIDENCE_CHANCE_PERCENT)
    .reduce((total, [evidence, percent]) => total + (eligibility.evidence.includes(evidence) ? percent : 0), 0);
  return { chance: Math.min(MAX_REVOLUTION_CHANCE_PERCENT, basePercent + modifierPercent) / 100,
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
    PREDECESSOR_COMBAT_DEATH: "前君战死", PREDECESSOR_CAPTURED: "前君被俘处死", ONE_CITY_REMAINING: "仅余一城" };
  return evidence.map((item) => labels[item]).filter(Boolean).join("、");
}
