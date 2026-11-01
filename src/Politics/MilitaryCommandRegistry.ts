import {createFamilyNobleContext,planFamilyNobleTransition,familyNobleText,familyResidenceAt,eligibleFamilyNobleHeirs} from './FamilyNobleSuccession';
import {emptyFamilyRecruitmentDiagnostics,familyRecruitmentExposure} from './FamilyRecruitmentDiagnostics';
import {familyFounderSource,makeMilitaryFamily,familyAppointmentWeight,type MilitaryFamily} from './MilitaryFamily';
import {politicalMutationActive,beginPoliticalMutation} from '../Simulation/PoliticalMutationScope';
import {unresolvedCourtBans,planCourtBan,militaryCourtText,type MilitaryCourtAct} from './MilitaryCourtStanding';
import {residentNaturalDeathMonth,ordinaryLifeEligible} from "../Simulation/ResidentLife";
import {appanageChanges,appanageText,OWNERSHIP_EVENTS,type MilitaryAppanage} from './MilitaryAppanage';
import {honorAuthority} from './MilitaryHonors';
import {currentNobleGrant} from './MilitaryNobility';
import {mayReceiveMilitaryHonor,nextMilitaryHonors,militaryHonorText,type MilitaryHonor} from './MilitaryHonors';
import {nextNobleGrant,nobleChronicle,type NobleGrant} from "./MilitaryNobility";
import type {Dynasty} from "./Dynasty";
import {isSiegePosition} from "../Simulation/SiegeParticipants";
import {nearbyMilitaryRecruits,type MilitaryRecruitmentContext} from "./MilitaryRecruitment";
import {deriveRoyalDepositionMilitary} from "./RoyalDepositionMilitary";
import type {Ruler} from "./Dynasty";
import {getOfficePromotion,MILITARY_OFFICE_NAMES,MILITARY_FORMATION_CAPACITY,type MilitaryOfficeGrant} from "./MilitaryOffice";
import { deriveMilitaryChronicle } from "./MilitaryChronicle";
import { deriveMilitaryLifeSchedule } from "./MilitaryLifeRules";
import { deriveNameCulture, generateMilitaryPersonalName } from "./NameCulture";
import { isPopulationIdentityLabel, getMilitaryPersonDisplayName } from "./MilitaryPersonIdentity";
import WorldHistory from "../History/WorldHistory";
import { deriveMilitaryCareer, selectMilitaryCandidate } from "./MilitaryCareerEvidence";
import { deriveMilitaryPoliticalInfluence, getMilitaryPoliticalEvents } from "./MilitaryPoliticalInfluence";
import type User from "../Components/User";
import type Team from "../Components/Team";
import type City from "../Components/City";
import type { LogicalUnitState } from "../Simulation/LogicalUnitState";
import Diplomacy from "./Diplomacy";
import worldRandom from "../Simulation/WorldRandom";
import type { WorldEvent } from "../History/WorldHistory";

export const MAX_COMMANDERS_PER_FACTION = 2;
export const MAX_FORMATIONS_PER_FACTION = 2;
export const MAX_FORMATION_UNITS = 4;
export const MIN_COMMANDER_AGE_MONTHS = 18 * 12;
export const ANNUAL_APPOINTMENT_CHANCE = 0.05;

export interface MilitaryAppointment {
  factionId: string;
  startMonth: number;
  endMonth?: number;
  endReason?: "DISMISSED" | "TRANSFERRED" | "FACTION_ENDED" | "DEATH" | "AGE_RETIREMENT";
  commandId: string;
  /** Required by V18 validation; historical source-only fixtures may omit it. */
  officeHistory?: MilitaryOfficeGrant[];
}

export interface RoyalMilitaryLink {
  rulerId: string;
  factionId: string;
  /** Frozen copy of the existing royal schedule, validated against its owner. Never sampled here. */
  naturalDeathMonth: number;
}
export interface RoyalMilitaryCandidate { rulerId: string; factionId: string }
export interface RoyalMilitaryService {
  calibration?:()=>import('./PoliticalCalibration').PoliticalCalibration;
  transaction?:<T>(team:Team,work:()=>T)=>T;
  nobleEpoch?(factionId:string,month:number):string|undefined;
  candidates(team: Team, month: number): RoyalMilitaryCandidate[];
  enlist(candidate: RoyalMilitaryCandidate, team: Team, month: number, members: User[]): boolean;
  eligible(user: User, month: number): boolean;
}
export interface MilitaryPerson {
  politicalHistory?:MilitaryCourtAct[];
  appanageHistory?:MilitaryAppanage[];
  nobilityHistory?:NobleGrant[];
  honorHistory?:MilitaryHonor[];
  royalIdentity?: RoyalMilitaryLink;
  /** Same person now holds a political office; the linked Ruler owns this one life. */
  politicalRulerId?:string;
  personId: string;
  sourceUserId: number;
  name: string;
  /** Authoritative personal identity; name above remains the original User label. */
  readonly personalName: string;
  bornMonth: number;
  factionId: string;
  status: "ACTIVE" | "RETIRED" | "DEAD";
  appointments: MilitaryAppointment[];
  deathMonth?: number;
  deathCause?: string;
  capturedEventIds: string[];
}

export interface MilitaryFormation {
  commandId: string;
  factionId: string;
  commanderPersonId: string;
  memberUnitIds: string[];
  createdMonth: number;
  status: "ACTIVE" | "DISBANDED";
  targetCityId?: string;
  orderStartMonth?: number;
  retreatUntilMonth?:number;
  captures: Array<{ eventId: string; cityId: string; month: number }>;
}

export interface MilitaryCommandState {
  families?: MilitaryFamily[];
  people: MilitaryPerson[];
  formations: MilitaryFormation[];
  personSequence: number;
  commandSequence: number;
  lastEvaluationMonth: number;
}

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** Deterministic adult birth date assigned when a simulated person first enters the world. */
export function deriveUserBornMonth(userId: number, name: string, factionId: string, spawnMonth: number) {
  const hash = stableHash(`${worldRandom.exportState().seed}\u0000${factionId}\u0000${userId}\u0000${name}\u0000${spawnMonth}`);
  const ageMonths = 18 * 12 + (hash % (43 * 12));
  const birthMonthOffset = (hash >>> 8) % 12;
  return spawnMonth - ageMonths - birthMonthOffset;
}

export class MilitaryCommandRegistryStore {
  private recruitmentContext?:()=>MilitaryRecruitmentContext|undefined;
  setRecruitmentContext(reader:()=>MilitaryRecruitmentContext|undefined){this.recruitmentContext=reader;}
  private royalService?: RoyalMilitaryService;
  setRoyalService(service: RoyalMilitaryService) { this.royalService = service; }
  private families:MilitaryFamily[]=[];
  private familyByResident?:Map<string,{family:MilitaryFamily;member:MilitaryFamily['members'][number]}>;
  observeFamilyPopulationCapacity(factionId:string,month:number){
    const epoch=this.royalService?.nobleEpoch?.(factionId,month);
    if(this.families.some(f=>f.factionId===factionId&&f.epochFounderId===epoch))this.diagnostics.familyPopulationBlocked++;
  }
  getFamilies(){return this.families;}
  commitFamilyMember(plan:{familyId:string;member:import('./MilitaryFamily').MilitaryFamilyMember}){const f=this.families.find(f=>f.familyId===plan.familyId);if(!f||this.families.some(f=>f.members.some(m=>m.sourceUserId===plan.member.sourceUserId)))throw Error('Duplicate family resident');f.members.push(structuredClone(plan.member));this.familyByResident=undefined;}
  getFamilyMember(userId:number,bornMonth:number){
    if(!this.familyByResident)this.familyByResident=new Map(this.families.flatMap(family=>family.members.map(member=>[`${member.sourceUserId}/${member.bornMonth}`,{family,member}] as const)));
    return this.familyByResident.get(`${userId}/${bornMonth}`);
  }
  private familyRecruitment=emptyFamilyRecruitmentDiagnostics();
  private people = new Map<string, MilitaryPerson>();
  private formations = new Map<string, MilitaryFormation>();
  private personSequence = 1;
  private commandSequence = 1;
  private lastEvaluationMonth = -1;
  private lastArrivalTargetByCommand = new Map<string, string>();
  private longRangeOrderSamples = new Map<string, number>();
  private eventWriter?: (event: Omit<WorldEvent, "id"> & { id: string }) => string;
  private eventReader: (factionId: string) => WorldEvent[] = factionId => WorldHistory.getEventsForFaction(factionId);
  private diagnostics = { familyLifeFailures:0,familyTitleIdentityRejected:0,familyTitleCandidateChecks:0,familyTitleRejectedCandidates:0,familyTitleFailures:0,familyAppointmentFailures:0,familyAgeBlocked:0,familyCapBlocked:0,familyIdentityBlocked:0,familyUnitBlocked:0,familyPopulationBlocked:0,familyCandidateChecks:0, provisionalChecks:0,provisionalNoCandidate:0,provisionalCapacityBlocked:0,provisionalDraws:0,provisionalMisses:0,provisionalAppointments:0,candidates: 0, eligible: 0, appointments: 0, capBlocked: 0, unitBlocked: 0, orders: 0, captures: 0, deaths: 0,
    unitsSteered: 0, commandedSiegeContacts: 0, targetCityArrivals: 0, invalidatedTargets: 0, staleOrderChecks: 0, ageRetirements: 0, naturalDeaths: 0, releasedFormations: 0, reappointments: 0, ageBlocked: 0, identityFailures: 0 };

  reset() {
    this.familyRecruitment=emptyFamilyRecruitmentDiagnostics();
    this.families=[];this.familyByResident=undefined;
    this.people.clear(); this.formations.clear(); this.personSequence = 1; this.commandSequence = 1;
    this.lastEvaluationMonth = -1;
    this.lastArrivalTargetByCommand.clear();
    this.longRangeOrderSamples.clear();
    this.diagnostics = { familyLifeFailures:0,familyTitleIdentityRejected:0,familyTitleCandidateChecks:0,familyTitleRejectedCandidates:0,familyTitleFailures:0,familyAppointmentFailures:0,familyAgeBlocked:0,familyCapBlocked:0,familyIdentityBlocked:0,familyUnitBlocked:0,familyPopulationBlocked:0,familyCandidateChecks:0, provisionalChecks:0,provisionalNoCandidate:0,provisionalCapacityBlocked:0,provisionalDraws:0,provisionalMisses:0,provisionalAppointments:0,candidates: 0, eligible: 0, appointments: 0, capBlocked: 0, unitBlocked: 0, orders: 0, captures: 0, deaths: 0,
      unitsSteered: 0, commandedSiegeContacts: 0, targetCityArrivals: 0, invalidatedTargets: 0, staleOrderChecks: 0, ageRetirements: 0, naturalDeaths: 0, releasedFormations: 0, reappointments: 0, ageBlocked: 0, identityFailures: 0 };
  }

  setEventWriter(writer: (event: Omit<WorldEvent, "id"> & { id: string }) => string,
    reader: (factionId: string) => WorldEvent[] = factionId => WorldHistory.getEventsForFaction(factionId)) {
    this.eventWriter = writer; this.eventReader = reader;
  }

  exportState(): MilitaryCommandState {
    return { ...(this.families.length?{families:structuredClone(this.families)}:{}), people: [...this.people.values()].map(person => structuredClone(person)),
      formations: [...this.formations.values()].map(formation => structuredClone(formation)),
      personSequence: this.personSequence, commandSequence: this.commandSequence, lastEvaluationMonth: this.lastEvaluationMonth };
  }

  importState(state: MilitaryCommandState) {
    this.familyRecruitment=emptyFamilyRecruitmentDiagnostics();
    this.families=structuredClone(state.families??[]);this.familyByResident=undefined;
    this.people = new Map(state.people.map(person => [person.personId, structuredClone(person)]));
    this.formations = new Map(state.formations.map(formation => [formation.commandId, structuredClone(formation)]));
    this.personSequence = state.personSequence; this.commandSequence = state.commandSequence;
    this.lastEvaluationMonth = state.lastEvaluationMonth;
    this.lastArrivalTargetByCommand.clear();
    this.longRangeOrderSamples.clear();
    this.diagnostics = { familyLifeFailures:0,familyTitleIdentityRejected:0,familyTitleCandidateChecks:0,familyTitleRejectedCandidates:0,familyTitleFailures:0,familyAppointmentFailures:0,familyAgeBlocked:0,familyCapBlocked:0,familyIdentityBlocked:0,familyUnitBlocked:0,familyPopulationBlocked:0,familyCandidateChecks:0, provisionalChecks:0,provisionalNoCandidate:0,provisionalCapacityBlocked:0,provisionalDraws:0,provisionalMisses:0,provisionalAppointments:0,candidates: 0, eligible: 0, appointments: 0, capBlocked: 0, unitBlocked: 0, orders: 0, captures: 0, deaths: 0,
      unitsSteered: 0, commandedSiegeContacts: 0, targetCityArrivals: 0, invalidatedTargets: 0, staleOrderChecks: 0, ageRetirements: 0, naturalDeaths: 0, releasedFormations: 0, reappointments: 0, ageBlocked: 0, identityFailures: 0 };
  }

  snapshotTransaction(){return {people:new Map(this.people),formations:new Map(this.formations),state:this.exportState(),familyRecruitment:structuredClone(this.familyRecruitment),diagnostics:{...this.diagnostics},arrivals:new Map(this.lastArrivalTargetByCommand),ranges:new Map(this.longRangeOrderSamples)};}
  rollbackTransaction(snapshot:ReturnType<MilitaryCommandRegistryStore["snapshotTransaction"]>,inPlace=false){
    this.familyByResident=undefined;
    if(inPlace){this.families=structuredClone(snapshot.state.families??[]);this.people=new Map(snapshot.state.people.map(data=>{const p=snapshot.people.get(data.personId)!;for(const k of Object.keys(p))delete (p as any)[k];Object.assign(p,structuredClone(data));return [p.personId,p];}));this.formations=new Map(snapshot.state.formations.map(data=>{const f=snapshot.formations.get(data.commandId)!;for(const k of Object.keys(f))delete (f as any)[k];Object.assign(f,structuredClone(data));return [f.commandId,f];}));this.personSequence=snapshot.state.personSequence;this.commandSequence=snapshot.state.commandSequence;this.lastEvaluationMonth=snapshot.state.lastEvaluationMonth;}
    else this.importState(snapshot.state);this.familyRecruitment=structuredClone(snapshot.familyRecruitment);this.diagnostics=snapshot.diagnostics;this.lastArrivalTargetByCommand=snapshot.arrivals;this.longRangeOrderSamples=snapshot.ranges;}
  mirrorPoliticalDeath(personId:string,rulerId:string,month:number,cause:string){
    const p=this.people.get(personId);if(!p||(p.politicalRulerId!==rulerId&&p.royalIdentity?.rulerId!==rulerId)||p.status==="DEAD")return;
    if(p.status==="ACTIVE")throw new Error("Political person still has military command");
    const link=this.getFamilyMember(p.sourceUserId,p.bornMonth);if(link){link.member.deathHistoryIndex=WorldHistory.getEventCount();link.member.deathMonth=month;link.member.deathCause=cause;}
    p.status="DEAD";p.deathMonth=month;p.deathCause=cause;this.diagnostics.deaths++;
    if(cause==="NATURAL_DEATH")this.diagnostics.naturalDeaths++;
    this.eventWriter?.({id:`military-person-death-${p.personId}-${month}`,year:month,monthIndex:month,type:"military-person-died",category:"politics",actorFactionId:p.factionId,factionIds:[p.factionId],title:`${p.personalName}去世`,metadata:{personId:p.personId,sourceUserId:p.sourceUserId,personalName:p.personalName,deathCause:cause,politicalRulerId:rulerId},importance:"normal"});
  }

  getCareer(person: MilitaryPerson, worldMonth: number) {
    const events = [...new Map([...new Set(person.appointments.map(a => a.factionId))].flatMap(id => this.eventReader(id)).map(e => [e.id, e])).values()];
    return deriveMilitaryCareer(person, this.getFormations(), events, worldMonth);
  }

  getChronicle(person: MilitaryPerson, worldMonth: number, factionId?: string) {
    const events = [...new Map([...new Set(person.appointments.map(a => a.factionId).concat(person.factionId))]
      .flatMap(id => this.eventReader(id)).map(e => [e.id, e])).values()];
    return deriveMilitaryChronicle(person, this.getFormations(), events, worldMonth, factionId);
  }

  private politicalUsers(team: Team, logicalRegistry?: Pick<import("../Simulation/LogicalUnitRegistry").default, "getEntry">) {
    return [...(team.users ?? [])].filter(user => user.role === "NORMAL" && user.team === team).map(user => {
      const unitId = user.player.logicalUnitId;
      const entry = unitId ? logicalRegistry?.getEntry(unitId) : undefined;
      const person = user.militaryPersonId ? this.people.get(user.militaryPersonId) : undefined;
      const liveBindingVerified = !user.isDestroyed && user.role === "NORMAL" && user.team === team && user.player.active &&
        user.player.user === user && user.player.team === team && user.player.role === "NORMAL" && !user.rulerId && !user.player.rulerId &&
        entry?.player === user.player && entry.state.alive && entry.state.userId === user.id && entry.state.factionId === team.name &&
        entry.state.unitId === unitId && entry.state.role === "NORMAL" && (!person || Boolean(user.matchesMilitaryLife?.(person)));
      return { userId: user.id, name: user.name, bornMonth: user.bornMonth, factionId: user.team.name,
        loyalty:user.loyalty, personId: user.militaryPersonId, unitId, liveBindingVerified: Boolean(liveBindingVerified) };
    });
  }

  getRoyalDepositionClaims(team: Team, worldMonth:number, rulers:readonly Ruler[], logicalRegistry?:Pick<import("../Simulation/LogicalUnitRegistry").default,"getEntry">){
    return deriveRoyalDepositionMilitary({factionId:team.name,month:worldMonth,rulers,people:this.getPeople(),formations:this.getFormations(),users:this.politicalUsers(team,logicalRegistry),events:this.eventReader(team.name),influence:this.getPoliticalInfluence(team,worldMonth,logicalRegistry,true)});
  }

  getPoliticalInfluence(team: Team, worldMonth: number, logicalRegistry?: Pick<import("../Simulation/LogicalUnitRegistry").default, "getEntry">, includeRoyal=false, nobleStanding=true,localSecession=false) {
    const people=this.getPeople(),users=this.politicalUsers(team,logicalRegistry);
    const relevantFactions = [...new Set(people.filter(p => p.factionId === team.name && p.status === "ACTIVE").flatMap(p => p.appointments.map(a => a.factionId)))];
    return deriveMilitaryPoliticalInfluence({ royalClaims:includeRoyal, localSecession,factionId: team.name, status: team.status, identityStage: team.identityStage, worldMonth, people:includeRoyal?people:people.filter(p=>!p.royalIdentity), formations: this.getFormations(), users,
      events: [...new Map(relevantFactions.flatMap(id => this.eventReader(id)).map(e => [e.id, e])).values()],nobleEpochFounderId:nobleStanding&&!includeRoyal?this.royalService?.nobleEpoch?.(team.name,worldMonth):undefined });
  }

  getCourtAttemptInfluence(team:Team,month:number,logicalRegistry?:Pick<import('../Simulation/LogicalUnitRegistry').default,'getEntry'>){
    return deriveMilitaryPoliticalInfluence({courtAttempt:true,royalClaims:true,factionId:team.name,status:team.status,identityStage:team.identityStage,worldMonth:month,people:this.getPeople(),formations:this.getFormations(),users:this.politicalUsers(team,logicalRegistry),events:this.eventReader(team.name)});
  }

  getOfficeSummary(worldMonth:number){
    const people=this.getPeople(),appointments=people.flatMap(p=>p.appointments),grants=appointments.flatMap(a=>a.officeHistory??[]);
    const count=(office:MilitaryOfficeGrant["office"])=>grants.filter(g=>g.office===office).length;
    const active=people.filter(p=>p.status==="ACTIVE").flatMap(p=>p.appointments.filter(a=>a.endMonth===undefined&&a.factionId===p.factionId));
    return {xiaowei:count("XIAOWEI"),pijiang:count("PIJIANG"),jiangjun:count("JIANGJUN"),shangjiangjun:count("SHANGJIANGJUN"),promotions:grants.filter(g=>g.office!=="XIAOWEI").length,
      meanServiceMonths:appointments.length?appointments.reduce((n,a)=>n+Math.max(0,(a.endMonth??worldMonth)-a.startMonth),0)/appointments.length:0,
      currentOffices:active.map(a=>a.officeHistory?.at(-1)?.office),naturalDeaths:people.filter(p=>p.deathCause==="NATURAL_DEATH").length,
      ageRetirements:appointments.filter(a=>a.endReason==="AGE_RETIREMENT").length,
      highOfficeMerits:grants.filter(g=>g.office==="SHANGJIANGJUN").map(g=>({serviceMonths:g.serviceMonths,verifiedMerits:g.captureEventIds.length})),
      activeFormationSizes:this.getFormations().filter(f=>f.status==="ACTIVE").map(f=>f.memberUnitIds.length)};
  }

  getPoliticalEvents(person: MilitaryPerson) {
    return getMilitaryPoliticalEvents([...new Map([...new Set(person.appointments.map(a => a.factionId))]
      .flatMap(id => this.eventReader(id)).map(e => [e.id, e])).values()], person.personId);
  }

  getOrderEvidence(formation: MilitaryFormation) {
    return this.eventReader(formation.factionId).find(e => e.type === "military-order-issued" &&
      e.metadata?.commandId === formation.commandId && e.cityId === formation.targetCityId && (e.monthIndex ?? e.year) === formation.orderStartMonth);
  }

  getPeople() { return [...this.people.values()]; }
  getFormations() { return [...this.formations.values()]; }
  getFormation(commandId: string) { return this.formations.get(commandId); }
  getFamilyAvailability(teams:readonly Team[],month:number){
    const users=new Map(teams.flatMap(t=>[...t.users]).map(u=>[`${u.id}/${u.bornMonth}`,u]));
    const descendants=this.families.flatMap(f=>f.members.filter(m=>m.generation>0).map(m=>({family:f,member:m}))),alive=descendants.filter(({member:m})=>m.deathMonth===undefined&&users.has(`${m.sourceUserId}/${m.bornMonth}`));
    const adult=alive.filter(({member:m})=>month-m.bornMonth>=MIN_COMMANDER_AGE_MONTHS),eligible=adult.filter(({member:m})=>this.isEligible(users.get(`${m.sourceUserId}/${m.bornMonth}`)!,month,false));
    return {scope:'CURRENT_MAP_SNAPSHOT',descendants:descendants.length,aliveOnMap:alive.length,adultOnMap:adult.length,individuallyEligible:eligible.length,eligibleWithVacancy:eligible.filter(({member:m})=>{const u=users.get(`${m.sourceUserId}/${m.bornMonth}`)!;return [...this.people.values()].filter(p=>p.status==='ACTIVE'&&p.factionId===u.team.name).length<MAX_COMMANDERS_PER_FACTION&&[...this.formations.values()].filter(f=>f.status==='ACTIVE'&&f.factionId===u.team.name).length<MAX_FORMATIONS_PER_FACTION;}).length};
  }
  getDiagnostics() { return { ...this.diagnostics,familyRecruitment:structuredClone(this.familyRecruitment), activeCommanders: [...this.people.values()].filter(p => p.status === "ACTIVE").length,
    activeFormations: [...this.formations.values()].filter(f => f.status === "ACTIVE").length }; }

  update(worldMonth: number, teams: Team[], cities: City[]) {
    const annual = worldMonth % 12 === 0 && worldMonth > this.lastEvaluationMonth;
    if (annual) {
      this.lastEvaluationMonth = worldMonth;
      this.advanceLifecycles(worldMonth, teams);
    }
    this.reconcile(worldMonth, teams);
    this.refreshOrders(worldMonth, teams, cities);
    this.observeLongRangeOrders(worldMonth, teams, cities);
    if (!annual) return;
    this.advanceOffices(worldMonth,teams);
    for (const team of teams) {
      if (team.status !== "ACTIVE") continue;
      const provisional=team.identityStage!=="STATE";if(provisional)this.diagnostics.provisionalChecks++;
      const epoch=this.royalService?.nobleEpoch?.(team.name,worldMonth);
      const familyEntrants=[...team.users].filter(u=>{const link=this.getFamilyMember(u.id,u.bornMonth);return !u.militaryPersonId&&link&&link.member.generation>0&&link.family.factionId===team.name&&link.family.epochFounderId===epoch;});
      let readyFamily=0;
      for(const u of familyEntrants){
        if(u.bornMonth>worldMonth-MIN_COMMANDER_AGE_MONTHS||worldMonth>=deriveMilitaryLifeSchedule({personId:`military-person-${this.personSequence}`,bornMonth:u.bornMonth}).retirementMonth)this.diagnostics.familyAgeBlocked++;
        else if(u.isDestroyed||u.role!=='NORMAL'||u.rulerId||u.historicalPersonId||u.player.rulerId||!u.player.active||!u.player.logicalUnitId)this.diagnostics.familyIdentityBlocked++;
        else if(this.isUnitAssigned(u.player.logicalUnitId))this.diagnostics.familyUnitBlocked++;
        else readyFamily++;
      }
      const activeCount = [...this.people.values()].filter(p => p.status === "ACTIVE" && p.factionId === team.name).length;
      const activeFormations = [...this.formations.values()].filter(f => f.status === "ACTIVE" && f.factionId === team.name).length;
      if (activeCount >= MAX_COMMANDERS_PER_FACTION || activeFormations >= MAX_FORMATIONS_PER_FACTION) { this.diagnostics.capBlocked++;this.diagnostics.familyCapBlocked+=readyFamily;if(provisional)this.diagnostics.provisionalCapacityBlocked++; continue; }
      const candidates = [...team.users].filter(user => this.isEligible(user, worldMonth)).sort((a, b) => a.id - b.id || a.name.localeCompare(b.name));
      this.diagnostics.candidates += candidates.length;
      const royals = this.royalService?.candidates(team, worldMonth) ?? [];
      if (!candidates.length && !royals.length) {if(provisional)this.diagnostics.provisionalNoCandidate++;continue;}
      const availableUnits = [...team.users].filter(user => user.player.logicalUnitId && user.role === "NORMAL" && !user.rulerId && !user.player.rulerId &&
        !this.isUnitAssigned(user.player.logicalUnitId) && user.team === team).sort((a, b) => a.id - b.id || a.name.localeCompare(b.name));
      if (!availableUnits.length && !royals.length) { this.diagnostics.unitBlocked++; continue; }
      this.diagnostics.eligible += candidates.length;
      this.diagnostics.familyCandidateChecks+=candidates.filter(u=>{const link=this.getFamilyMember(u.id,u.bornMonth);return familyAppointmentWeight(link?.family,link?.member,team.name,this.royalService?.nobleEpoch?.(team.name,worldMonth),worldMonth,this.royalService?.calibration?.())>1;}).length;
      const getWeights=()=>candidates.map(user=>{const p=user.militaryPersonId?this.people.get(user.militaryPersonId):undefined,l=this.getFamilyMember(user.id,user.bornMonth);return p?this.getCareer(p,worldMonth).appointmentWeight:familyAppointmentWeight(l?.family,l?.member,team.name,this.royalService?.nobleEpoch?.(team.name,worldMonth),worldMonth,this.royalService?.calibration?.());});
      const familyRows=candidates.filter(u=>u.familyMemberId&&!u.militaryPersonId),preparedWeights=familyRows.length?getWeights():undefined;
      const exposure=preparedWeights?familyRecruitmentExposure(candidates.map((u,i)=>({id:u.familyMemberId??'',family:!!u.familyMemberId&&!u.militaryPersonId,weight:preparedWeights[i]})),royals.length,ANNUAL_APPOINTMENT_CHANCE):undefined;
      if(exposure){const d=this.familyRecruitment;d.opportunities++;d.qualifiedPersonChecks+=familyRows.length;d.expectedAppointments+=exposure.expected;d.baselineExpectedAppointments+=exposure.baselineExpected;d.weightSum+=exposure.familyWeight;for(const u of familyRows)if(d.distinctCandidateIds.length<4096&&!d.distinctCandidateIds.includes(u.familyMemberId!))d.distinctCandidateIds.push(u.familyMemberId!);d.recent.unshift({month:worldMonth,factionId:team.name,...exposure});d.recent.length=Math.min(20,d.recent.length);}
      let selectedFamily=false;
      const attempt=()=>{
      if(provisional)this.diagnostics.provisionalDraws++;
      if (worldRandom.next() >= ANNUAL_APPOINTMENT_CHANCE) {if(provisional)this.diagnostics.provisionalMisses++;return;}
      const weights=preparedWeights??getWeights();
      if(exposure){this.familyRecruitment.poolDraws++;this.familyRecruitment.conditionalExpectedSelections+=exposure.conditional;}
      const selected = selectMilitaryCandidate([...candidates.map(user => ({user, royal: undefined as RoyalMilitaryCandidate | undefined})), ...royals.map(royal => ({user: undefined as User | undefined, royal}))], [...weights, ...royals.map(() => 1)], worldRandom.next());
      if (selected.royal) {
        if (this.royalService?.enlist(selected.royal, team, worldMonth, [])) this.diagnostics.appointments++;
        this.refreshOrders(worldMonth, teams, cities);
        return;
      }
      const candidate = selected.user!;
      selectedFamily=!!candidate.familyMemberId&&!candidate.militaryPersonId;if(selectedFamily)this.familyRecruitment.selected++;
      const members = [candidate, ...availableUnits.filter(user => user !== candidate)].slice(0, MILITARY_FORMATION_CAPACITY.XIAOWEI);
      if (members.length < 1 || !candidate.player.logicalUnitId) { this.diagnostics.unitBlocked++; return; }
      if (this.appoint(candidate, team.name, worldMonth, members.map(user => user.player.logicalUnitId!))) {this.diagnostics.appointments++;if(selectedFamily)this.familyRecruitment.appointments++;if(provisional)this.diagnostics.provisionalAppointments++;}
      this.refreshOrders(worldMonth, teams, cities);
      };
      if(candidates.some(u=>u.familyMemberId)){
        try{this.familyTransaction(team,attempt);}catch(error){this.diagnostics.familyAppointmentFailures++;this.familyRecruitment.executionFailures++;if(selectedFamily)this.familyRecruitment.rolledBackSelections++;console.warn('[MilitaryFamily] appointment opportunity rolled back',error);}
      }else attempt();
    }
  }

  private advanceLifecycles(worldMonth: number, teams: Team[]) {
    const bound = new Map<string, User[]>();
    for (const team of teams) for (const user of team.users) if (user.militaryPersonId) {
      const rows = bound.get(user.militaryPersonId) ?? []; rows.push(user); bound.set(user.militaryPersonId, rows);
    }
    for (const person of this.people.values()) {
      if (person.status === "DEAD" || person.politicalRulerId) continue;
      const life = deriveMilitaryLifeSchedule(person);
      if (worldMonth < life.retirementMonth) continue;
      // Retired records without a verifiable original User are historical unknowns.
      const matches = bound.get(person.personId) ?? [];
      const user = matches.length === 1 ? matches[0] : undefined;
      if (!user || !user.matchesMilitaryLife?.(person)) { this.diagnostics.identityFailures++; continue; }
      if (!person.royalIdentity && worldMonth >= life.naturalDeathMonth) {
        // destroyUser ends the appointment before removing population and runtime units.
        if (!user.destroyUser(false, { cause: "NATURAL_DEATH", month: worldMonth, context: "MILITARY_NATURAL_LIFESPAN", damageSource: "MILITARY_LIFESPAN" })) this.diagnostics.identityFailures++;
      } else if (person.status === "ACTIVE") {
        for (const formation of this.formations.values()) if (formation.commanderPersonId === person.personId && formation.status === "ACTIVE")
          this.endFormation(formation, worldMonth, "AGE_RETIREMENT");
      }
    }
  }

  private isEligible(user: User, worldMonth: number, recordDiagnostics=true) {
    const person = user.militaryPersonId ? this.people.get(user.militaryPersonId) : undefined;
    if(person?.politicalHistory?.length&&unresolvedCourtBans(person,user.team.name,worldMonth,this.royalService?.nobleEpoch?.(user.team.name,worldMonth)).length)return false;
    if (user.isDestroyed || person?.status === "DEAD" || (user.militaryPersonId && (!person || person.sourceUserId !== user.id || person.bornMonth !== user.bornMonth || person.name !== user.name || person.factionId !== user.team.name))) return false;
    if (worldMonth >= deriveMilitaryLifeSchedule(person ?? { personId: `military-person-${this.personSequence}`, bornMonth: user.bornMonth }).retirementMonth) {
      if(recordDiagnostics)this.diagnostics.ageBlocked++; return false;
    }
    return (!user.historicalPersonId || Boolean(this.royalService?.eligible(user, worldMonth))) && user.role === "NORMAL" && !user.rulerId && !user.player.rulerId && user.team.status === "ACTIVE" && user.bornMonth <= worldMonth - MIN_COMMANDER_AGE_MONTHS &&
      Boolean(user.player.active && user.player.logicalUnitId) && !this.isUnitAssigned(user.player.logicalUnitId!) &&
      (!user.militaryPersonId || this.people.get(user.militaryPersonId)?.status !== "ACTIVE");
  }

  appointRoyal(user: User, link: RoyalMilitaryLink, month: number, memberUnitIds: string[]) {
    if (!this.royalService?.eligible(user, month) || user.historicalPersonId !== `military-person-${this.personSequence}`) return false;
    if (!this.appoint(user, link.factionId, month, memberUnitIds, link)) return false;
    this.people.get(user.militaryPersonId!)!.royalIdentity = {...link};
    return true;
  }
  nextPersonId() { return `military-person-${this.personSequence}`; }
  endPersonCommands(personId: string, month: number, reason: MilitaryAppointment["endReason"], courtCoupEventId?:string) {
    for (const formation of this.formations.values()) if (formation.commanderPersonId === personId) this.endFormation(formation, month, reason, courtCoupEventId);
  }

  familyDeathTransaction(user:User,work:()=>boolean){try{return this.familyTransaction(user.team,work);}catch{this.diagnostics.familyLifeFailures++;return false;}}
  private familyTransaction<T>(team:Team,work:()=>T):T{
    if(politicalMutationActive())return work();
    if(!this.royalService?.transaction)throw Error('Missing canonical family transaction');
    return this.royalService.transaction(team,work);
  }
  private appoint(user: User, factionId: string, worldMonth: number, memberUnitIds: string[], royalIdentity?: RoyalMilitaryLink) {
    return user.familyMemberId?this.familyTransaction(user.team,()=>this.appointBody(user,factionId,worldMonth,memberUnitIds,royalIdentity)):this.appointBody(user,factionId,worldMonth,memberUnitIds,royalIdentity);
  }
  private appointBody(user: User, factionId: string, worldMonth: number, memberUnitIds: string[], royalIdentity?: RoyalMilitaryLink) {
    if(memberUnitIds.length!==MILITARY_FORMATION_CAPACITY.XIAOWEI||new Set(memberUnitIds).size!==memberUnitIds.length||!memberUnitIds.includes(user.player.logicalUnitId??"")||factionId!==user.team.name||
      memberUnitIds.some(id=>this.isUnitAssigned(id)||![...user.team.users].some(u=>u.team===user.team&&!u.isDestroyed&&u.role==="NORMAL"&&!u.rulerId&&!u.player.rulerId&&u.player.active&&u.player.logicalUnitId===id)))return false;
    let person = user.militaryPersonId ? this.people.get(user.militaryPersonId) : undefined;
    if (person?.status === "DEAD" || !this.isEligible(user, worldMonth)) return false;
    if (person?.status === "RETIRED") this.diagnostics.reappointments++;
    const personId = person?.personId ?? `military-person-${this.personSequence++}`;
    const commandId = `military-command-${this.commandSequence++}`;
    if (!person) {
      person = { ...(royalIdentity ? {royalIdentity:{...royalIdentity}} : {}), personId, sourceUserId: user.id, name: user.name, personalName: isPopulationIdentityLabel(user.name) && user.id >= 1000000000 && user.id <= 1999999999
          ? generateMilitaryPersonalName({ seed: worldRandom.exportState().seed, personId, sourceUserId: user.id,
              bornMonth: user.bornMonth, originalName: user.name, culture: deriveNameCulture(user.team.houseName) })
          : user.name, bornMonth: user.bornMonth, factionId,
        status: "ACTIVE", appointments: [], capturedEventIds: [] };
      this.people.set(personId, person);
      user.militaryPersonId = personId;
    }
    const familyLink=this.getFamilyMember(user.id,user.bornMonth),familyWeight=familyAppointmentWeight(familyLink?.family,familyLink?.member,factionId,this.royalService?.nobleEpoch?.(factionId,worldMonth),worldMonth,this.royalService?.calibration?.());
    if(familyLink){if(familyLink.member.name!==person.personalName)throw Error('Family military name mismatch');familyLink.member.militaryPersonId=person.personId;}
    person.factionId = factionId; person.status = "ACTIVE";
    person.appointments.push({ factionId, startMonth: worldMonth, commandId, officeHistory: [] });
    this.formations.set(commandId, { commandId, factionId, commanderPersonId: personId,
      memberUnitIds: [...new Set(memberUnitIds)], createdMonth: worldMonth, status: "ACTIVE", captures: [] });
    this.eventWriter?.({ id: `military-appointment-${commandId}`, year: worldMonth, monthIndex: worldMonth,
      category: "politics", type: "military-appointment", title: `${factionId}任命${getMilitaryPersonDisplayName(person)}为军事指挥者`,
      description: royalIdentity ? `${getMilitaryPersonDisplayName(person)}以原王室身份首次从军，建立一个真实人口单位，与${memberUnitIds.length-1}名既有部众组成军队。` : `${getMilitaryPersonDisplayName(person)}由既有人口任职，指挥${memberUnitIds.length}个现存单位。`, factionIds: [factionId], actorFactionId: factionId,
      metadata: { personId, sourceUserId: person.sourceUserId, personalName: person.personalName, commandId, unitCount: memberUnitIds.length, ...(familyLink?{familyId:familyLink.family.familyId,familyMemberId:familyLink.member.memberId,familyAppointmentWeight:familyWeight,politicalCalibration:this.royalService?.calibration?.()??'BASELINE'}:{}), ...(royalIdentity ? {royalRulerId:royalIdentity.rulerId,populationDelta:1} : {}) }, importance: "normal" });
    this.grantOffice(person,person.appointments.at(-1)!,{office:"XIAOWEI",month:worldMonth,serviceMonths:0,captureEventIds:[]});
    return true;
  }

  private grantOffice(person:MilitaryPerson,appointment:MilitaryAppointment,grant:Omit<MilitaryOfficeGrant,"eventId">){
    const previous=appointment.officeHistory?.at(-1),eventId=`military-office-${appointment.commandId}-${grant.office}`;
    const record={...grant,eventId};
    (appointment.officeHistory??=[]).push(record);
    this.eventWriter?.({id:eventId,year:grant.month,monthIndex:grant.month,category:"politics",type:"military-office-granted",
      title:`${appointment.factionId}${previous?"晋任":"授予"}${getMilitaryPersonDisplayName(person)}${MILITARY_OFFICE_NAMES[grant.office]}`,
      description:`据本次真实任职${grant.serviceMonths}个月及${grant.captureEventIds.length}条核验战果授职。`,actorFactionId:appointment.factionId,factionIds:[appointment.factionId],importance:"normal",
      metadata:{personId:person.personId,sourceUserId:person.sourceUserId,personalName:person.personalName,commandId:appointment.commandId,previousOffice:previous?.office??"NONE",office:grant.office,serviceMonths:grant.serviceMonths,captureEventIds:JSON.stringify(grant.captureEventIds),...(grant.promotionBasis?{promotionBasis:grant.promotionBasis,activityEventIds:JSON.stringify(grant.activityEventIds??[])}:{})}});
  }

  private eligibleNobleGrant(person:MilitaryPerson,month:number,team:Team,dy:Dynasty){
    const user=team.getUserById(person.sourceUserId);
    if(month>=deriveMilitaryLifeSchedule(person).retirementMonth||!user?.matchesMilitaryLife(person)||user.role!=="NORMAL"||user.rulerId||user.player.rulerId||!user.player.logicalUnitId)return;
    const binding=this.recruitmentContext?.()?.registry.getEntry(user.player.logicalUnitId),state=binding?.state;
    if(!binding||binding.player!==user.player||!state?.alive||state.userId!==user.id||state.unitId!==user.player.logicalUnitId||state.factionId!==team.name||state.role!=='NORMAL'||state.rulerId||user.player.user!==user||user.player.team!==team||!user.player.active||user.player.parent||user.player.children?.length)return;
    const active=this.getFormations().filter(f=>f.commanderPersonId===person.personId&&f.status==='ACTIVE');
    if(active.length!==1||!active[0].memberUnitIds.includes(user.player.logicalUnitId))return;
    return nextNobleGrant(person,this.getFormations(),this.eventReader(team.name),month,team,dy);
  }
  private recordNoble(person:MilitaryPerson,grant:NobleGrant,courtServiceEventId?:string,courtCoupEventId?:string){
    if(!this.eventWriter)throw Error('Missing noble writer');
    (person.nobilityHistory??=[]).push(grant);
    const written=this.eventWriter({id:grant.eventId,year:grant.month,monthIndex:grant.month,type:'military-ennobled',category:'politics',actorFactionId:grant.factionId,factionIds:[grant.factionId],rulerId:grant.rulerId,title:nobleChronicle(grant),importance:'major',metadata:{personId:person.personId,sourceUserId:person.sourceUserId,commandId:grant.commandId,rank:grant.rank,nobility:JSON.stringify(grant),...(courtServiceEventId?{courtServiceEventId,courtCoupEventId}:{})}});
    if(written!==grant.eventId||!this.eventReader(grant.factionId).some(e=>e.id===grant.eventId))throw Error('Noble history was not recorded');
  }
  updateNobility(month:number,teams:Team[],dynasties:Dynasty[]){
    if(month%12!==0||!this.eventWriter)return;
    for(const person of this.people.values()){
      const team=teams.find(t=>t.name===person.factionId),dy=dynasties.find(d=>d.factionId===person.factionId);if(!team||!dy)continue;
      const grant=this.eligibleNobleGrant(person,month,team,dy);if(!grant)continue;
      const prior=person.nobilityHistory?structuredClone(person.nobilityHistory):undefined,history=WorldHistory.exportState();
      try{this.recordNoble(person,grant);}catch{if(prior)person.nobilityHistory=prior;else delete person.nobilityHistory;WorldHistory.importState(history);}
    }
  }
  private commitFamilyHistory(event:WorldEvent,apply:()=>void){
    const history=WorldHistory.snapshotPoliticalTransaction(),families=structuredClone(this.families),scope=beginPoliticalMutation();
    try{
      if(!this.eventWriter||this.eventWriter(event)!==event.id||!this.eventReader(event.actorFactionId!).some(e=>e.id===event.id))throw Error('Family history not recorded');
      apply();this.familyByResident=undefined;
    }catch{
      scope.cancel();this.families=families;this.familyByResident=undefined;
      const restoring=beginPoliticalMutation();WorldHistory.rollbackPoliticalTransaction(history);restoring.finishRollback();return false;
    }
    scope.commit();return true;
  }
  updateFamilyTitles(month:number,teams:Team[],dynasties:Dynasty[]){
    if(!this.eventWriter||!this.families.length)return;
    for(const original of [...this.families]){
      const f=this.families.find(f=>f.familyId===original.familyId)!;
      const last=f.nobleSuccession?.at(-1);if(last?.kind==='ENDED')continue;
      const holder=f.members.find(m=>m.memberId===(last?.holderMemberId??f.members[0].memberId))!,p=holder.militaryPersonId?this.people.get(holder.militaryPersonId):undefined,t=teams.find(t=>t.name===f.factionId),dy=dynasties.find(d=>d.factionId===f.factionId),epoch=dy?.houseEpochs?.find(e=>e.foundingRulerId===f.epochFounderId);
      const needsReview=(holder.deathMonth??Infinity)<=month||(holder.exitMonth??Infinity)<=month||familyResidenceAt(f,holder,month)!==f.factionId||p?.politicalRulerId||p?.politicalHistory?.some(a=>a.kind==='COURT_BAN'&&a.severity==='FORFEITURE'&&a.month<=month)||!last&&p?.honorHistory?.some(h=>h.kind==='REVOKED'&&h.month<=month)||t?.status!=='ACTIVE'||(epoch?.endMonth??Infinity)<=month;
      if(!needsReview)continue;
      const context=createFamilyNobleContext(month,[f],this.getPeople(),this.eventReader(f.factionId),dynasties);
      const act=planFamilyNobleTransition(f,context);if(!act)continue;
      // Never turn an absent or mismatched living resident into an heir by inference.
      if(act.kind==='SUCCEEDED'){
        const heir=f.members.find(m=>m.memberId===act.holderMemberId)!,bindings=teams.flatMap(t=>[...t.users]).filter(u=>u.id===heir.sourceUserId&&u.bornMonth===heir.bornMonth);
        const u=bindings[0];if(bindings.length!==1||!u||u.isDestroyed||u.team.name!==f.factionId||u.role!=='NORMAL'||u.rulerId||!u.player.logicalUnitId||u.player.role!=='NORMAL'||u.player.rulerId||u.player.team!==u.team||!u.player.active||u.player.user!==u||!u.team.users.has(u)){this.diagnostics.familyTitleIdentityRejected++;continue;}
      }
      const before=this.snapshotTransaction(),history=WorldHistory.snapshotPoliticalTransaction(),rng=worldRandom.exportState(),scope=beginPoliticalMutation();
      try{
        const previous=f.members.find(m=>m.memberId===act.previousMemberId)!;
        for(const id of act.sourceEventIds)if(id===`${f.familyId}-${previous.memberId}-death`&&!this.eventReader(f.factionId).some(e=>e.id===id)){
          if(previous.deathMonth===undefined||previous.deathMonth>month)throw Error('Missing real family death');
          const e:WorldEvent={id,year:previous.deathMonth,monthIndex:previous.deathMonth,type:'family-member-died',category:'politics',importance:'normal',actorFactionId:f.factionId,factionIds:[f.factionId],title:`${previous.name}卒。`,metadata:{familyId:f.familyId,memberId:previous.memberId,sourceUserId:previous.sourceUserId,bornMonth:previous.bornMonth,deathCause:previous.deathCause}};
          if(this.eventWriter(e)!==id||!this.eventReader(f.factionId).some(e=>e.id===id))throw Error('Family death history rejected');
        }
        if(this.eventWriter({id:act.eventId,year:month,monthIndex:month,type:act.kind==='SUCCEEDED'?'family-title-succeeded':'family-title-ended',category:'politics',importance:'major',actorFactionId:f.factionId,factionIds:[f.factionId],title:familyNobleText(f,act),metadata:{familyId:f.familyId,memberId:act.holderMemberId??act.previousMemberId,personId:f.members.find(m=>m.memberId===act.holderMemberId)?.militaryPersonId,familyNobleAct:JSON.stringify(act)}})!==act.eventId)throw Error('Family title history rejected');
        this.commitFamilyTitle(f.familyId,act);
        if(!this.eventReader(f.factionId).some(e=>e.id===act.eventId))throw Error('Family title event not committed');
      }catch{scope.cancel();this.rollbackTransaction(before,true);const restore=beginPoliticalMutation();WorldHistory.rollbackPoliticalTransaction(history);worldRandom.restore(rng);restore.finishRollback();this.diagnostics.familyTitleFailures++;continue;}
      scope.commit();
      if(['DEATH','NO_HEIR'].includes(act.reason)){
        const children=f.members.filter(m=>m.parentMemberId===act.previousMemberId&&m.enteredMonth<=month),eligible=eligibleFamilyNobleHeirs(f,act.previousMemberId,context);
        this.diagnostics.familyTitleCandidateChecks+=children.length;this.diagnostics.familyTitleRejectedCandidates+=children.length-eligible.length;
      }
    }
  }
  commitFamilyTitle(familyId:string,act:import('./FamilyNobleSuccession').FamilyNobleAct){const f=this.families.find(f=>f.familyId===familyId);if(!f||f.nobleSuccession?.some(a=>a.eventId===act.eventId))throw Error('Duplicate family succession');(f.nobleSuccession??=[]).push(structuredClone(act));}
  updateFamilies(month:number,teams:Team[],dynasties:Dynasty[]){
    if(month%12!==0||!this.eventWriter)return;
    for(const p of this.people.values()){
      const team=teams.find(t=>t.name===p.factionId&&t.status==='ACTIVE'&&t.identityStage==='STATE'),dy=dynasties.find(d=>d.factionId===p.factionId),epoch=this.royalService?.nobleEpoch?.(p.factionId,month);
      if(!team||!dy||!epoch)continue;
      const epochStart=dy.houseEpochs?.find(e=>e.foundingRulerId===epoch)?.startMonth??Infinity;
      const source=familyFounderSource(p,this.eventReader(p.factionId).filter(e=>(e.monthIndex??e.year)>=epochStart),p.factionId,epoch,month);
      const linked=this.families.find(f=>f.members.some(m=>m.militaryPersonId===p.personId));
      if(linked){
        const member=linked.members.find(m=>m.militaryPersonId===p.personId)!;
        if(source&&member.generation>0&&linked.factionId===p.factionId&&linked.epochFounderId===epoch&&!linked.renewals?.some(r=>r.memberId===member.memberId)){
          this.commitFamilyHistory({id:`${linked.familyId}-${member.memberId}-merit`,year:month,type:'military-family-merit',category:'politics',importance:'normal',actorFactionId:team.name,factionIds:[team.name],title:`${p.personalName}自立功业，${linked.surname}氏家声复振。`,metadata:{familyId:linked.familyId,personId:p.personId,memberId:member.memberId,sourceEventId:source.id}},()=>{(linked.renewals??=[]).push({memberId:member.memberId,month,sourceEventId:source.id});});
        }
        continue;
      }
      const f=source&&makeMilitaryFamily(p,p.factionId,epoch,month,source);if(!f)continue;
      this.commitFamilyHistory({id:`${f.familyId}-founded`,year:month,type:'military-family-founded',category:'politics',importance:'normal',actorFactionId:team.name,factionIds:[team.name],title:`${p.personalName}以功立家，${f.surname}氏功臣世家始见于记载。`,metadata:{familyId:f.familyId,personId:p.personId,sourceEventId:f.sourceEventId}},()=>{this.families.push(f);});
    }
  }
  rewardCourtService(person:MilitaryPerson,team:Team,dy:Dynasty,service:WorldEvent,month:number){
    if(!politicalMutationActive()||service.type!=='court-service-granted'||service.rulerId!==dy.currentRulerId||service.metadata?.personId!==person.personId||service.actorFactionId!==team.name)throw Error('Invalid court reward authority');
    const grant=this.eligibleNobleGrant(person,month,team,dy);if(!grant)return;
    this.recordNoble(person,grant,service.id,String(service.metadata?.courtCoupEventId));
    const rewardId=this.eventWriter!({id:`${service.id}-peerage`,year:month,type:'court-reward-granted',category:'politics',importance:'major',actorFactionId:team.name,factionIds:[team.name],rulerId:grant.rulerId,title:`${grant.rulerTitle}以${person.personalName}拥立有功，依其军功资历${grant.previousRank==='NONE'?'封':'进封'}为${({BO:'伯爵',HOU:'侯爵',GONG:'公爵'} as const)[grant.rank]}。`,metadata:{personId:person.personId,courtCoupEventId:service.metadata.courtCoupEventId,courtServiceEventId:service.id,nobleGrantEventId:grant.eventId,previousRank:grant.previousRank,rank:grant.rank}});
    if(rewardId!==`${service.id}-peerage`||!this.eventReader(team.name).some(e=>e.id===rewardId))throw Error('Court reward not recorded');
  }

  recordCourtAct(p:MilitaryPerson,act:MilitaryCourtAct){
    if(!politicalMutationActive()||!this.eventWriter||p.politicalHistory?.some(a=>a.eventId===act.eventId))throw Error('Court act requires one owned transaction');
    (p.politicalHistory??=[]).push(act);
    const id=this.eventWriter({id:act.eventId,year:act.month,type:'military-court-sanction',category:'politics',importance:'major',actorFactionId:act.factionId,factionIds:[act.factionId],rulerId:act.rulerId,title:militaryCourtText(act),metadata:{personId:p.personId,courtCoupEventId:act.courtCoupEventId,sourceEventIds:act.sourceEventIds.join(','),courtAct:JSON.stringify(act)}});
    if(id!==act.eventId||!this.eventReader(act.factionId).some(e=>e.id===id))throw Error('Court act missing');
  }
  applyCourtFailure(p:MilitaryPerson,team:Team,dy:Dynasty,attempt:WorldEvent,result:WorldEvent){
    const act=planCourtBan(p,team,dy,attempt,result);if(!act)throw Error('Invalid court punishment');this.recordCourtAct(p,act);
    for(const honor of nextMilitaryHonors(p,this.getFormations(),this.eventReader(team.name),act.month,[team],[dy]))if(honor.reason==='COURT_COUP_FAILED')this.recordHonor(p,honor);
  }
  private recordHonor(p:MilitaryPerson,honor:MilitaryHonor){
    if(!this.eventWriter)throw Error('Missing honor writer');
    (p.honorHistory??=[]).push(honor);
    const court=honor.reason==='COURT_COUP_FAILED'?p.politicalHistory?.find(a=>a.kind==='COURT_BAN'&&a.courtResultEventId===honor.sourceEventId):undefined;
    const id=this.eventWriter({id:honor.eventId,year:honor.month,monthIndex:honor.month,type:honor.kind==='REVOKED'?'military-title-revoked':'military-posthumous',category:'politics',actorFactionId:honor.factionId,factionIds:[honor.factionId],rulerId:honor.rulerId,title:militaryHonorText(honor),importance:'major',metadata:{personId:p.personId,honor:JSON.stringify(honor),...(court?{courtCoupEventId:court.courtCoupEventId}:{})}});
    if(id!==honor.eventId||!this.eventReader(honor.factionId).some(e=>e.id===id))throw Error('Honor not recorded');
  }
  updateHonors(month:number,teams:Team[],dynasties:Dynasty[]){
    if(month%12!==0||!this.eventWriter)return;
    const formations=this.getFormations(),events=WorldHistory.getEvents();
    for(const p of this.people.values()){
      // Necessary conditions only: do not repeatedly scan history for impossible or completed honors.
      if(!mayReceiveMilitaryHonor(p,month))continue;
      for(const honor of nextMilitaryHonors(p,formations,events,month,teams,dynasties)){
      const prior=p.honorHistory?structuredClone(p.honorHistory):undefined,history=WorldHistory.exportState();
      try{
        this.recordHonor(p,honor);
      }catch{if(prior)p.honorHistory=prior;else delete p.honorHistory;WorldHistory.importState(history);}
    }
    }
  }

  updateAppanages(month:number,teams:Team[],dynasties:Dynasty[],cities:City[]){
    if(!this.eventWriter)return;
    let events=WorldHistory.getRecordedEvents();
    const write=(p:MilitaryPerson,record:MilitaryAppanage)=>{
      const previous=p.appanageHistory?structuredClone(p.appanageHistory):undefined,history=WorldHistory.exportState();
      try{(p.appanageHistory??=[]).push(record);const id=this.eventWriter!({id:record.eventId,year:record.month,monthIndex:record.month,type:'military-appanage',category:'politics',actorFactionId:record.factionId,factionIds:[record.factionId],cityId:record.cityId,cityName:record.cityName,rulerId:record.kind==='GRANTED'?record.rulerId:undefined,title:appanageText(record),importance:record.kind==='GRANTED'?'major':'normal',metadata:{personId:p.personId,appanage:JSON.stringify(record)}});
        if(id!==record.eventId||!this.eventReader(record.factionId).some(e=>e.id===id))throw Error('Appanage event not recorded');events=WorldHistory.getRecordedEvents();return true;
      }catch{if(previous)p.appanageHistory=previous;else delete p.appanageHistory;WorldHistory.importState(history);return false;}
    };
    for(const p of this.people.values()){
      const last=p.appanageHistory?.at(-1);if(last)for(const change of appanageChanges(p,last,events,month))if(!write(p,change))break;
    }
    if(month%12!==0)return;
    const reserved=new Set(this.getPeople().flatMap(p=>{const a=p.appanageHistory?.at(-1);return a&&a.kind!=='ENDED'?[JSON.stringify([a.factionId,a.epochFounderId,a.cityId])]:[];}));
    for(const p of this.people.values()){
      if(!p.nobilityHistory?.length||p.deathMonth!==undefined||p.politicalRulerId)continue;
      const t=teams.find(t=>t.name===p.factionId),d=dynasties.find(d=>d.factionId===p.factionId),authority=honorAuthority(t,d,month);if(!authority)continue;
      const noble=currentNobleGrant(p,p.factionId,month,authority.epochFounderId);
      if(!noble||p.appointments.at(-1)?.factionId!==p.factionId||p.appointments.at(-1)?.endReason==='TRANSFERRED'||p.appanageHistory?.some(a=>a.factionId===p.factionId&&a.epochFounderId===authority.epochFounderId))continue;
      const city=cities.filter(c=>!c.destroyed&&c.ownerFactionId===p.factionId&&noble.cityIds.includes(c.id)&&!reserved.has(JSON.stringify([p.factionId,authority.epochFounderId,c.id]))).sort((a,b)=>a.id.localeCompare(b.id))[0];if(!city)continue;
      const source=events.filter(e=>e.cityId===city.id&&OWNERSHIP_EVENTS.includes(e.type)&&(e.monthIndex??e.year)<=month).at(-1),merit=noble.captureEventIds.map(id=>events.find(e=>e.id===id)).find(e=>e?.cityId===city.id);
      if(!source||source.actorFactionId!==p.factionId||!merit)continue;
      const id=`military-appanage-${p.personId}-${authority.epochFounderId}`;
      const record:MilitaryAppanage={...authority,eventId:id,grantEventId:id,kind:'GRANTED',month,personId:p.personId,personalName:p.personalName,cityId:city.id,cityName:city.name,nobleGrantEventId:noble.eventId,rank:noble.rank,meritEventId:merit.id,sourceEventId:source.id};
      if(write(p,record))reserved.add(JSON.stringify([p.factionId,authority.epochFounderId,city.id]));
    }
  }

  private advanceOffices(month:number,teams:Team[]){
    for(const person of this.people.values()){
      if(person.status!=="ACTIVE")continue;
      const team=teams.find(t=>t.name===person.factionId&&t.status==="ACTIVE");
      const user=team&&[...team.users].find(u=>u.militaryPersonId===person.personId&&u.id===person.sourceUserId);
      const appointment=person.appointments.find(a=>a.factionId===person.factionId&&a.endMonth===undefined);
      const formation=appointment&&this.formations.get(appointment.commandId);
      if(!user?.matchesMilitaryLife?.(person)||!appointment||!formation||formation.status!=="ACTIVE"||formation.commanderPersonId!==person.personId||formation.factionId!==person.factionId||formation.memberUnitIds.length<1||!formation.memberUnitIds.includes(user.player.logicalUnitId??""))continue;
      const grant=getOfficePromotion(appointment,this.getChronicle(person,month,person.factionId),month);
      if(grant)this.grantOffice(person,appointment,grant);
      // Annual opportunities also allow a previously unfilled promotion to recruit
      // when a real resident later reaches the commander's assembly area.
      const context=this.recruitmentContext?.(),office=appointment.officeHistory?.at(-1)?.office??"XIAOWEI";
      if(context){for(const recruit of nearbyMilitaryRecruits(team!,user,id=>this.isUnitAssigned(id),context,MILITARY_FORMATION_CAPACITY[office]-formation.memberUnitIds.length))formation.memberUnitIds.push(recruit.player.logicalUnitId!);}

    }
  }

  isAssigned(unitId: string) { return this.isUnitAssigned(unitId); }
  private isUnitAssigned(unitId: string) { return [...this.formations.values()].some(f => f.status === "ACTIVE" && f.memberUnitIds.includes(unitId)); }

  private reconcile(worldMonth: number, teams: Team[]) {
    const teamById = new Map(teams.map(team => [team.name, team]));
    for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE") continue;
      const team = teamById.get(formation.factionId);
      const person = this.people.get(formation.commanderPersonId);
      const commander = team && person ? [...team.users].find(user => user.id === person.sourceUserId && user.bornMonth === person.bornMonth && user.name === person.name && !user.isDestroyed && user.militaryPersonId === person.personId && user.role === "NORMAL" && !user.rulerId && !user.player.rulerId) : undefined;
      if (!team || team.status !== "ACTIVE" || !commander || !commander.player.logicalUnitId || person?.status !== "ACTIVE") {
        this.endFormation(formation, worldMonth, team?.status === "ACTIVE" ? "DISMISSED" : "FACTION_ENDED");
        continue;
      }
      formation.memberUnitIds = formation.memberUnitIds.filter(unitId => {
        const user = [...team.users].find(candidate => candidate.player.logicalUnitId === unitId && candidate.role === "NORMAL" && !candidate.rulerId && !candidate.player.rulerId);
        return Boolean(user && user.player.active);
      });
      if (!formation.memberUnitIds.includes(commander.player.logicalUnitId)) formation.memberUnitIds.unshift(commander.player.logicalUnitId);
      if (formation.memberUnitIds.length < 1) this.endFormation(formation, worldMonth, "DISMISSED");
    }
  }

  private endFormation(formation: MilitaryFormation, worldMonth: number, reason: MilitaryAppointment["endReason"], courtCoupEventId?:string) {
    if (formation.status !== "ACTIVE") return;
    this.diagnostics.releasedFormations++;
    if (reason === "AGE_RETIREMENT") this.diagnostics.ageRetirements++;
    formation.status = "DISBANDED"; delete formation.retreatUntilMonth; formation.targetCityId = undefined; formation.orderStartMonth = undefined;
    const person = this.people.get(formation.commanderPersonId);
    const appointment = person?.appointments.find(item => item.commandId === formation.commandId && item.endMonth === undefined);
    if (appointment) { appointment.endMonth = worldMonth; appointment.endReason = reason; }
    if (person && person.status !== "DEAD") person.status = "RETIRED";
    if (person) this.eventWriter?.({ id: `military-command-ended-${formation.commandId}`, year: worldMonth, monthIndex: worldMonth,
      category: "politics", type: "military-command-ended", title: reason === "AGE_RETIREMENT" ? `${getMilitaryPersonDisplayName(person)}年老退役` : `${getMilitaryPersonDisplayName(person)}结束军事任职`, factionIds: [formation.factionId],
      actorFactionId: formation.factionId, metadata: { personId: person.personId, sourceUserId: person.sourceUserId, personalName: person.personalName, commandId: formation.commandId, endReason: reason, ...(courtCoupEventId?{courtCoupEventId}:{}) }, importance: "normal" });
  }

  withdrawFromCity(factionId:string,cityId:string,month:number){
    for(const f of this.formations.values())if(f.status==="ACTIVE"&&f.factionId===factionId&&f.targetCityId===cityId){f.retreatUntilMonth=month+12;f.targetCityId=undefined;f.orderStartMonth=undefined;}
  }
  private refreshOrders(worldMonth: number, teams: Team[], cities: City[]) {
    for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE") continue;
      if((formation.retreatUntilMonth??-1)>worldMonth)continue;
      delete formation.retreatUntilMonth;
      const current = cities.find(city => city.id === formation.targetCityId);
      if(current&&current.ownerFactionId!==formation.factionId&&!Diplomacy.canAttack(formation.factionId,current.ownerFactionId,worldMonth)){this.withdrawFromCity(formation.factionId,current.id,worldMonth);continue;}
      if (current && !current.destroyed && current.ownerFactionId !== formation.factionId && current.ownerTeam?.status === "ACTIVE" &&
        Diplomacy.canAttack(formation.factionId, current.ownerFactionId, worldMonth)) continue;
      if (formation.targetCityId) {
        this.diagnostics.invalidatedTargets++;
        this.lastArrivalTargetByCommand.delete(formation.commandId);
        this.longRangeOrderSamples.delete(formation.commandId);
      }
      const team = teams.find(candidate => candidate.name === formation.factionId);
      const members = team ? [...team.users].filter(user => formation.memberUnitIds.includes(user.player.logicalUnitId ?? "") && user.player.active) : [];
      const center = members.length ? members.reduce((sum, user) => ({ x: sum.x + user.player.x / members.length, y: sum.y + user.player.y / members.length }), { x: 0, y: 0 }) : undefined;
      const options = cities.filter(city => !city.destroyed && city.ownerFactionId !== formation.factionId && city.ownerTeam?.status === "ACTIVE" &&
        Diplomacy.canAttack(formation.factionId, city.ownerFactionId, worldMonth))
        .sort((a, b) => {
          if (!center) return a.id.localeCompare(b.id);
          const distance = (city: City) => Math.hypot(city.block.x - center.x, city.block.y - center.y);
          return distance(a) - distance(b) || a.id.localeCompare(b.id);
        });
      const nearest = options[0];
      const person = this.people.get(formation.commanderPersonId);
      const distance = (city: City) => center ? Math.hypot(city.block.x - center.x, city.block.y - center.y) : Infinity;
      const nearbyCapital = center && nearest ? options.find(city => city.isCapital && city.ownerTeam?.capitalCity === city &&
        distance(city) <= distance(nearest) * 1.15 && distance(city) - distance(nearest) <= 32) : undefined;
      const next = nearbyCapital && nearbyCapital !== nearest && person && this.getCareer(person, worldMonth).verifiedCaptures > 0 ? nearbyCapital : nearest;
      if (next) {
        if (formation.targetCityId !== next.id) {
          this.lastArrivalTargetByCommand.delete(formation.commandId);
          this.longRangeOrderSamples.delete(formation.commandId);
        }
        formation.targetCityId = next.id;
        formation.orderStartMonth = worldMonth;
        this.diagnostics.orders++;
        this.eventWriter?.({ id: `military-order-${formation.commandId}-${worldMonth}-${next.id}`, year: worldMonth, monthIndex: worldMonth,
          type: "military-order-issued", category: "war", title: "军事编组确定目标", importance: "normal",
          factionIds: [formation.factionId, next.ownerFactionId], actorFactionId: formation.factionId, targetFactionId: next.ownerFactionId,
          cityId: next.id, cityName: next.name, metadata: { commandId: formation.commandId, personId: formation.commanderPersonId, personalName: person?.personalName,
            meritInfluenced: next !== nearest ? 1 : 0, nearestCityId: nearest?.id, nearestDistance: center && nearest ? distance(nearest) : undefined,
            targetWasCapital: next.isCapital && next.ownerTeam?.capitalCity === next ? 1 : 0,
            targetDistance: center ? distance(next) : undefined } });
      } else { formation.targetCityId = undefined; formation.orderStartMonth = undefined; }
    }
  }

  private observeLongRangeOrders(worldMonth: number, teams: Team[], cities: City[]) {
    const activeCommandIds = new Set([...this.formations.values()].filter(formation => formation.status === "ACTIVE").map(formation => formation.commandId));
    for (const commandId of this.longRangeOrderSamples.keys()) if (!activeCommandIds.has(commandId)) this.longRangeOrderSamples.delete(commandId);
    for (const commandId of this.lastArrivalTargetByCommand.keys()) if (!activeCommandIds.has(commandId)) this.lastArrivalTargetByCommand.delete(commandId);
    const cityById = new Map(cities.map(city => [city.id, city]));
    for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE" || !formation.targetCityId || formation.orderStartMonth === undefined) continue;
      const age = worldMonth - formation.orderStartMonth;
      if (age < 120 || age % 120 !== 0) continue;
      const target = cityById.get(formation.targetCityId);
      const team = teams.find(candidate => candidate.name === formation.factionId);
      const members = team ? [...team.users].filter(user => formation.memberUnitIds.includes(user.player.logicalUnitId ?? "") && user.player.active) : [];
      if (!target || !members.length) continue;
      const nearestMemberDistance = Math.min(...members.map(user => Math.hypot(target.block.x - user.player.x, target.block.y - user.player.y)));
      const previousDistance = this.longRangeOrderSamples.get(formation.commandId);
      if (nearestMemberDistance > 8 * 32 && previousDistance !== undefined && previousDistance - nearestMemberDistance < 32) {
        this.diagnostics.staleOrderChecks++;
      }
      this.longRangeOrderSamples.set(formation.commandId, nearestMemberDistance);
    }
  }

  steerActiveUnits(worldMonth: number, core: import("../Game/Core").default) {
    if (core.logicalGameplayAuthority) return;
    const cities=core.allCities;
    const released=new Set(this.getFormations().filter(f=>f.status==="DISBANDED").flatMap(f=>f.memberUnitIds));
    for(const team of core.teams)for(const u of team.users){const p=u.player,id=p.logicalUnitId,body=p.Body;
      if(!id||!released.has(id)||this.isUnitAssigned(id)||u.isDestroyed||u.role!=="NORMAL"||!p.active||Math.hypot(body.velocity.x,body.velocity.y)>0.01)continue;
      const home=team.capitalCity?.block;let dx=home?home.x-p.x:1,dy=home?home.y-p.y:0;if(Math.hypot(dx,dy)<1){dx=u.id%2?1:-1;dy=1;}const k=p.speed/Math.hypot(dx,dy);body.setVelocity(dx*k,dy*k);
    }
    const cityById = new Map(core.allCities.map(city => [city.id, city]));
    for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE") continue;
      const retreat=(formation.retreatUntilMonth??-1)>worldMonth;
      const target = retreat?cities.filter(c=>c.ownerFactionId===formation.factionId&&!c.destroyed).sort((a,b)=>Number(b.isCapital)-Number(a.isCapital)||a.id.localeCompare(b.id))[0]:cityById.get(formation.targetCityId??"");
      if (!target || target.destroyed || (!retreat&&(target.ownerFactionId === formation.factionId || !Diplomacy.canAttack(formation.factionId, target.ownerFactionId, worldMonth)))) continue;
      for (const unitId of formation.memberUnitIds) {
        const entry = core.logicalUnitRegistry.getEntry(unitId);
        const player = entry?.player;
        if (!player?.active || entry?.state.factionId !== formation.factionId) continue;
        const dx = target.block.x - player.x; const dy = target.block.y - player.y; const length = Math.hypot(dx, dy);
        const body = player.Body;
        if(retreat?length<=32:isSiegePosition(target,player.x,player.y,32,true)){body.setVelocity(0,0);continue;}
        const desiredX = dx / length * player.speed; const desiredY = dy / length * player.speed;
        if (Math.abs(body.velocity.x - desiredX) + Math.abs(body.velocity.y - desiredY) > 0.5) this.diagnostics.unitsSteered++;
        const vx = body.velocity.x * 0.92 + desiredX * 0.08; const vy = body.velocity.y * 0.92 + desiredY * 0.08;
        const velocityLength = Math.hypot(vx, vy) || 1;
        body.setVelocity(vx / velocityLength * player.speed, vy / velocityLength * player.speed);
      }
    }
  }

  steerLogicalUnits(worldMonth: number, units: LogicalUnitState[], cities: City[]) {
    const released=new Set(this.getFormations().filter(f=>f.status==="DISBANDED").flatMap(f=>f.memberUnitIds));
    for(const u of units){if(!released.has(u.unitId)||this.isUnitAssigned(u.unitId)||!u.alive||u.role!=="NORMAL"||Math.hypot(u.logicalVX,u.logicalVY)>0.01)continue;
      const home=cities.filter(c=>c.ownerFactionId===u.factionId&&!c.destroyed).sort((a,b)=>Number(b.isCapital)-Number(a.isCapital)||a.id.localeCompare(b.id))[0]?.block;
      let dx=home?home.x-u.logicalX:1,dy=home?home.y-u.logicalY:0;if(Math.hypot(dx,dy)<1){dx=(u.userId??0)%2?1:-1;dy=1;}const k=u.speed/Math.hypot(dx,dy);u.logicalVX=dx*k;u.logicalVY=dy*k;
    }
    const unitById = new Map(units.map(unit => [unit.unitId, unit]));
    const cityById = new Map(cities.map(city => [city.id, city]));
    for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE") continue;
      const retreat=(formation.retreatUntilMonth??-1)>worldMonth;
      const target = retreat?cities.filter(c=>c.ownerFactionId===formation.factionId&&!c.destroyed).sort((a,b)=>Number(b.isCapital)-Number(a.isCapital)||a.id.localeCompare(b.id))[0]:cityById.get(formation.targetCityId??"");
      if (!target || target.destroyed || (!retreat&&(target.ownerFactionId === formation.factionId || !Diplomacy.canAttack(formation.factionId, target.ownerFactionId, worldMonth)))) continue;
      for (const unitId of formation.memberUnitIds) {
        const unit = unitById.get(unitId);
        if (!unit?.alive || unit.factionId !== formation.factionId) continue;
        const dx = target.block.x - unit.logicalX; const dy = target.block.y - unit.logicalY; const length = Math.hypot(dx, dy);
        if(retreat?length<=32:isSiegePosition(target,unit.logicalX,unit.logicalY,32,true)){unit.logicalVX=0;unit.logicalVY=0;continue;}
        const desiredX = dx / length * unit.speed; const desiredY = dy / length * unit.speed;
        if (Math.abs(unit.logicalVX - desiredX) + Math.abs(unit.logicalVY - desiredY) > 0.5) this.diagnostics.unitsSteered++;
        const vx = unit.logicalVX * 0.92 + desiredX * 0.08; const vy = unit.logicalVY * 0.92 + desiredY * 0.08;
        const velocityLength = Math.hypot(vx, vy) || 1;
        unit.logicalVX = vx / velocityLength * unit.speed; unit.logicalVY = vy / velocityLength * unit.speed;
      }
    }
  }

  getCommandForUnit(unitId: string) { return [...this.formations.values()].find(f => f.status === "ACTIVE" && f.memberUnitIds.includes(unitId)); }
  getPerson(personId: string) { return this.people.get(personId); }

  recordCommandSiegeContact(commandId?: string, commanderPersonId?: string, cityId?: string) {
    if (!commandId || !commanderPersonId) return;
    const formation = this.formations.get(commandId);
    if (formation?.status === "ACTIVE" && formation.commanderPersonId === commanderPersonId) {
      this.diagnostics.commandedSiegeContacts++;
      if (formation.targetCityId && formation.targetCityId === cityId && this.lastArrivalTargetByCommand.get(commandId) !== formation.targetCityId) {
        this.lastArrivalTargetByCommand.set(commandId, formation.targetCityId);
        this.diagnostics.targetCityArrivals++;
      }
    }
  }

  onUserTransfer(user: User, nextFactionId: string, worldMonth: number) {
    const relative=this.getFamilyMember(user.id,user.bornMonth);if(relative)(relative.member.factionHistory??=[]).push({month:worldMonth,factionId:nextFactionId,eventIndex:WorldHistory.getEventCount()});
    const record = user.militaryPersonId ? this.people.get(user.militaryPersonId) : undefined;
    // A stale or copied personId must never transfer another person's identity or office.
    const person = record?.sourceUserId === user.id && record.bornMonth === user.bornMonth &&
      record.name === user.name && record.factionId === user.team.name ? record : undefined;
    const unitId = user.player.logicalUnitId;
    if (unitId) for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE" || !formation.memberUnitIds.includes(unitId)) continue;
      if (person && formation.commanderPersonId === person.personId) this.endFormation(formation, worldMonth, "TRANSFERRED");
      else {
        formation.memberUnitIds = formation.memberUnitIds.filter(id => id !== unitId);
        if (formation.memberUnitIds.length < 1) this.endFormation(formation, worldMonth, "DISMISSED");
      }
    }
    if (person && person.status !== "DEAD") person.factionId = nextFactionId;
  }

  onUserDestroyed(user: User, worldMonth: number, cause: string) {
    const relative=this.getFamilyMember(user.id,user.bornMonth);
    if(relative){relative.member.exitHistoryIndex=WorldHistory.getEventCount();relative.member.exitMonth=worldMonth;relative.member.exitCause=cause;if(['SIEGE_LOSS','BATTLE_DEATH','NATURAL_DEATH'].includes(cause)){if(relative.member.deathMonth!==worldMonth||relative.member.deathHistoryIndex===undefined)relative.member.deathHistoryIndex=WorldHistory.getEventCount();relative.member.deathMonth=worldMonth;relative.member.deathCause=cause;}}
    const record = user.militaryPersonId ? this.people.get(user.militaryPersonId) : undefined;
    const person = record?.sourceUserId === user.id && record.bornMonth === user.bornMonth && record.name === user.name && record.factionId === user.team.name ? record : undefined;
    if (cause === "NATURAL_DEATH" && !(ordinaryLifeEligible({...user,isDestroyed:false})&&worldMonth>=residentNaturalDeathMonth(user.id,user.bornMonth)) && (!person || (!person.royalIdentity && worldMonth % 12 !== 0) || worldMonth < deriveMilitaryLifeSchedule(person).naturalDeathMonth)) return;
    const death = cause === "SIEGE_LOSS" || cause === "BATTLE_DEATH" || cause === "NATURAL_DEATH";
    const unitId = user.player.logicalUnitId;
    if (unitId) for (const formation of this.formations.values()) if (formation.status === "ACTIVE" && formation.memberUnitIds.includes(unitId)) {
      if (person && formation.commanderPersonId === person.personId) this.endFormation(formation, worldMonth, death ? "DEATH" : "DISMISSED");
      else {
        formation.memberUnitIds = formation.memberUnitIds.filter(id => id !== unitId);
        if (formation.memberUnitIds.length < 1) this.endFormation(formation, worldMonth, "DISMISSED");
      }
    }
    if(relative&&death&&!user.militaryPersonId){
      const m=relative.member,f=relative.family,id=`${f.familyId}-${m.memberId}-death`;
      m.deathHistoryIndex=WorldHistory.getEventCount();
      if(!this.eventWriter||this.eventWriter({id,year:worldMonth,monthIndex:worldMonth,type:'family-member-died',category:'politics',importance:'normal',actorFactionId:f.factionId,factionIds:[f.factionId],title:`${m.name}卒。`,metadata:{familyId:f.familyId,memberId:m.memberId,sourceUserId:m.sourceUserId,bornMonth:m.bornMonth,deathCause:cause}})!==id||!this.eventReader(f.factionId).some(e=>e.id===id))throw Error('Family resident death source not committed');
    }
    if (!person || person.status === "DEAD") return;
    if (death) {
      person.status = "DEAD"; person.deathMonth = worldMonth; person.deathCause = cause; this.diagnostics.deaths++;
      if (cause === "NATURAL_DEATH") this.diagnostics.naturalDeaths++;
      this.eventWriter?.({ id: `military-person-death-${person.personId}-${worldMonth}`, year: worldMonth, monthIndex: worldMonth,
        category: "politics", type: "military-person-died", title: cause === "NATURAL_DEATH" ? `${getMilitaryPersonDisplayName(person)}自然去世` : `${getMilitaryPersonDisplayName(person)}去世`, factionIds: [person.factionId], actorFactionId: person.factionId,
        metadata: { personId: person.personId, sourceUserId: person.sourceUserId, personalName: person.personalName, deathCause: cause }, importance: "normal" });
    } else if (person.status === "ACTIVE") person.status = "RETIRED";
  }

  getCaptureIdentity(commandId: string | undefined, personId: string | undefined, factionId: string, worldMonth: number) {
    const formation = commandId ? this.formations.get(commandId) : undefined;
    const person = personId ? this.people.get(personId) : undefined;
    return formation?.status === "ACTIVE" && person?.status === "ACTIVE" && formation.commanderPersonId === person.personId &&
      formation.factionId === factionId && person.factionId === factionId && person.deathMonth === undefined &&
      person.appointments.some(a => a.commandId === commandId && a.factionId === factionId && a.startMonth <= worldMonth && a.endMonth === undefined)
      ? person.personalName : undefined;
  }

  /** A friendly or destroyed target is already ignored by movement; clear its stale persisted order without rolling a new one. */
  clearObsoleteCityTarget(cityId:string,ownerFactionId?:string){
    for(const f of this.formations.values())if(f.status==="ACTIVE"&&f.targetCityId===cityId&&(!ownerFactionId||f.factionId===ownerFactionId)){
      f.targetCityId=undefined;f.orderStartMonth=undefined;this.lastArrivalTargetByCommand.delete(f.commandId);this.longRangeOrderSamples.delete(f.commandId);this.diagnostics.invalidatedTargets++;
    }
  }

  getCaptureOffice(commandId:string|undefined,personId:string|undefined,factionId:string,month:number){
    if(!this.getCaptureIdentity(commandId,personId,factionId,month))return undefined;
    return this.people.get(personId!)?.appointments.find(a=>a.commandId===commandId&&a.factionId===factionId&&a.endMonth===undefined)?.officeHistory?.at(-1)?.office;
  }

  recordCapture(commandId: string | undefined, eventId: string, cityId: string, worldMonth: number) {
    if (!commandId) return;
    const formation = this.formations.get(commandId);
    const person = formation ? this.people.get(formation.commanderPersonId) : undefined;
    if (!formation || formation.status !== "ACTIVE" || !person || person.status !== "ACTIVE" || (person.deathMonth !== undefined && worldMonth > person.deathMonth) || person.capturedEventIds.includes(eventId)) return;
    formation.captures.push({ eventId, cityId, month: worldMonth });
    person.capturedEventIds.push(eventId); this.diagnostics.captures++;
  }

  reconcileFactionEnd(factionId: string, worldMonth: number) {
    for (const formation of this.formations.values()) if (formation.factionId === factionId && formation.status === "ACTIVE") this.endFormation(formation, worldMonth, "FACTION_ENDED");
  }
}

const MilitaryCommandRegistry = new MilitaryCommandRegistryStore();
export default MilitaryCommandRegistry;
