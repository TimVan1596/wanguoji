import type { WorldEvent } from "../History/WorldHistory";
import type { Ruler } from "./Dynasty";
import { getRecordedKinRelation } from "./DynasticCandidateRules";
import { isNaturallyDeadByMonth } from "./RulerLifespanRules";
import { yearsToMonths } from "../Simulation/WorldTime";

export const DEPOSITION_EVALUATION_INTERVAL_MONTHS = 12;
export const DEPOSITION_COOLDOWN_MONTHS = 60;
export const DEPOSITION_EVIDENCE_WINDOW_MONTHS = 36;
export const DEPOSITION_MAX_CANDIDATES = 2;

export type DepositionRiskGroup = "CONSERVATIVE" | "CONTROL";
export interface DepositionCrisisEvidence {
  eventId: string;
  groupId: string;
  month: number;
  type: WorldEvent["type"];
  description: string;
}
export interface DepositionCandidate {
  ruler: Ruler;
  relation: NonNullable<ReturnType<typeof getRecordedKinRelation>>;
}
export interface DepositionEvaluation {
  eligible: boolean;
  blockers: string[];
  candidates: DepositionCandidate[];
  evidence: DepositionCrisisEvidence[];
  probability: number;
  vulnerability: boolean;
}

const relationPriority = ["DIRECT_CHILD", "GRANDCHILD", "SIBLING", "NEPHEW", "UNCLE", "COUSIN"];

/**
 * Only canonical events with an unambiguous affected-faction role are accepted.
 * A historyGroupId collapses multiple views of one political/war transition.
 */
export function getRecentDepositionEvidence(
  factionId: string,
  events: readonly WorldEvent[],
  worldMonth: number
): DepositionCrisisEvidence[] {
  const start = worldMonth - DEPOSITION_EVIDENCE_WINDOW_MONTHS;
  const byGroup = new Map<string, DepositionCrisisEvidence>();
  for (const event of events) {
    const month = event.monthIndex ?? event.year;
    if (month < start || month > worldMonth) continue;
    let description: string | undefined;
    if (event.type === "capital-fallen" && event.targetFactionId === factionId) description = "本国都城陷落";
    else if (event.type === "empire-split" && (event.targetFactionId === factionId || event.metadata?.parentFactionId === factionId)) description = "本国发生重大分裂";
    else if (event.type === "city-revolt" && event.targetFactionId === factionId) description = "本国发生城市叛乱";
    else if (event.type === "city-captured" && (event.targetFactionId === factionId || event.previousOwnerFactionId === factionId)) description = "本国失去城市";
    if (!description) continue;
    const groupId = event.historyGroupId ?? event.id;
    if (!byGroup.has(groupId)) byGroup.set(groupId, { eventId: event.id, groupId, month, type: event.type, description });
  }
  return [...byGroup.values()].sort((a, b) => a.month - b.month || a.eventId.localeCompare(b.eventId));
}

export function selectDepositionCandidates({
  currentRuler, rulers, houseName, worldMonth,
}: {
  currentRuler: Ruler;
  rulers: readonly Ruler[];
  houseName: string;
  worldMonth: number;
}): DepositionCandidate[] {
  return rulers.flatMap((ruler) => {
    if (ruler.id === currentRuler.id || ruler.houseName !== houseName ||
      (ruler.status !== "heir" && ruler.status !== "kin") || ruler.reignOrdinal !== undefined ||
      ruler.accessionYear !== undefined || ruler.chronicle !== undefined ||
      ruler.deathMonth !== undefined || ruler.deathReason !== undefined ||
      isNaturallyDeadByMonth(ruler.naturalDeathYear ?? ruler.plannedEndYear, worldMonth) ||
      worldMonth - ruler.bornYear < yearsToMonths(16)) return [];
    const relation = getRecordedKinRelation(ruler, currentRuler, [...rulers]);
    return relation && relation !== "COLLATERAL_KIN" ? [{ ruler, relation }] : [];
  }).sort((a, b) => relationPriority.indexOf(a.relation) - relationPriority.indexOf(b.relation) ||
    a.ruler.bornYear - b.ruler.bornYear || a.ruler.id.localeCompare(b.ruler.id))
    .slice(0, DEPOSITION_MAX_CANDIDATES);
}

export function evaluateDepositionOpportunity({
  factionId, status, identityStage, cityCount, stability, currentRuler, rulers, houseName, worldMonth,
  lastAttemptMonth, events, riskGroup = "CONSERVATIVE",
}: {
  factionId: string;
  status: string;
  identityStage: string;
  cityCount: number;
  stability: number | undefined;
  currentRuler: Ruler | undefined;
  rulers: readonly Ruler[];
  houseName: string;
  worldMonth: number;
  lastAttemptMonth?: number;
  events: readonly WorldEvent[];
  riskGroup?: DepositionRiskGroup;
}): DepositionEvaluation {
  const blockers: string[] = [];
  const ruler = currentRuler;
  const activeOffice = Boolean(ruler && ruler.status === "ruling" && ruler.accessionYear !== undefined &&
    ruler.deathMonth === undefined && ruler.deathReason === undefined &&
    !isNaturallyDeadByMonth(ruler.naturalDeathYear ?? ruler.plannedEndYear, worldMonth));
  if (status !== "ACTIVE") blockers.push("NOT_ACTIVE_STATE");
  if (identityStage !== "STATE") blockers.push("NOT_FORMAL_STATE");
  if (!activeOffice) blockers.push("NO_LIVING_RULER");
  if (cityCount < 1) blockers.push("NO_CITY");
  if (worldMonth % DEPOSITION_EVALUATION_INTERVAL_MONTHS !== 0) blockers.push("NOT_EVALUATION_MONTH");
  if (lastAttemptMonth !== undefined && worldMonth - lastAttemptMonth < DEPOSITION_COOLDOWN_MONTHS) blockers.push("COOLDOWN");
  const vulnerability = (stability !== undefined && stability <= 40) || (cityCount >= 1 && cityCount <= 2);
  if (!vulnerability) blockers.push("NO_CURRENT_VULNERABILITY");
  const evidence = getRecentDepositionEvidence(factionId, events, worldMonth);
  if (!evidence.length) blockers.push("NO_RECENT_REAL_CRISIS");
  const candidates = status === "ACTIVE" && identityStage === "STATE" && cityCount > 0 && activeOffice && ruler
    ? selectDepositionCandidates({ currentRuler: ruler, rulers, houseName, worldMonth })
    : [];
  if (!candidates.length) blockers.push("NO_EXISTING_ADULT_KIN");
  const base = riskGroup === "CONTROL" ? 0.02 : 0.005;
  const step = riskGroup === "CONTROL" ? 0.02 : 0.005;
  const cap = riskGroup === "CONTROL" ? 0.06 : 0.015;
  const probability = evidence.length ? Math.min(cap, base + Math.max(0, evidence.length - 1) * step) : 0;
  return { eligible: blockers.length === 0, blockers, candidates, evidence, probability, vulnerability };
}

export class InReignDepositionDiagnostics {
  private sessionStartMonth = 0;
  private totals = this.empty();
  private readonly recent: Array<{ factionId: string; month: number; blockers: string[]; candidateIds: string[]; evidenceIds: string[]; probability: number }> = [];
  private empty() {
    return { observedChecks: 0, activePolities: 0, existingAdultKinCandidates: 0, qualifiedChecks: 0,
      drawAttempts: 0, failures: 0, successes: 0, cooldownBlocked: 0, expectedSuccesses: 0 };
  }
  reset(worldMonth = 0) { this.sessionStartMonth = worldMonth; this.totals = this.empty(); this.recent.length = 0; }
  observe(factionId: string, worldMonth: number, evaluation: DepositionEvaluation, active: boolean, outcome?: "SUCCESS" | "FAILURE" | "COOLDOWN") {
    this.totals.observedChecks++;
    if (active) this.totals.activePolities++;
    this.totals.existingAdultKinCandidates += evaluation.candidates.length;
    if (evaluation.blockers.includes("COOLDOWN")) this.totals.cooldownBlocked++;
    if (evaluation.eligible) this.totals.qualifiedChecks++;
    if (outcome === "SUCCESS") this.totals.successes++;
    if (outcome === "FAILURE") this.totals.failures++;
    if (evaluation.eligible) {
      this.totals.drawAttempts++;
      this.totals.expectedSuccesses += evaluation.probability;
    }
    this.recent.unshift({ factionId, month: worldMonth, blockers: [...evaluation.blockers],
      candidateIds: evaluation.candidates.map(({ ruler }) => ruler.id), evidenceIds: evaluation.evidence.map(({ eventId }) => eventId), probability: evaluation.probability });
    this.recent.length = Math.min(20, this.recent.length);
  }
  snapshot(worldMonth: number) {
    const elapsedYears = Math.max(0, worldMonth - this.sessionStartMonth) / 12;
    const per100Years = (n: number) => elapsedYears > 0 ? n * 100 / elapsedYears : null;
    return { ...this.totals, elapsedYears, expectedSuccessesPer100Years: per100Years(this.totals.expectedSuccesses),
      actualSuccessesPer100Years: per100Years(this.totals.successes), recent: this.recent.map(row => ({ ...row,
        blockers: [...row.blockers], candidateIds: [...row.candidateIds], evidenceIds: [...row.evidenceIds] })),
      chineseSummary: `宗室废立诊断（本次观察）\n实际观察：${elapsedYears.toFixed(2)}年\n已观察在国正式政权：${this.totals.activePolities}次\n现存成年宗室候选：${this.totals.existingAdultKinCandidates}人次\n完整资格通过：${this.totals.qualifiedChecks}次\n实际抽签：${this.totals.drawAttempts}次\n抽签失败：${this.totals.failures}次\n实际废立：${this.totals.successes}次\n冷却阻断：${this.totals.cooldownBlocked}次\n条件期望废立：${this.totals.expectedSuccesses.toFixed(3)}次` };
  }
}
