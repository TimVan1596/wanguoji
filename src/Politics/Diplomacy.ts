import type Team from "../Components/Team";
import type City from "../Components/City";
import WorldHistory from "../History/WorldHistory";
import { calculateTerritoryMetrics, getFactionTerritoryMetric } from "../Simulation/TerritoryMetrics";
import { areFactionsTerritoriallyAdjacent, ALLIANCE_MIN_TRUCE_MONTHS_BEFORE_NON_AGGRESSION } from "./StrategicUnionRules";

import { evaluateCommonThreatCredibility, getDiplomaticDuration, getDiplomaticCooldown, canUpgradeToAlliance, type CommonThreatFacts, type ThreatCredibility } from "./DiplomaticRules";
import { DiplomacyObservations } from "./DiplomacyObservations";

const observationEnabled = import.meta.env.DEV || import.meta.env.MODE === "desktop-debug";
export type DiplomaticStatus = "NEUTRAL" | "TRUCE" | "NON_AGGRESSION" | "ALLIANCE";
export type DiplomaticReason = "WAR_EXHAUSTION_TRUCE" | "COMMON_THREAT_NON_AGGRESSION" | "COMMON_THREAT_ALLIANCE";
export interface DiplomaticRelation {
  factionAId: string;
  factionBId: string;
  status: Exclude<DiplomaticStatus, "NEUTRAL">;
  originalStartedMonth: number;
  renewalCount: number;
  lastRenewedMonth?: number;
  startedMonth: number;
  expiresMonth: number;
  reason: DiplomaticReason;
  commonThreatFactionId?: string;
  preconditionStatus?: "TRUCE" | "NON_AGGRESSION";
  preconditionStartedMonth?: number;
  preconditionDurationMonths?: number;
}
export interface DiplomaticPairMemory { factionAId: string; factionBId: string; lastStatus: DiplomaticRelation["status"]; endedMonth: number; lastReason: DiplomaticReason; commonThreatFactionId?: string; cooldownUntilMonth: number }
export type DiplomacyState = { relations: DiplomaticRelation[]; pairMemories: DiplomaticPairMemory[]; lastEvaluationMonth: number };
export interface DiplomacyLifecycleEvidence { credibility?: ThreatCredibility; directA?: boolean; directB?: boolean; adjacentPair?: boolean; capturedA?: boolean; capturedB?: boolean; capitalFall?: boolean; previousExpiresMonth?: number; renewalDuration?: number }
export type DiplomacyTriggerContext = DiplomacyLifecycleEvidence & (
  | { reason: "WAR_EXHAUSTION_TRUCE"; recentBilateralCaptureCount: number; stabilityA: number; stabilityB: number }
  | { reason: "COMMON_THREAT_NON_AGGRESSION"; commonThreatFactionId: string; territoryShareA: number; territoryShareB: number; threatTerritoryShare: number; priorStatus?: "TRUCE" | "NON_AGGRESSION"; priorDurationMonths?: number }
  | { reason: "COMMON_THREAT_ALLIANCE"; commonThreatFactionId: string; territoryShareA: number; territoryShareB: number; threatTerritoryShare: number; priorStatus: "NON_AGGRESSION"; priorDurationMonths: number });
export const DIPLOMACY_EVALUATION_INTERVAL_MONTHS = 12;
export const DIPLOMACY_RECENT_WAR_MONTHS = 36;
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
  private memories = new Map<string, DiplomaticPairMemory>();
  private observations?: DiplomacyObservations;
  private activeFactionIds: string[] = [];
  constructor(readonly debugEnabled = observationEnabled) { this.reset(); }
  observe(month: number, kind: string, extra: Record<string, unknown> = {}) { this.observations?.record({ month, kind, ...extra }); }
  setActiveFactions(ids: string[]) { if(this.debugEnabled) this.activeFactionIds = ids; }
  memory(a: string,b: string) { return this.memories.get(diplomaticPairKey(a,b)); }
  inCooldown(a: string,b: string,month: number) { return (this.memory(a,b)?.cooldownUntilMonth ?? -1) > month; }
  expire(relation: DiplomaticRelation, month: number) {
    this.delete(relation.factionAId, relation.factionBId);
    this.memories.set(diplomaticPairKey(relation.factionAId, relation.factionBId), { factionAId: relation.factionAId, factionBId: relation.factionBId, lastStatus: relation.status, endedMonth: month, lastReason: relation.reason, commonThreatFactionId: relation.commonThreatFactionId, cooldownUntilMonth: month + getDiplomaticCooldown(relation.status, relation.expiresMonth - relation.startedMonth) });
    this.observe(month,"expired",{ continuousDuration: month - relation.originalStartedMonth });
  }
  private blockedHostileOccupationCount = 0;
  private blockedSiegeContactCount = 0;
  lastEvaluationMonth = -1;

  reset() {
    this.relations.clear();
    this.memories.clear();
    this.observations = this.debugEnabled ? new DiplomacyObservations() : undefined;
    this.activeFactionIds = [];
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
  setRelation(relation: Omit<DiplomaticRelation, "originalStartedMonth" | "renewalCount"> & Partial<Pick<DiplomaticRelation, "originalStartedMonth" | "renewalCount">>) {
    const [factionAId, factionBId] = normalizeFactionPair(relation.factionAId, relation.factionBId);
    if (factionAId === factionBId) throw new Error("A faction cannot form a relation with itself");
    this.relations.set(diplomaticPairKey(factionAId, factionBId), { ...relation, originalStartedMonth: relation.originalStartedMonth ?? relation.startedMonth, renewalCount: relation.renewalCount ?? 0, factionAId, factionBId });
  }
  delete(a: string, b: string) { return this.relations.delete(diplomaticPairKey(a, b)); }
  removeFaction(factionId: string) {
    for (const [key, memory] of this.memories) if(memory.factionAId === factionId || memory.factionBId === factionId) this.memories.delete(key);
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
    const activeRelations = this.list(worldMonth);
    const counts = this.activeFactionIds.map(id => activeRelations.filter(r=>r.factionAId === id || r.factionBId === id).length);
    const durations = activeRelations.map(r=>worldMonth - r.originalStartedMonth);
    const observation = this.observations?.snapshot(worldMonth);
    const effectiveDuration = (stats: Record<string, number | undefined>): Record<string, number | undefined> => {
      const count=(stats.completedContinuousCount ?? 0)+durations.length;
      return {...stats, meanEffectiveContinuousDuration: count ? ((stats.completedContinuousDurationSum ?? 0)+durations.reduce((a,b)=>a+b,0))/count : 0,
        longestContinuousRelation: Math.max(stats.longestCompletedContinuousRelation ?? 0,...durations)};
    };
    return {
      diplomacyII: observation ? {...observation, sessionCumulative:effectiveDuration(observation.sessionCumulative), recent100Years:effectiveDuration(observation.recent100Years)} : undefined,
      activeRelationCount: activeRelations.length,
      activeRelationDensity: counts.length > 1 ? activeRelations.length / (counts.length * (counts.length - 1) / 2) : 0,
      factionsWith0Relations: counts.filter(n=>n===0).length, factionsWith1Relation: counts.filter(n=>n===1).length, factionsWith2Relations: counts.filter(n=>n===2).length,
      activeAllianceCount: activeRelations.filter(r=>r.status === "ALLIANCE").length,
      meanEffectiveContinuousDuration: durations.length ? durations.reduce((a,b)=>a+b,0)/durations.length : 0,
      longestContinuousRelation: durations.length ? Math.max(...durations) : 0,
      pairMemoryCount: this.memories.size,
      activeRelations,
      blockedHostileOccupationCount: this.blockedHostileOccupationCount,
      blockedSiegeContactCount: this.blockedSiegeContactCount,
      lastEvaluationMonth: this.lastEvaluationMonth,
    };
  }
  exportState() {
    return { relations: this.list().map(r=>({...r})), pairMemories: [...this.memories.values()].sort((a,b)=>diplomaticPairKey(a.factionAId,a.factionBId).localeCompare(diplomaticPairKey(b.factionAId,b.factionBId))).map(m=>({...m})), lastEvaluationMonth: this.lastEvaluationMonth };
  }
  importState(state: DiplomacyState) {
    this.reset();
    this.lastEvaluationMonth = state.lastEvaluationMonth;
    state.relations.forEach((relation) => this.setRelation(relation));
    state.pairMemories.forEach(m => this.memories.set(diplomaticPairKey(m.factionAId,m.factionBId),{...m}));
  }
}

export type DiplomacyEmission = { type: "truce-signed" | "non-aggression-signed" | "alliance-signed" | "treaty-expired" | "alliance-expired" | "relation-renewed"; month: number; relation: DiplomaticRelation; triggerContext?: DiplomacyTriggerContext };
export class DiplomacySystem {
  constructor(private readonly registry: DiplomacyRegistry, private readonly cities: () => City[], private readonly emit: (event: DiplomacyEmission) => void, private readonly blockSize = 0) {}
  update(worldMonth: number, teams: Team[], totalCells: number, recentEvents = WorldHistory.getEventsBetween(Math.max(0, worldMonth - DIPLOMACY_RECENT_WAR_MONTHS), worldMonth)) {
    for(const relation of this.registry.list()) if(relation.expiresMonth <= worldMonth) {
      this.registry.expire(relation,worldMonth);
      this.emit({type: relation.status === "ALLIANCE" ? "alliance-expired" : "treaty-expired",month:worldMonth,relation});
    }
    if(worldMonth === 0 || worldMonth % DIPLOMACY_EVALUATION_INTERVAL_MONTHS !== 0 || this.registry.lastEvaluationMonth === worldMonth) return;
    this.registry.lastEvaluationMonth = worldMonth;
    const active = teams.filter(t=>t.status === "ACTIVE" && !t.isDie).sort((a,b)=>a.name.localeCompare(b.name));
    this.registry.setActiveFactions(active.map(t=>t.name));
    const metrics = calculateTerritoryMetrics(active,totalCells);
    const share = (t: Team) => getFactionTerritoryMetric(metrics,t.name).controlledTerritoryShare;
    const stability = (t: Team) => t.cities.length ? t.cities.reduce((sum,c)=>sum+c.loyalty,0)/t.cities.length : 0;
    const adjacent = (a: Team,b: Team) => areFactionsTerritoriallyAdjacent(a,b,this.blockSize);
    const contact = (a: string,b: string) => recentEvents.filter(e => (e.type === "city-captured" || e.type === "capital-fallen") &&
      ((e.actorFactionId === a && e.targetFactionId === b) || (e.actorFactionId === b && e.targetFactionId === a)));
    const threatFor = (a: Team,b: Team,prior?: DiplomaticRelation) => {
      const candidates = active.filter(t=>t!==a && t!==b).map(t=>{
        const ca = contact(a.name,t.name), cb = contact(b.name,t.name);
        const facts: CommonThreatFacts = { territoryShareA:share(a),territoryShareB:share(b),threatTerritoryShare:share(t),
          directA:adjacent(a,t)||ca.length>0,directB:adjacent(b,t)||cb.length>0,adjacentPair:adjacent(a,b),priorRelationMonths:prior ? worldMonth - prior.originalStartedMonth : 0,
          capturedA:ca.some(e=>e.type === "city-captured" && e.actorFactionId===t.name),capturedB:cb.some(e=>e.type === "city-captured" && e.actorFactionId===t.name),
          capitalFall:[...ca,...cb].some(e=>e.type === "capital-fallen" && e.actorFactionId===t.name) };
        return {t,facts,credibility:evaluateCommonThreatCredibility(facts)};
      }).filter(c=>c.credibility !== "NONE");
      for(const c of candidates) { this.registry.observe(worldMonth,"commonThreatCandidates"); this.registry.observe(worldMonth,c.credibility === "SEVERE" ? "severeThreat" : c.credibility === "CREDIBLE" ? "credibleThreat" : "weakThreat"); }
      return candidates.sort((x,y)=> ({SEVERE:3,CREDIBLE:2,WEAK:1,NONE:0}[y.credibility]-{SEVERE:3,CREDIBLE:2,WEAK:1,NONE:0}[x.credibility]) || y.facts.threatTerritoryShare-x.facts.threatTerritoryShare || x.t.name.localeCompare(y.t.name))[0];
    };
    const block = (a: Team,b: Team,reason: string) => { this.registry.observe(worldMonth,"blocker",{factionAId:a.name,factionBId:b.name,reason}); if(reason === "COOLDOWN") this.registry.observe(worldMonth,"cooldownBlocked"); if(reason === "NO_STRATEGIC_CONTACT") this.registry.observe(worldMonth,"noStrategicContactBlocked"); };
    const warContext = (a: Team,b: Team): DiplomacyTriggerContext | undefined => {
      const pairEvents = contact(a.name,b.name);
      const captures = pairEvents.filter(e=>e.type === "city-captured").length;
      if(!captures || Math.min(stability(a),stability(b)) > DIPLOMACY_WAR_PRESSURE_STABILITY) return undefined;
      return { reason:"WAR_EXHAUSTION_TRUCE", recentBilateralCaptureCount:captures, stabilityA:stability(a),stabilityB:stability(b),capitalFall:pairEvents.some(e=>e.type === "capital-fallen") };
    };
    const threatContext = (a: Team,b: Team,status: "NON_AGGRESSION" | "ALLIANCE",prior?: DiplomaticRelation): DiplomacyTriggerContext | undefined => {
      const threat = threatFor(a,b,prior);
      if(!threat || threat.credibility === "WEAK") { block(a,b,threat ? "NO_STRATEGIC_CONTACT" : "NO_CREDIBLE_COMMON_THREAT"); return undefined; }
      if(status === "NON_AGGRESSION" && (share(a)>DIPLOMACY_WEAK_TERRITORY_SHARE || share(b)>DIPLOMACY_WEAK_TERRITORY_SHARE)) { block(a,b,"NO_CREDIBLE_COMMON_THREAT"); return undefined; }
      if(status === "ALLIANCE" && (!prior || (prior.status !== "ALLIANCE" && !canUpgradeToAlliance(threat.credibility,worldMonth-prior.startedMonth)))) { block(a,b,"PRECONDITION_TOO_SHORT"); return undefined; }
      if(status === "ALLIANCE" && prior?.status === "NON_AGGRESSION" && threat.credibility === "CREDIBLE" && prior.commonThreatFactionId !== threat.t.name) { block(a,b,"PRECONDITION_TOO_SHORT"); return undefined; }
      const facts = { ...threat.facts,credibility:threat.credibility,commonThreatFactionId:threat.t.name,priorDurationMonths:prior ? worldMonth-prior.startedMonth : 0 };
      return status === "ALLIANCE" ? { ...facts,reason:"COMMON_THREAT_ALLIANCE",priorStatus:"NON_AGGRESSION" } : { ...facts,reason:"COMMON_THREAT_NON_AGGRESSION",priorStatus:prior?.status === "TRUCE" ? "TRUCE" : prior?.status === "NON_AGGRESSION" ? "NON_AGGRESSION" : undefined,priorDurationMonths:prior ? worldMonth-prior.startedMonth : undefined };
    };
    let formed=0;
    for(let i=0;i<active.length && formed<DIPLOMACY_MAX_NEW_RELATIONS_PER_EVALUATION;i++) for(let j=i+1;j<active.length && formed<DIPLOMACY_MAX_NEW_RELATIONS_PER_EVALUATION;j++) {
      const a=active[i],b=active[j],prior=this.registry.get(a.name,b.name);
      if(prior) {
        const age=worldMonth-prior.startedMonth;
        if(prior.status === "ALLIANCE") continue;
        if(age<ALLIANCE_MIN_TRUCE_MONTHS_BEFORE_NON_AGGRESSION) { block(a,b,"PRECONDITION_TOO_SHORT"); continue; }
        const status=prior.status === "TRUCE" ? "NON_AGGRESSION" : "ALLIANCE";
        if(status === "ALLIANCE" && this.registry.list(worldMonth).some(r=>r.status === "ALLIANCE" && [r.factionAId,r.factionBId].some(id=>id===a.name||id===b.name))) { block(a,b,"ALLIANCE_CAP"); continue; }
        const context=threatContext(a,b,status,prior);
        if(context) { this.form(a,b,status,worldMonth,context,prior); formed++; }
        continue;
      }
      if(this.registry.inCooldown(a.name,b.name,worldMonth)) { block(a,b,"COOLDOWN"); continue; }
      if([a.name,b.name].some(id=>this.registry.list(worldMonth).filter(r=>r.factionAId===id||r.factionBId===id).length>=DIPLOMACY_MAX_ACTIVE_RELATIONS_PER_FACTION)) { block(a,b,"RELATION_CAP"); continue; }
      const context=warContext(a,b) ?? threatContext(a,b,"NON_AGGRESSION");
      if(context) { this.form(a,b,context.reason === "WAR_EXHAUSTION_TRUCE" ? "TRUCE" : "NON_AGGRESSION",worldMonth,context); formed++; }
    }
    // Renewal is independent of the new formation cap, and retains the status/chain start.
    for(const relation of this.registry.list(worldMonth)) {
      if(relation.expiresMonth-worldMonth>12) continue;
      const a=active.find(t=>t.name===relation.factionAId), b=active.find(t=>t.name===relation.factionBId);
      if(!a||!b) continue;
      const context = relation.status === "TRUCE" ? warContext(a,b) : threatContext(a,b,relation.status,relation);
      if(!context) { block(a,b,"THREAT_NO_LONGER_RELEVANT"); continue; }
      const duration=getDiplomaticDuration(relation.status,context);
      const renewed={...relation,lastRenewedMonth:worldMonth,renewalCount:relation.renewalCount+1,expiresMonth:relation.expiresMonth+duration,commonThreatFactionId:"commonThreatFactionId" in context ? context.commonThreatFactionId : undefined};
      this.registry.setRelation(renewed);
      this.registry.observe(worldMonth,"renewal",{...renewed,evidence:context});
      this.registry.observe(worldMonth,relation.status === "TRUCE" ? "truceRenewed" : relation.status === "ALLIANCE" ? "allianceRenewed" : "napRenewed");
      this.emit({type:"relation-renewed",month:worldMonth,relation:renewed,triggerContext:{...context,previousExpiresMonth:relation.expiresMonth,renewalDuration:duration}});
    }

  }
  private form(a: Team,b: Team,status: DiplomaticRelation["status"],month: number,context: DiplomacyTriggerContext,prior?: DiplomaticRelation) {
    const [factionAId,factionBId]=normalizeFactionPair(a.name,b.name);
    const duration=getDiplomaticDuration(status,context);
    const relation: DiplomaticRelation={factionAId,factionBId,status,reason:context.reason,startedMonth:month,originalStartedMonth:prior?.originalStartedMonth ?? month,renewalCount:prior?.renewalCount ?? 0,lastRenewedMonth:prior?.lastRenewedMonth,expiresMonth:month+duration,
      commonThreatFactionId:"commonThreatFactionId" in context ? context.commonThreatFactionId : undefined,
      preconditionStatus:prior?.status === "TRUCE" || prior?.status === "NON_AGGRESSION" ? prior.status : undefined,preconditionStartedMonth:prior?.startedMonth,preconditionDurationMonths:prior ? month-prior.startedMonth : undefined};
    const memory=this.registry.memory(a.name,b.name);
    this.registry.setRelation(relation);
    this.cities().forEach(c=>c.clearSiegeContactBetween(factionAId,factionBId));
    this.registry.observe(month,prior ? "upgrade" : "formation",{...relation,evidence:context,duration,gap:!prior && memory ? month-memory.endedMonth : undefined});
    if(prior) this.registry.observe(month,"upgrades");
    this.registry.observe(month,status === "TRUCE" ? "truceFormed" : status === "ALLIANCE" ? "allianceFormed" : "napFormed");
    if(!prior && memory) this.registry.observe(month,"reformedAfterCooldown");
    this.emit({type:status === "TRUCE" ? "truce-signed" : status === "ALLIANCE" ? "alliance-signed" : "non-aggression-signed",month,relation,triggerContext:context});
  }
}
const Diplomacy = new DiplomacyRegistry();
export default Diplomacy;
