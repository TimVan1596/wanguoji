import type Team from "../Components/Team";
import type City from "../Components/City";
import WorldHistory from "../History/WorldHistory";
import { calculateTerritoryMetrics, getFactionTerritoryMetric } from "../Simulation/TerritoryMetrics";
import { areFactionsTerritoriallyAdjacent, ALLIANCE_DURATION_MONTHS, ALLIANCE_MIN_NON_AGGRESSION_MONTHS, ALLIANCE_MIN_TRUCE_MONTHS_BEFORE_NON_AGGRESSION } from "./StrategicUnionRules";

export type DiplomaticStatus = "NEUTRAL" | "TRUCE" | "NON_AGGRESSION" | "ALLIANCE";
export type DiplomaticReason = "WAR_EXHAUSTION_TRUCE" | "COMMON_THREAT_NON_AGGRESSION" | "COMMON_THREAT_ALLIANCE";
export interface DiplomaticRelation {
  factionAId: string;
  factionBId: string;
  status: Exclude<DiplomaticStatus, "NEUTRAL">;
  startedMonth: number;
  expiresMonth: number;
  reason: DiplomaticReason;
  commonThreatFactionId?: string;
  preconditionStatus?: "TRUCE" | "NON_AGGRESSION";
  preconditionStartedMonth?: number;
  preconditionDurationMonths?: number;
}
export type DiplomacyTriggerContext =
  | { reason: "WAR_EXHAUSTION_TRUCE"; recentBilateralCaptureCount: number; stabilityA: number; stabilityB: number }
  | { reason: "COMMON_THREAT_NON_AGGRESSION"; commonThreatFactionId: string; territoryShareA: number; territoryShareB: number; threatTerritoryShare: number; priorStatus?: "TRUCE" | "NON_AGGRESSION"; priorDurationMonths?: number }
  | { reason: "COMMON_THREAT_ALLIANCE"; commonThreatFactionId: string; territoryShareA: number; territoryShareB: number; threatTerritoryShare: number; priorStatus: "NON_AGGRESSION"; priorDurationMonths: number };
export const DIPLOMACY_EVALUATION_INTERVAL_MONTHS = 12;
export const DIPLOMACY_RECENT_WAR_MONTHS = 36;
export const DIPLOMACY_TRUCE_DURATION_MONTHS = 36;
export const DIPLOMACY_NON_AGGRESSION_DURATION_MONTHS = 96;
export const DIPLOMACY_WAR_PRESSURE_STABILITY = 58;
export const DIPLOMACY_WEAK_TERRITORY_SHARE = 18;
export const DIPLOMACY_COMMON_THREAT_RATIO = 2.5;
export const DIPLOMACY_MAX_ACTIVE_RELATIONS_PER_FACTION = 2;
export const DIPLOMACY_MAX_NEW_RELATIONS_PER_EVALUATION = 2;

export function normalizeFactionPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
export function diplomaticPairKey(a: string, b: string) {
  return normalizeFactionPair(a, b).join("\u0000");
}

export function isHostileActionAllowed(
  registry: DiplomacyRegistry,
  attackerFactionId: string,
  defenderFactionId: string,
  worldMonth: number,
  kind: "HOSTILE_OCCUPATION" | "SIEGE_CONTACT"
) {
  const allowed = registry.canAttack(attackerFactionId, defenderFactionId, worldMonth);
  if (!allowed) registry.noteBlocked(kind);
  return allowed;
}

export class DiplomacyRegistry {
  private relations = new Map<string, DiplomaticRelation>();
  private blockedHostileOccupationCount = 0;
  private blockedSiegeContactCount = 0;
  lastEvaluationMonth = -1;

  reset() {
    this.relations.clear();
    this.lastEvaluationMonth = -1;
    this.blockedHostileOccupationCount = 0;
    this.blockedSiegeContactCount = 0;
  }
  get(a: string, b: string) { return this.relations.get(diplomaticPairKey(a, b)); }
  canAttack(attackerFactionId: string, defenderFactionId: string, worldMonth: number) {
    if (attackerFactionId === defenderFactionId) return false;
    const relation = this.get(attackerFactionId, defenderFactionId);
    return !relation || relation.expiresMonth <= worldMonth;
  }
  setRelation(relation: DiplomaticRelation) {
    const [factionAId, factionBId] = normalizeFactionPair(relation.factionAId, relation.factionBId);
    if (factionAId === factionBId) throw new Error("A faction cannot form a relation with itself");
    this.relations.set(diplomaticPairKey(factionAId, factionBId), { ...relation, factionAId, factionBId });
  }
  delete(a: string, b: string) { return this.relations.delete(diplomaticPairKey(a, b)); }
  removeFaction(factionId: string) {
    for (const relation of this.relations.values()) {
      if (relation.factionAId === factionId || relation.factionBId === factionId) {
        this.relations.delete(diplomaticPairKey(relation.factionAId, relation.factionBId));
      }
    }
  }
  list(worldMonth?: number) {
    return [...this.relations.values()]
      .filter((relation) => worldMonth === undefined || relation.expiresMonth > worldMonth)
      .sort((a, b) => a.factionAId.localeCompare(b.factionAId) || a.factionBId.localeCompare(b.factionBId));
  }
  noteBlocked(kind: "HOSTILE_OCCUPATION" | "SIEGE_CONTACT") {
    if (kind === "HOSTILE_OCCUPATION") this.blockedHostileOccupationCount += 1;
    else this.blockedSiegeContactCount += 1;
  }
  getDiagnostics(worldMonth: number) {
    return {
      activeRelations: this.list(worldMonth),
      blockedHostileOccupationCount: this.blockedHostileOccupationCount,
      blockedSiegeContactCount: this.blockedSiegeContactCount,
      lastEvaluationMonth: this.lastEvaluationMonth,
    };
  }
  exportState() {
    return { relations: this.list(), lastEvaluationMonth: this.lastEvaluationMonth };
  }
  importState(state: { relations: DiplomaticRelation[]; lastEvaluationMonth: number }) {
    this.reset();
    this.lastEvaluationMonth = state.lastEvaluationMonth;
    state.relations.forEach((relation) => this.setRelation(relation));
  }
}

export class DiplomacySystem {
  constructor(
    private readonly registry: DiplomacyRegistry,
    private readonly cities: () => City[],
    private readonly emit: (event: {type: "truce-signed" | "non-aggression-signed" | "alliance-signed" | "treaty-expired" | "alliance-expired"; month: number; relation: DiplomaticRelation; triggerContext?: DiplomacyTriggerContext}) => void,
    private readonly blockSize = 0,
  ) {}

  update(worldMonth: number, teams: Team[], totalCells: number, recentEvents = WorldHistory.getEventsBetween(Math.max(0, worldMonth - DIPLOMACY_RECENT_WAR_MONTHS), worldMonth)) {
    const expiredThisMonth = new Set<string>();
    for (const relation of this.registry.list()) {
      if (relation.expiresMonth <= worldMonth) {
        this.registry.delete(relation.factionAId, relation.factionBId);
        expiredThisMonth.add(diplomaticPairKey(relation.factionAId, relation.factionBId));
        this.emit({ type: relation.status === "ALLIANCE" ? "alliance-expired" : "treaty-expired", month: worldMonth, relation });
      }
    }
    if (worldMonth % DIPLOMACY_EVALUATION_INTERVAL_MONTHS !== 0 || this.registry.lastEvaluationMonth === worldMonth) return;
    this.registry.lastEvaluationMonth = worldMonth;
    if (worldMonth === 0) return;
    const active = teams.filter((team) => team.status === "ACTIVE" && !team.isDie).sort((a, b) => a.name.localeCompare(b.name));
    const metrics = calculateTerritoryMetrics(active, totalCells);
    const recentCaptures = recentEvents.filter((event) => event.type === "city-captured" && event.actorFactionId && event.targetFactionId);
    const stability = (team: Team) => team.cities.length
      ? team.cities.reduce((sum, city) => sum + city.loyalty, 0) / team.cities.length
      : 0;

    const shares = (team: Team) => getFactionTerritoryMetric(metrics, team.name).controlledTerritoryShare;
    const recentPairContact = (aId: string, bId: string) => recentEvents.some((event) => {
      if (event.type !== "city-captured" && event.type !== "capital-fallen") return false;
      const involved = new Set([...(event.factionIds ?? []), event.actorFactionId, event.targetFactionId].filter((id): id is string => Boolean(id)));
      return involved.has(aId) && involved.has(bId);
    });
    const adjacent = (a: Team, b: Team) => areFactionsTerritoriallyAdjacent(a, b, this.blockSize);
    const sharedThreat = (a: Team, b: Team, requireStrategicContact: boolean) => active
      .filter((candidate) => candidate !== a && candidate !== b)
      .map((threat) => ({ threat, share: shares(threat) }))
      .filter(({ share }) => share >= Math.max(shares(a), shares(b), 1) * DIPLOMACY_COMMON_THREAT_RATIO)
      .filter(({ threat }) => !requireStrategicContact ||
        ((adjacent(a, threat) || recentPairContact(a.name, threat.name)) &&
         (adjacent(b, threat) || recentPairContact(b.name, threat.name))))
      .sort((x, y) => y.share - x.share || x.threat.name.localeCompare(y.threat.name))[0];

    let formed = 0;
    for (let i = 0; i < active.length && formed < DIPLOMACY_MAX_NEW_RELATIONS_PER_EVALUATION; i += 1) {
      for (let j = i + 1; j < active.length && formed < DIPLOMACY_MAX_NEW_RELATIONS_PER_EVALUATION; j += 1) {
        const a = active[i];
        const b = active[j];
        if (expiredThisMonth.has(diplomaticPairKey(a.name, b.name))) continue;
        const existing = this.registry.get(a.name, b.name);
        if (existing && existing.expiresMonth > worldMonth) {
          const age = worldMonth - existing.startedMonth;
          if (existing.status === "TRUCE" && age >= ALLIANCE_MIN_TRUCE_MONTHS_BEFORE_NON_AGGRESSION) {
            const threat = sharedThreat(a, b, false);
            if (threat && shares(a) <= DIPLOMACY_WEAK_TERRITORY_SHARE && shares(b) <= DIPLOMACY_WEAK_TERRITORY_SHARE) {
              const context: DiplomacyTriggerContext = { reason: "COMMON_THREAT_NON_AGGRESSION", commonThreatFactionId: threat.threat.name, territoryShareA: shares(a), territoryShareB: shares(b), threatTerritoryShare: threat.share, priorStatus: "TRUCE", priorDurationMonths: age };
              this.form(a, b, "NON_AGGRESSION", context.reason, worldMonth, DIPLOMACY_NON_AGGRESSION_DURATION_MONTHS, context, { commonThreatFactionId: threat.threat.name, preconditionStatus: "TRUCE", preconditionStartedMonth: existing.startedMonth, preconditionDurationMonths: age });
              formed += 1;
              continue;
            }
          }
          if (existing.status === "NON_AGGRESSION" && age >= ALLIANCE_MIN_NON_AGGRESSION_MONTHS) {
            const threat = sharedThreat(a, b, true);
            const alreadyAllied = this.registry.list(worldMonth).some((relation) => relation.status === "ALLIANCE" && (relation.factionAId === a.name || relation.factionBId === a.name || relation.factionAId === b.name || relation.factionBId === b.name));
            if (threat && !alreadyAllied) {
              const context: DiplomacyTriggerContext = { reason: "COMMON_THREAT_ALLIANCE", commonThreatFactionId: threat.threat.name, territoryShareA: shares(a), territoryShareB: shares(b), threatTerritoryShare: threat.share, priorStatus: "NON_AGGRESSION", priorDurationMonths: age };
              this.form(a, b, "ALLIANCE", context.reason, worldMonth, ALLIANCE_DURATION_MONTHS, context, { commonThreatFactionId: threat.threat.name, preconditionStatus: "NON_AGGRESSION", preconditionStartedMonth: existing.startedMonth, preconditionDurationMonths: age });
              formed += 1;
            }
          }
          continue;
        }
        const activeRelations = this.registry.list(worldMonth);
        if ([a.name, b.name].some((id) => activeRelations.filter((relation) => relation.factionAId === id || relation.factionBId === id).length >= DIPLOMACY_MAX_ACTIVE_RELATIONS_PER_FACTION)) continue;
        const bilateralWar = recentCaptures.some((event) =>
          (event.actorFactionId === a.name && event.targetFactionId === b.name) ||
          (event.actorFactionId === b.name && event.targetFactionId === a.name));
        if (bilateralWar && (stability(a) <= DIPLOMACY_WAR_PRESSURE_STABILITY || stability(b) <= DIPLOMACY_WAR_PRESSURE_STABILITY)) {
          const bilateralCaptureCount = recentCaptures.filter((event) =>
            (event.actorFactionId === a.name && event.targetFactionId === b.name) ||
            (event.actorFactionId === b.name && event.targetFactionId === a.name)).length;
          this.form(a, b, "TRUCE", "WAR_EXHAUSTION_TRUCE", worldMonth, DIPLOMACY_TRUCE_DURATION_MONTHS, {
            reason: "WAR_EXHAUSTION_TRUCE", recentBilateralCaptureCount: bilateralCaptureCount,
            stabilityA: stability(a), stabilityB: stability(b),
          });
          formed += 1;
          continue;
        }
        const aShare = shares(a);
        const bShare = shares(b);
        if (aShare > DIPLOMACY_WEAK_TERRITORY_SHARE || bShare > DIPLOMACY_WEAK_TERRITORY_SHARE) continue;
        const threat = sharedThreat(a, b, false);
        if (threat) {
          this.form(a, b, "NON_AGGRESSION", "COMMON_THREAT_NON_AGGRESSION", worldMonth, DIPLOMACY_NON_AGGRESSION_DURATION_MONTHS, {
            reason: "COMMON_THREAT_NON_AGGRESSION", commonThreatFactionId: threat.threat.name,
            territoryShareA: aShare, territoryShareB: bShare,
            threatTerritoryShare: threat.share,
          }, { commonThreatFactionId: threat.threat.name });
          formed += 1;
        }
      }
    }
  }

  private form(a: Team, b: Team, status: DiplomaticRelation["status"], reason: DiplomaticReason, month: number, duration: number, triggerContext: DiplomacyTriggerContext, extra: Partial<DiplomaticRelation> = {}) {
    const [factionAId, factionBId] = normalizeFactionPair(a.name, b.name);
    const relation: DiplomaticRelation = { factionAId, factionBId, status, startedMonth: month, expiresMonth: month + duration, reason, ...extra };
    this.registry.setRelation(relation);
    this.cities().forEach((city) => city.clearSiegeContactBetween(factionAId, factionBId));
    this.emit({ type: status === "TRUCE" ? "truce-signed" : status === "ALLIANCE" ? "alliance-signed" : "non-aggression-signed", month, relation, triggerContext });
  }
}

const Diplomacy = new DiplomacyRegistry();
export default Diplomacy;
