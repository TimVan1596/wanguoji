import type City from '../Components/City';
import type Team from '../Components/Team';
import type User from '../Components/User';
import type {Dynasty} from './Dynasty';
import type {MilitaryFamilyMember} from './MilitaryFamily';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import Military from './MilitaryCommandRegistry';
import DynastyRegistry from './Dynasty';
import WorldHistory,{type WorldEvent} from '../History/WorldHistory';
import {personAbilities,militaryAbilities} from './PersonAbilities';
import {currentNobleGrant,NOBLE_RANKS,type NobleRank} from './MilitaryNobility';
import {familyNobleRankAt,familyResidenceAt,familyMemberPresent} from './FamilyNobleSuccession';
import {unresolvedCourtBans} from './MilitaryCourtStanding';
import {beginPoliticalMutation} from '../Simulation/PoliticalMutationScope';
import worldRandom,{WorldRandom} from '../Simulation/WorldRandom';

export type CivilGovernancePolicy='BASELINE'|'LOW'|'MEDIUM'|'HIGH';
export const CIVIL_GOVERNANCE_POLICY:CivilGovernancePolicy='MEDIUM';
export const CIVIL_APPOINTMENT_CHANCE:Record<CivilGovernancePolicy,number>={BASELINE:0,LOW:.28,MEDIUM:.42,HIGH:.58};
export const CIVIL_CITY_STABILITY_MONTHS=24;
export const MAX_ACTIVE_CIVIL_GOVERNORS_PER_FACTION=3;
export const civilGovernanceThreshold=(policy:CivilGovernancePolicy)=>policy==='LOW'?72:policy==='HIGH'?48:60;
export const isCivilGovernancePolicy=(value:unknown):value is CivilGovernancePolicy=>typeof value==='string'&&Object.hasOwn(CIVIL_APPOINTMENT_CHANCE,value);

export type CivilGovernorSource='ORDINARY_RESIDENT'|'FAMILY'|'NOBLE'|'ROYAL'|'RETIRED_MILITARY';
export type CivilGovernorEndReason='DEATH'|'CITY_LOST'|'FACTION_ENDED'|'REGIME_ENDED'|'POLITICAL_SANCTION'|'MILITARY_OFFICE'|'REPLACED'|'IDENTITY_ENDED';

export interface CivilGovernorTerm {
 version:1;assignmentId:string;personId:string;sourceUserId:number;bornMonth:number;personalName:string;
 identitySource:CivilGovernorSource;familyId?:string;familyMemberId?:string;royalRulerId?:string;
 factionId:string;countryName:string;epochFounderId:string;cityId:string;cityName:string;
 rulerId:string;rulerTitle:string;startMonth:number;appointEventId:string;
 endMonth?:number;endReason?:CivilGovernorEndReason;endEventId?:string;
 lastEffectMonth?:number;loyaltyRecovered:number;devastationRecovered:number;meritMonth?:number;meritEventId?:string;
 meritLoyaltyRecovered?:number;meritDevastationRecovered?:number;
}

export interface CivilAdministrationState {
 version:1;sequence:number;lastEvaluationMonth:number;policy:CivilGovernancePolicy;terms:CivilGovernorTerm[];
}

export interface CivilGovernorCandidate {
 personId:string;sourceUserId:number;bornMonth:number;personalName:string;identitySource:CivilGovernorSource;
 familyId?:string;familyMemberId?:string;royalRulerId?:string;nobleRank?:NobleRank;strategy:number;weight:number;
}

const empty=():CivilAdministrationState=>({version:1,sequence:0,lastEvaluationMonth:-1,policy:CIVIL_GOVERNANCE_POLICY,terms:[]});
const active=(term:CivilGovernorTerm,month:number)=>term.startMonth<=month&&term.endMonth===undefined;
const higherRank=(a?:NobleRank,b?:NobleRank)=>a&&b?(NOBLE_RANKS.indexOf(a)>=NOBLE_RANKS.indexOf(b)?a:b):a??b;

export function civilGovernorPersonId(user:Pick<User,'id'|'bornMonth'|'militaryPersonId'>,family?:{member:MilitaryFamilyMember}){return user.militaryPersonId??family?.member.memberId??`resident-${user.id}-${user.bornMonth}`;}

/** Current occupancy is an authoritative state fact, independent of military office and peerage. */
export function civilGovernorStatus(term:CivilGovernorTerm,city:City|undefined,month:number){
 if(term.endMonth!==undefined)return '已离任';
 if(!city||city.destroyed)return '城市档案结束';
 if(city.underSiege||city.isInCaptureGrace(month))return '困难';
 if(term.meritEventId)return '治理有绩';
 if(city.loyalty<40||city.devastation>=60)return '困难';
 if(month-term.startMonth<24||city.devastation>=25||city.loyalty<60)return '恢复中';
 return '稳定';
}

/** Bounded annual restoration on top of the original city systems; never applies while invested or newly captured. */
export function civilGovernanceEffect(term:CivilGovernorTerm,city:City,month:number,policy:CivilGovernancePolicy='MEDIUM'){
 if(term.endMonth!==undefined||city.destroyed||city.underSiege||city.isInCaptureGrace(month)||month<=term.startMonth||(month-term.startMonth)%12!==0)return {loyalty:0,devastation:0};
 // The authoritative ability is frozen by identity at appointment and re-derived by the same function here.
 const source=term.royalRulerId?{kind:'ROYAL' as const,rulerId:term.royalRulerId,bornMonth:term.bornMonth}:{kind:'RESIDENT' as const,sourceUserId:term.sourceUserId,bornMonth:term.bornMonth};
 const value=personAbilities(source).strategy,threshold=civilGovernanceThreshold(policy);
 return {loyalty:value>=threshold&&city.loyalty<80?1:0,devastation:value>=Math.max(0,threshold-12)&&city.devastation>0?1:0};
}

export function civilControlledSince(city:Pick<City,'ownerFactionId'|'foundedYear'|'lastCapturedYear'|'history'>,team:Pick<Team,'name'|'currentActiveSinceYear'>,month:number){
 const acquired=[city.foundedYear,city.lastCapturedYear??city.foundedYear,...(city.history??[]).filter(e=>e.newOwnerFactionId===city.ownerFactionId&&e.year<=month).map(e=>e.year)]
   .filter((value):value is number=>typeof value==='number'&&Number.isFinite(value));
 return Math.max(team.currentActiveSinceYear??0,...acquired);
}

export function eligibleCivilCities(month:number,team:Team,terms:readonly CivilGovernorTerm[]){
 if(team.status!=='ACTIVE'||team.identityStage!=='STATE'||team.stateFoundedMonth===undefined||team.stateFoundedMonth>month||team.cities.length<2)return [];
 const occupied=new Set(terms.filter(term=>active(term,month)).map(term=>term.cityId));
 return team.cities.filter(city=>!city.destroyed&&city.ownerFactionId===team.name&&!occupied.has(city.id)&&!city.underSiege&&!city.isInCaptureGrace(month)&&month-civilControlledSince(city,team,month)>=CIVIL_CITY_STABILITY_MONTHS);
}

export function civilGovernorCandidates(month:number,team:Team,people:readonly MilitaryPerson[],terms:readonly CivilGovernorTerm[],epochFounderId:string){
 const occupied=new Set(terms.filter(term=>active(term,month)).map(term=>term.personId)),rows:CivilGovernorCandidate[]=[];
 for(const user of team.users){
  if(user.isDestroyed||user.role!=='NORMAL'||user.rulerId||user.player.rulerId||month-user.bornMonth<18*12||month-user.bornMonth>75*12||occupied.has(civilGovernorPersonId(user)))continue;
  const person=user.militaryPersonId?people.find(p=>p.personId===user.militaryPersonId):undefined;
  if(person&&(person.politicalRulerId||person.status==='DEAD'||person.deathMonth!==undefined||person.appointments.some(a=>a.factionId===team.name&&a.startMonth<=month&&(a.endMonth??Infinity)>month)))continue;
  if(person&&unresolvedCourtBans(person,team.name,month,epochFounderId).length)continue;
  const familyLink=person?Military.getFamilyMember(person.sourceUserId,person.bornMonth):Military.getFamilyMember(user.id,user.bornMonth);
  if(familyLink&&(!familyMemberPresent(familyLink.member,month)||familyResidenceAt(familyLink.family,familyLink.member,month)!==team.name))continue;
  const nobleRank=higherRank(person?currentNobleGrant(person,team.name,month,epochFounderId)?.rank:undefined,familyLink?familyNobleRankAt(familyLink.family,familyLink.member,month):undefined);
  const retired=!!person&&person.status==='RETIRED';
  const royal=!!person?.royalIdentity;
  const identitySource:CivilGovernorSource=royal?'ROYAL':retired?'RETIRED_MILITARY':nobleRank?'NOBLE':familyLink?'FAMILY':'ORDINARY_RESIDENT';
  const abilities=person?militaryAbilities(person):personAbilities({kind:'RESIDENT',sourceUserId:user.id,bornMonth:user.bornMonth});
  const sourceWeight=identitySource==='ORDINARY_RESIDENT'?1:identitySource==='FAMILY'?1.08:identitySource==='NOBLE'?1.04+Math.max(0,NOBLE_RANKS.indexOf(nobleRank??'NAN'))*.02:identitySource==='ROYAL'?1.12:1.06;
  const personId=person?.personId??civilGovernorPersonId(user,familyLink),weight=(.72+abilities.strategy/100*.55)*sourceWeight;
  rows.push({personId,sourceUserId:user.id,bornMonth:user.bornMonth,personalName:person?.personalName??user.name,identitySource,familyId:familyLink?.family.familyId,familyMemberId:familyLink?.member.memberId,royalRulerId:person?.royalIdentity?.rulerId,nobleRank,strategy:abilities.strategy,weight});
 }
 return rows.sort((a,b)=>b.weight-a.weight||b.strategy-a.strategy||a.bornMonth-b.bornMonth||a.personId.localeCompare(b.personId));
}

function transaction<T>(work:()=>T):T{
 const before=structuredClone(CivilAdministration.exportState()),history=WorldHistory.snapshotPoliticalTransaction(),scope=beginPoliticalMutation();
 try{const value=work();scope.commit();return value;}catch(error){scope.cancel();CivilAdministration.importState(before);const restore=beginPoliticalMutation();WorldHistory.rollbackPoliticalTransaction(history);restore.finishRollback();throw error;}
}

class CivilAdministrationStore {
 private state:CivilAdministrationState=empty();
 reset(){this.state=empty();}
 exportState():CivilAdministrationState{return structuredClone(this.state);}
 importState(state:CivilAdministrationState){this.state=structuredClone(state);this.state.terms=(this.state.terms??[]).map(term=>({...term})).sort((a,b)=>a.startMonth-b.startMonth||a.assignmentId.localeCompare(b.assignmentId));}
 getTerms(factionId?:string){return (factionId?this.state.terms.filter(term=>term.factionId===factionId):this.state.terms).map(term=>({...term}));}
 getCurrentByCity(cityId:string,month:number){const term=this.state.terms.filter(term=>term.cityId===cityId&&active(term,month)).at(-1);return term?{...term}:undefined;}
 getByPerson(personId:string){return this.state.terms.filter(term=>term.personId===personId).map(term=>({...term}));}
 getDiagnostics(month:number){const terms=this.state.terms,ended=terms.filter(t=>t.endMonth!==undefined);return {appointed:terms.length,active:terms.filter(t=>active(t,month)).length,ended:ended.length,endReasons:ended.reduce((out,t)=>(out[t.endReason!]=(out[t.endReason!]??0)+1,out),{} as Record<string,number>),loyaltyRecovered:terms.reduce((n,t)=>n+t.loyaltyRecovered,0),devastationRecovered:terms.reduce((n,t)=>n+t.devastationRecovered,0),merits:terms.filter(t=>t.meritEventId).length};}
 update(month:number,teams:Team[],dynasties:Dynasty[]){
  this.reconcile(month,teams,dynasties);
  this.applyGovernance(month,teams);
  if(month%12!==0||month===this.state.lastEvaluationMonth)return;
  this.state.lastEvaluationMonth=month;
  for(const team of teams.filter(team=>team.status==='ACTIVE'&&team.identityStage==='STATE')){
   const dynasty=dynasties.find(d=>d.factionId===team.name),ruler=dynasty?.rulers.find(r=>r.id===dynasty.currentRulerId),epoch=ruler&&(dynasty?.houseEpochs??[]).find(e=>e.startMonth<=month&&(e.endMonth??Infinity)>=month);
   if(!dynasty||!ruler||!epoch||ruler.status!=='ruling'||ruler.accessionYear===undefined||ruler.accessionYear>month||ruler.endYear!==undefined||ruler.deathMonth!==undefined)continue;
   const current=this.state.terms.filter(term=>term.factionId===team.name&&active(term,month));
   if(current.length>=Math.min(MAX_ACTIVE_CIVIL_GOVERNORS_PER_FACTION,Math.max(1,Math.ceil(team.cities.length/4))))continue;
   if(this.state.terms.some(term=>term.factionId===team.name&&term.startMonth>=month&&term.startMonth<month+12))continue;
   const eligibleCities=eligibleCivilCities(month,team,this.state.terms),candidates=civilGovernorCandidates(month,team,Military.getPeople(),this.state.terms,epoch.foundingRulerId);
   if(!eligibleCities.length||!candidates.length)continue;
   const rng=new WorldRandom();rng.initialize(`civil-administration-v1:${worldRandom.exportState().seed}:${team.name}:${month}`);
   if(rng.next()>=CIVIL_APPOINTMENT_CHANCE[this.state.policy])continue;
   const city=eligibleCities[Math.min(eligibleCities.length-1,Math.floor(rng.next()*eligibleCities.length))],candidate=candidates[Math.min(candidates.length-1,Math.floor(rng.next()*candidates.length))];
   this.appoint(month,team,city,candidate,dynasty);
  }
 }
 appoint(month:number,team:Team,city:City,candidate:CivilGovernorCandidate,dynasty:Dynasty){
  const ruler=dynasty.rulers.find(r=>r.id===dynasty.currentRulerId),epoch=ruler&&(dynasty.houseEpochs??[]).find(e=>e.startMonth<=month&&(e.endMonth??Infinity)>=month);
  if(!ruler||!epoch||!eligibleCivilCities(month,team,this.state.terms).some(c=>c.id===city.id)||!civilGovernorCandidates(month,team,Military.getPeople(),this.state.terms,epoch.foundingRulerId).some(c=>c.personId===candidate.personId))throw Error('Invalid civil governor appointment');
  return transaction(()=>{
   const sequence=this.state.sequence+1,assignmentId=`civil-governor-${team.name}-${city.id}-${sequence}`,eventId=`${assignmentId}-appointed`;
   const term:CivilGovernorTerm={version:1,assignmentId,personId:candidate.personId,sourceUserId:candidate.sourceUserId,bornMonth:candidate.bornMonth,personalName:candidate.personalName,identitySource:candidate.identitySource,familyId:candidate.familyId,familyMemberId:candidate.familyMemberId,royalRulerId:candidate.royalRulerId,factionId:team.name,countryName:team.displayName??team.name,epochFounderId:epoch.foundingRulerId,cityId:city.id,cityName:city.name,rulerId:ruler.id,rulerTitle:DynastyRegistry.getRulerHistoricalTitle(ruler.id,team.name,month)??`${team.displayName??team.name}君主`,startMonth:month,appointEventId:eventId,loyaltyRecovered:0,devastationRecovered:0};
   const event:WorldEvent={id:eventId,year:month,monthIndex:month,type:'civil-governor-appointed',category:'politics',importance:'major',actorFactionId:team.name,factionIds:[team.name],rulerId:ruler.id,cityId:city.id,cityName:city.name,title:`${term.rulerTitle}任命${term.personalName}为${city.name}郡守。`,metadata:{personId:term.personId,sourceUserId:term.sourceUserId,bornMonth:term.bornMonth,cityId:term.cityId,assignmentId,term:JSON.stringify(term)}};
   if(WorldHistory.addEvent(event)!==eventId)throw Error('Civil governor appointment history rejected');
   this.state.sequence=sequence;this.state.terms.push(term);return {...term};
  });
 }
 private end(month:number,term:CivilGovernorTerm,reason:CivilGovernorEndReason){
  if(term.endMonth!==undefined)return;
  transaction(()=>{
   const endEventId=`${term.assignmentId}-ended-${month}`,ended:CivilGovernorTerm={...term,endMonth:month,endReason:reason,endEventId};
   const event:WorldEvent={id:endEventId,year:month,monthIndex:month,type:'civil-governor-ended',category:'politics',importance:'normal',actorFactionId:term.factionId,factionIds:[term.factionId],cityId:term.cityId,cityName:term.cityName,title:`${term.personalName}${reason==='DEATH'?'卒，':''}离任${term.cityName}郡守。`,metadata:{personId:term.personId,sourceUserId:term.sourceUserId,bornMonth:term.bornMonth,cityId:term.cityId,assignmentId:term.assignmentId,endReason:reason,term:JSON.stringify(ended)}};
   if(WorldHistory.addEvent(event)!==endEventId)throw Error('Civil governor end history rejected');
   const row=this.state.terms.find(t=>t.assignmentId===term.assignmentId);if(!row)throw Error('Civil governor term missing');Object.assign(row,ended);
  });
 }
 private reconcile(month:number,teams:Team[],dynasties:Dynasty[]){
  for(const term of this.state.terms.filter(t=>active(t,month))){
   const team=teams.find(t=>t.name===term.factionId),city=teams.flatMap(t=>t.cities).find(c=>c.id===term.cityId),user=team&&[...team.users].find(u=>u.id===term.sourceUserId&&u.bornMonth===term.bornMonth),person=Military.getPerson(term.personId),dynasty=dynasties.find(d=>d.factionId===term.factionId),epoch=(dynasty?.houseEpochs??[]).find(e=>e.foundingRulerId===term.epochFounderId&&e.startMonth<=month&&(e.endMonth??Infinity)>month);
   let reason:CivilGovernorEndReason|undefined;
   if(!user||user.isDestroyed||person?.deathMonth!==undefined||person?.status==='DEAD')reason='DEATH';
   else if(!city||city.destroyed||city.ownerFactionId!==term.factionId)reason='CITY_LOST';
   else if(!team||team.status!=='ACTIVE'||team.identityStage!=='STATE')reason='FACTION_ENDED';
   else if(!epoch)reason='REGIME_ENDED';
   else if(person&&unresolvedCourtBans(person,term.factionId,month,term.epochFounderId).length)reason='POLITICAL_SANCTION';
   else if(person&&person.appointments.some(a=>a.factionId===term.factionId&&a.startMonth<=month&&(a.endMonth??Infinity)>month))reason='MILITARY_OFFICE';
   else if(!user.team.users.has(user)||user.team.name!==term.factionId)reason='IDENTITY_ENDED';
   if(reason)this.end(month,term,reason);
  }
 }
 private applyGovernance(month:number,teams:Team[]){
  for(const term of this.state.terms.filter(t=>active(t,month))){
   if(term.lastEffectMonth!==undefined&&month-term.lastEffectMonth<12)continue;
   const team=teams.find(t=>t.name===term.factionId),city=team?.cities.find(c=>c.id===term.cityId);
   if(!team||!city)continue;
   const effect=civilGovernanceEffect(term,city,month,this.state.policy);if(!effect.loyalty&&!effect.devastation)continue;
   transaction(()=>{
    const row=this.state.terms.find(t=>t.assignmentId===term.assignmentId)!;
    if(effect.loyalty)city.loyalty=Math.min(80,city.loyalty+effect.loyalty);
    if(effect.devastation)city.devastation=Math.max(0,city.devastation-effect.devastation);
    row.loyaltyRecovered+=effect.loyalty;row.devastationRecovered+=effect.devastation;row.lastEffectMonth=month;
    if(!row.meritEventId&&row.loyaltyRecovered+row.devastationRecovered>=3){
     const id=`${row.assignmentId}-merit-${month}`,event:WorldEvent={id,year:month,monthIndex:month,type:'civil-governor-merit',category:'politics',importance:'normal',actorFactionId:row.factionId,factionIds:[row.factionId],cityId:row.cityId,cityName:row.cityName,title:`${row.personalName}治理${row.cityName}有绩。`,description:`任郡守${month-row.startMonth}个月，城市忠诚恢复${row.loyaltyRecovered}，战乱创伤恢复${row.devastationRecovered}。`,metadata:{personId:row.personId,sourceUserId:row.sourceUserId,bornMonth:row.bornMonth,cityId:row.cityId,assignmentId:row.assignmentId,loyaltyRecovered:row.loyaltyRecovered,devastationRecovered:row.devastationRecovered}};
     if(WorldHistory.addEvent(event)!==id)throw Error('Civil governor merit history rejected');row.meritMonth=month;row.meritEventId=id;row.meritLoyaltyRecovered=row.loyaltyRecovered;row.meritDevastationRecovered=row.devastationRecovered;
    }
   });
  }
 }
}

const CivilAdministration=new CivilAdministrationStore();
export default CivilAdministration;
