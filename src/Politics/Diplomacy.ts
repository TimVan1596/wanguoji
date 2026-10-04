import type Team from "../Components/Team";
import type City from "../Components/City";
import WorldHistory from "../History/WorldHistory";
import { calculateTerritoryMetrics, getFactionTerritoryMetric } from "../Simulation/TerritoryMetrics";

export type DiplomaticStatus = "NEUTRAL" | "TRUCE" | "NON_AGGRESSION";
export type DiplomaticReason = "WAR_EXHAUSTION_TRUCE" | "COMMON_THREAT_NON_AGGRESSION";
export interface DiplomaticRelation {
  factionAId: string;
  factionBId: string;
  status: Exclude<DiplomaticStatus, "NEUTRAL">;
  startedMonth: number;
  expiresMonth: number;
  reason: DiplomaticReason;
}
export const DIPLOMACY_EVALUATION_INTERVAL_MONTHS = 12;
export const DIPLOMACY_RECENT_WAR_MONTHS = 36;
export const DIPLOMACY_TRUCE_DURATION_MONTHS = 24;
export const DIPLOMACY_NON_AGGRESSION_DURATION_MONTHS = 60;
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
  constructor(private readonly registry: DiplomacyRegistry, private readonly cities: () => City[], private readonly emit: (event: {type: "truce-signed" | "non-aggression-signed" | "treaty-expired"; month: number; relation: DiplomaticRelation}) => void) {}

  update(worldMonth: number, teams: Team[], totalCells: number, recentEvents = WorldHistory.getEventsBetween(Math.max(0, worldMonth - DIPLOMACY_RECENT_WAR_MONTHS), worldMonth)) {
    const expiredThisMonth = new Set<string>();
    for (const relation of this.registry.list()) {
      if (relation.expiresMonth <= worldMonth) {
        this.registry.delete(relation.factionAId, relation.factionBId);
        expiredThisMonth.add(diplomaticPairKey(relation.factionAId, relation.factionBId));
        this.emit({ type: "treaty-expired", month: worldMonth, relation });
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

    let formed = 0;
    for (let i = 0; i < active.length && formed < DIPLOMACY_MAX_NEW_RELATIONS_PER_EVALUATION; i += 1) {
      for (let j = i + 1; j < active.length && formed < DIPLOMACY_MAX_NEW_RELATIONS_PER_EVALUATION; j += 1) {
        const a = active[i];
        const b = active[j];
        if (expiredThisMonth.has(diplomaticPairKey(a.name, b.name))) continue;
        const existing = this.registry.get(a.name, b.name);
        if (existing && existing.expiresMonth > worldMonth) continue;
        const activeRelations = this.registry.list(worldMonth);
        if ([a.name, b.name].some((id) => activeRelations.filter((relation) => relation.factionAId === id || relation.factionBId === id).length >= DIPLOMACY_MAX_ACTIVE_RELATIONS_PER_FACTION)) continue;
        const bilateralWar = recentCaptures.some((event) =>
          (event.actorFactionId === a.name && event.targetFactionId === b.name) ||
          (event.actorFactionId === b.name && event.targetFactionId === a.name));
        if (bilateralWar && (stability(a) <= DIPLOMACY_WAR_PRESSURE_STABILITY || stability(b) <= DIPLOMACY_WAR_PRESSURE_STABILITY)) {
          this.form(a, b, "TRUCE", "WAR_EXHAUSTION_TRUCE", worldMonth, DIPLOMACY_TRUCE_DURATION_MONTHS);
          formed += 1;
          continue;
        }
        const aShare = getFactionTerritoryMetric(metrics, a.name).controlledTerritoryShare;
        const bShare = getFactionTerritoryMetric(metrics, b.name).controlledTerritoryShare;
        if (aShare > DIPLOMACY_WEAK_TERRITORY_SHARE || bShare > DIPLOMACY_WEAK_TERRITORY_SHARE) continue;
        const threat = active.find((candidate) => candidate !== a && candidate !== b &&
          getFactionTerritoryMetric(metrics, candidate.name).controlledTerritoryShare >= Math.max(aShare, bShare, 1) * DIPLOMACY_COMMON_THREAT_RATIO);
        if (threat) {
          this.form(a, b, "NON_AGGRESSION", "COMMON_THREAT_NON_AGGRESSION", worldMonth, DIPLOMACY_NON_AGGRESSION_DURATION_MONTHS);
          formed += 1;
        }
      }
    }
  }

  private form(a: Team, b: Team, status: DiplomaticRelation["status"], reason: DiplomaticReason, month: number, duration: number) {
    const [factionAId, factionBId] = normalizeFactionPair(a.name, b.name);
    const relation = { factionAId, factionBId, status, startedMonth: month, expiresMonth: month + duration, reason };
    this.registry.setRelation(relation);
    this.cities().forEach((city) => city.clearSiegeContactBetween(factionAId, factionBId));
    this.emit({ type: status === "TRUCE" ? "truce-signed" : "non-aggression-signed", month, relation });
  }
}

const Diplomacy = new DiplomacyRegistry();
export default Diplomacy;
