import type City from '../Components/City';
import type Team from '../Components/Team';
import type {Dynasty} from './Dynasty';
import Military from './MilitaryCommandRegistry';
import DynastyRegistry from './Dynasty';
import WorldHistory,{type WorldEvent} from '../History/WorldHistory';
import {beginPoliticalMutation} from '../Simulation/PoliticalMutationScope';
import worldRandom,{WorldRandom} from '../Simulation/WorldRandom';
import {unresolvedCourtBans} from './MilitaryCourtStanding';
import {CIVIL_APPOINTMENT_CHANCE,CIVIL_GOVERNANCE_POLICY,MAX_ACTIVE_CIVIL_GOVERNORS_PER_FACTION,type CivilAdministrationState,type CivilGovernancePolicy,type CivilGovernorCandidate,type CivilGovernorEndReason,type CivilGovernorTerm} from './CivilAdministrationSchema';
export {CIVIL_APPOINTMENT_CHANCE,CIVIL_CITY_STABILITY_MONTHS,CIVIL_GOVERNANCE_POLICY,MAX_ACTIVE_CIVIL_GOVERNORS_PER_FACTION,civilGovernanceThreshold,isCivilGovernancePolicy} from './CivilAdministrationSchema';
export type {CivilAdministrationState,CivilGovernancePolicy,CivilGovernorCandidate,CivilGovernorEndReason,CivilGovernorSource,CivilGovernorTerm} from './CivilAdministrationSchema';
export {civilControlledSince,civilGovernanceEffect,civilGovernorCandidates,civilGovernorPersonId,civilGovernorStatus,eligibleCivilCities,selectCivilGovernorCandidate} from './CivilAdministrationRules';
import {civilGovernanceEffect,civilGovernorCandidates,eligibleCivilCities,selectCivilGovernorCandidate} from './CivilAdministrationRules';

const empty=():CivilAdministrationState=>({version:1,sequence:0,lastEvaluationMonth:-1,policy:CIVIL_GOVERNANCE_POLICY,terms:[]});
const active=(term:CivilGovernorTerm,month:number)=>term.startMonth<=month&&term.endMonth===undefined;

function transaction<T>(work:()=>T):T{
 const before=structuredClone(CivilAdministration.exportState()),history=WorldHistory.snapshotPoliticalTransaction(),scope=beginPoliticalMutation();
 try{const value=work();scope.commit();return value;}catch(error){scope.cancel();CivilAdministration.importState(before);const restore=beginPoliticalMutation();WorldHistory.rollbackPoliticalTransaction(history);restore.finishRollback();throw error;}
}

class CivilAdministrationStore {
 private state:CivilAdministrationState=empty();
 reset(){this.state=empty();}
 setPolicyForSimulation(policy:CivilGovernancePolicy){this.state.policy=policy;}
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
   const eligibleCities=eligibleCivilCities(month,team,this.state.terms),candidates=civilGovernorCandidates(month,team,Military.getPeople(),this.state.terms,epoch.foundingRulerId,(id,bornMonth)=>Military.getFamilyMember(id,bornMonth),Military.getFormations());
   if(!eligibleCities.length||!candidates.length)continue;
   const rng=new WorldRandom();rng.initialize(`civil-administration-v1:${worldRandom.exportState().seed}:${team.name}:${month}`);
   if(rng.next()>=CIVIL_APPOINTMENT_CHANCE[this.state.policy])continue;
   const city=eligibleCities[Math.min(eligibleCities.length-1,Math.floor(rng.next()*eligibleCities.length))],candidate=selectCivilGovernorCandidate(candidates,rng.next())!;
   this.appoint(month,team,city,candidate,dynasty);
  }
 }
 appoint(month:number,team:Team,city:City,candidate:CivilGovernorCandidate,dynasty:Dynasty){
  const ruler=dynasty.rulers.find(r=>r.id===dynasty.currentRulerId),epoch=ruler&&(dynasty.houseEpochs??[]).find(e=>e.startMonth<=month&&(e.endMonth??Infinity)>=month);
  if(!ruler||!epoch||!eligibleCivilCities(month,team,this.state.terms).some(c=>c.id===city.id)||!civilGovernorCandidates(month,team,Military.getPeople(),this.state.terms,epoch.foundingRulerId,(id,bornMonth)=>Military.getFamilyMember(id,bornMonth),Military.getFormations()).some(c=>c.personId===candidate.personId))throw Error('Invalid civil governor appointment');
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
   if(!city||city.destroyed||city.ownerFactionId!==term.factionId)reason='CITY_LOST';
   else if(!user||user.isDestroyed||person?.deathMonth!==undefined||person?.status==='DEAD')reason='DEATH';
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
