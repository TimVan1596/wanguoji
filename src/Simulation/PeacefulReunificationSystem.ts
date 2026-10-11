import type Team from "../Components/Team";
import type { WorldEvent } from "../History/WorldHistory";
import type { DiplomaticRelation } from "../Politics/Diplomacy";
import { evaluateCommonThreatCredibility } from "../Politics/DiplomaticRules";
import { areSameOriginFactions, areFactionsTerritoriallyAdjacent } from "../Politics/StrategicUnionRules";
import { calculateTerritoryMetrics, getFactionTerritoryMetric } from "./TerritoryMetrics";
import type { StrategicUnionCandidate } from "./StrategicUnionSystem";

export const REUNIFICATION_MIN_PEACE_MONTHS = 120;
export const REUNIFICATION_MAX_TERRITORY_RATIO = 0.35;

const monthOf = (e: WorldEvent) => e.monthIndex ?? e.year;
const involvesPair = (e: WorldEvent, r: DiplomaticRelation) => {
  const ids = new Set([...(e.factionIds ?? []), e.actorFactionId, e.targetFactionId]);
  return ids.has(r.factionAId) && ids.has(r.factionBId);
};

/** Positive evidence of uninterrupted attack prohibition; absence of war alone is insufficient.
 * All evidence is persisted V13 history. No session clock or load-dependent eligibility. */
export function verifyNonAggressionPeace(r: DiplomaticRelation, worldMonth: number, events: readonly WorldEvent[]) {
  const relevant = events.filter(e => involvesPair(e, r) && monthOf(e) >= r.startedMonth && monthOf(e) <= worldMonth);
  const signing = relevant.filter(e => e.type === "non-aggression-signed" && monthOf(e) === r.startedMonth);
  if (signing.length !== 1 || r.status !== "NON_AGGRESSION" || r.reason !== "COMMON_THREAT_NON_AGGRESSION") return undefined;
  const first = signing[0], m = first.metadata ?? {};
  if (m.status !== r.status || m.reason !== r.reason || m.startedMonth !== r.startedMonth ||
      m.originalStartedMonth !== r.originalStartedMonth || !Number.isSafeInteger(m.expiresMonth) ||
      Number(m.expiresMonth) <= r.startedMonth || !Number.isSafeInteger(m.renewalCount)) return undefined;
  let expiry = Number(m.expiresMonth), count = Number(m.renewalCount);
  let lastRenewed = m.lastRenewedMonth;
  const ids = [first.id];
  const renewals = relevant.filter(e => e.type === "relation-renewed")
    .sort((a,b) => monthOf(a) - monthOf(b) || a.id.localeCompare(b.id));
  for (const e of renewals) {
    const n = e.metadata ?? {}, month = monthOf(e);
    if (n.status !== r.status || n.reason !== r.reason || n.startedMonth !== r.startedMonth ||
        n.originalStartedMonth !== r.originalStartedMonth || month >= expiry ||
        n.previousExpiresMonth !== expiry || n.renewalCount !== count + 1 ||
        n.lastRenewedMonth !== month || !Number.isSafeInteger(n.newExpiresMonth) ||
        n.newExpiresMonth !== n.expiresMonth || Number(n.newExpiresMonth) <= expiry) return undefined;
    expiry = Number(n.newExpiresMonth); count++; lastRenewed = month; ids.push(e.id);
  }
  if (expiry !== r.expiresMonth || count !== r.renewalCount || lastRenewed !== r.lastRenewedMonth || expiry <= worldMonth) return undefined;
  if (relevant.some(e => ["treaty-expired", "alliance-expired", "alliance-signed", "truce-signed"].includes(e.type))) return undefined;
  const windowStart = worldMonth - REUNIFICATION_MIN_PEACE_MONTHS;
  // This window is checked in addition to the positively reconstructed treaty chain.
  if (events.some(e => monthOf(e) >= windowStart && monthOf(e) <= worldMonth && involvesPair(e,r) &&
      (e.category === "war" || e.type === "city-captured" || e.type === "capital-fallen"))) return undefined;
  return { signingEventId: first.id, eventIds: ids, verifiedFromMonth: r.startedMonth, verifiedUntilMonth: worldMonth };
}

export interface PeacefulReunificationInput {
  teams: Team[]; relations: DiplomaticRelation[]; worldMonth: number; totalCells: number; blockSize: number;
  getRelationEvents: (relation: DiplomaticRelation) => readonly WorldEvent[];
}
export function diagnosePeacefulReunificationCandidates(input: PeacefulReunificationInput) {
  const active = new Map(input.teams.filter(t => t.status === "ACTIVE" && !t.isDie).map(t => [t.name,t]));
  const metrics = calculateTerritoryMetrics(input.teams,input.totalCells);
  const share = (t: Team) => getFactionTerritoryMetric(metrics,t.name).controlledTerritoryShare;
  return input.relations.filter(r => r.status === "NON_AGGRESSION")
    .sort((a,b) => a.startedMonth-b.startedMonth || a.factionAId.localeCompare(b.factionAId) || a.factionBId.localeCompare(b.factionBId))
    .flatMap(relation => {
      const a = active.get(relation.factionAId), b = active.get(relation.factionBId);
      if (!a || !b) return [];
      const sameOrigin = areSameOriginFactions(a,b), age = input.worldMonth-relation.startedMonth;
      const strong = share(a) >= share(b) ? a : b, weak = strong === a ? b : a;
      const blockers: string[] = [];
      if (!sameOrigin) blockers.push("NOT_SAME_ORIGIN");
      if (a.identityStage !== "STATE" || b.identityStage !== "STATE" || !a.cities.length || !b.cities.length) blockers.push("NO_ACTIVE_STATE");
      if (relation.expiresMonth <= input.worldMonth) blockers.push("TREATY_EXPIRED");
      if (age < REUNIFICATION_MIN_PEACE_MONTHS) blockers.push("NON_AGGRESSION_TOO_SHORT");
      if (!areFactionsTerritoriallyAdjacent(a,b,input.blockSize)) blockers.push("NOT_ADJACENT");
      if (share(strong) <= 0 || share(weak) > share(strong)*REUNIFICATION_MAX_TERRITORY_RATIO) blockers.push("POWER_GAP_TOO_SMALL");
      if (weak.cities.length !== 1 || weak.cities.length > strong.cities.length) blockers.push("WEAKER_TOO_MANY_CITIES");
      // Indexed history is queried only for the same-origin, aged, still-effective relations.
      const events = sameOrigin && age >= REUNIFICATION_MIN_PEACE_MONTHS && relation.expiresMonth > input.worldMonth
        ? input.getRelationEvents(relation) : [];
      const peace = events.length ? verifyNonAggressionPeace(relation,input.worldMonth,events) : undefined;
      if (sameOrigin && age >= REUNIFICATION_MIN_PEACE_MONTHS && !peace) blockers.push("PEACE_EVIDENCE_INSUFFICIENT");
      const threat = relation.commonThreatFactionId ? active.get(relation.commonThreatFactionId) : undefined;
      const direct = (t: Team) => Boolean(threat && (areFactionsTerritoriallyAdjacent(t,threat,input.blockSize) || events.some(e =>
        monthOf(e) >= input.worldMonth-36 && monthOf(e) <= input.worldMonth &&
        (e.type === "city-captured" || e.type === "capital-fallen") &&
        ((e.actorFactionId === t.name && e.targetFactionId === threat.name) || (e.actorFactionId === threat.name && e.targetFactionId === t.name)))));
      const credibility = evaluateCommonThreatCredibility({ territoryShareA:share(a),territoryShareB:share(b),threatTerritoryShare:threat ? share(threat) : 0,
        directA:direct(a),directB:direct(b),adjacentPair:areFactionsTerritoriallyAdjacent(a,b,input.blockSize),priorRelationMonths:age,
        capturedA:false,capturedB:false,capitalFall:false });
      const pressure = credibility === "CREDIBLE" || credibility === "SEVERE";
      const stability = weak.cities.length ? weak.cities.reduce((sum,c) => sum+c.loyalty,0)/weak.cities.length : 0;
      const veryWeak = share(weak) <= 8 && weak.cities.length === 1 && stability <= 45;
      if (!pressure && !veryWeak) blockers.push("NO_PRESSURE_TRIGGER");
      const candidate: StrategicUnionCandidate | undefined = blockers.length === 0 && peace ? {
        absorbingFaction:strong,absorbedFaction:weak,alliance:relation,unionPath:"LONG_NON_AGGRESSION",peaceEvidence:peace,
        commonThreatFactionId:pressure ? relation.commonThreatFactionId : undefined,
        absorbingTerritoryShare:share(strong),absorbedTerritoryShare:share(weak),bilateralWarFreeMonths:REUNIFICATION_MIN_PEACE_MONTHS,
      } : undefined;
      return [{ factionAId:a.name,factionBId:b.name,sameOrigin,relationMonths:age,blockers,candidate,
        weakerCityCount:weak.cities.length,weakerTerritoryShare:share(weak),weakerStability:stability,crediblePressure:pressure,veryWeak }];
    });
}
