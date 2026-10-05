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
  const crisis = calculateSuccessionEffect(context.worldMonth,
    context.worldMonth - (context.predecessor.accessionYear ?? context.worldMonth), context.previousSuccessionMonths);
  const evidence: string[] = [];
  if (context.successor && context.worldMonth - context.successor.bornYear < 16 * 12) evidence.push("MINOR_SUCCESSOR");
  if (crisis.recentSuccessionCount >= 3) evidence.push("RECENT_SUCCESSION_CHAIN");
  if (context.successionReason !== "natural") evidence.push(context.successionReason === "combat" ? "PREDECESSOR_COMBAT_DEATH" : "PREDECESSOR_CAPTURED");
  if (context.cityCount <= 1) evidence.push("ONE_CITY_REMAINING");
  const blockers: string[] = [];
  if (!context.successor) blockers.push("NO_ELIGIBLE_LEGITIMATE_SUCCESSOR");
  if (context.identityStage !== "STATE") blockers.push("NOT_STATE");
  if (context.status !== "ACTIVE" || context.cityCount <= 0) blockers.push("NOT_ACTIVE_STATE");
  if (context.stability > 25) blockers.push("STABILITY_TOO_HIGH");
  if (crisis.level !== "succession-crisis") blockers.push("NO_SUCCESSION_CRISIS");
  if (!evidence.length) blockers.push("SUCCESSOR_NOT_VULNERABLE");
  return { blockers, evidence, crisis };
}

/** Exactly one low-frequency draw at an eligible authoritative succession boundary. */
export function evaluateDynasticRevolution(context: RevolutionContext, roll = () => worldRandom.next()) {
  const result = getRevolutionEligibility(context);
  if (result.blockers.length) return { ...result, usurpation: false };
  const usurpation = roll() < 0.04;
  return { ...result, usurpation, blockers: usurpation ? [] : ["ROLL_FAILED"] };
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
