import {civilNobleMerit} from './CivilNobility';
import {currentNobleGrant,NOBLE_RANKS} from './MilitaryNobility';
import {familyNobleRankAt} from './FamilyNobleSuccession';
import {civilPromotionEvidence} from './CivilPromotion';
import {CIVIL_OFFICES,civilOfficeLevel,civilOfficeTitle,isLocalCivilOffice,civilOfficeCap} from './CivilOffice';
import {politicalMutationActive} from '../Simulation/PoliticalMutationScope';
import {isRoyalTitleLabel} from './RoyalPopulationIdentity';
import {civilState,replaceCivilState,emptyCivilState} from './CivilCareerIdentity';
import {deriveNameCulture,generateResidentPersonalName} from './NameCulture';
import {isPopulationIdentityLabel} from './MilitaryPersonIdentity';
import type City from '../Components/City';
import type Team from '../Components/Team';
import type {Dynasty} from './Dynasty';
import Military from './MilitaryCommandRegistry';
import DynastyRegistry from './Dynasty';
import WorldHistory,{type WorldEvent} from '../History/WorldHistory';
import {beginPoliticalMutation} from '../Simulation/PoliticalMutationScope';
import worldRandom,{WorldRandom} from '../Simulation/WorldRandom';
import {unresolvedCourtBans} from './MilitaryCourtStanding';
import {CIVIL_APPOINTMENT_CHANCE,MAX_ACTIVE_CIVIL_GOVERNORS_PER_FACTION,type CivilAdministrationState,type CivilGovernancePolicy,type CivilGovernorCandidate,type CivilGovernorEndReason,type CivilGovernorTerm} from './CivilAdministrationSchema';
export {CIVIL_APPOINTMENT_CHANCE,CIVIL_CITY_STABILITY_MONTHS,CIVIL_GOVERNANCE_POLICY,MAX_ACTIVE_CIVIL_GOVERNORS_PER_FACTION,civilGovernanceThreshold,isCivilGovernancePolicy} from './CivilAdministrationSchema';
export type {CivilAdministrationState,CivilGovernancePolicy,CivilGovernorCandidate,CivilGovernorEndReason,CivilGovernorSource,CivilGovernorTerm} from './CivilAdministrationSchema';
export {civilControlledSince,civilGovernanceEffect,civilGovernorCandidates,civilGovernorPersonId,civilGovernorStatus,eligibleCivilCities,selectCivilGovernorCandidate} from './CivilAdministrationRules';
import {civilGovernanceEffect,civilGovernorCandidates,eligibleCivilCities,selectCivilGovernorCandidate} from './CivilAdministrationRules';

const active=(term:CivilGovernorTerm,month:number)=>term.startMonth<=month&&term.endMonth===undefined;

function transaction<T>(work:()=>T,rollback:()=>void=()=>{}):T{
 if(politicalMutationActive())return work();
 const before=CivilAdministration.exportState(),history=WorldHistory.snapshotAppendTransaction(),rng=worldRandom.exportState(),scope=beginPoliticalMutation();
 try{const value=work();scope.commit();return value;}catch(error){scope.cancel();rollback();worldRandom.restore(rng);CivilAdministration.importState(before);const restore=beginPoliticalMutation();WorldHistory.rollbackAppendTransaction(history);restore.finishRollback();throw error;}
}

class CivilAdministrationStore {
 private get state(){return civilState();}
 private set state(value:CivilAdministrationState){replaceCivilState(value);}
 reset(){this.state=emptyCivilState();}
 setPolicyForSimulation(policy:CivilGovernancePolicy){this.state.policy=policy;}
 exportState():CivilAdministrationState{return structuredClone(this.state);}
 importState(state:CivilAdministrationState){this.state=structuredClone(state);this.state.terms=(this.state.terms??[]).map(term=>({...term}));}
 getTerms(factionId?:string){return (factionId?this.state.terms.filter(term=>term.factionId===factionId):this.state.terms).map(term=>({...term}));}
 getCurrentByCity(cityId:string,month:number){const term=this.state.terms.filter(term=>term.cityId===cityId&&active(term,month)).at(-1);return term?{...term}:undefined;}
 getByPopulation(sourceUserId:number,bornMonth:number){return this.state.terms.find(t=>t.sourceUserId===sourceUserId&&t.bornMonth===bornMonth);}
 getByPerson(personId:string){return this.state.terms.filter(term=>term.personId===personId).map(term=>({...term}));}
 getCandidateDiagnostics(month:number,teams:readonly Team[],dynasties:readonly Dynasty[]){return teams.map(team=>{
  const dynasty=dynasties.find(d=>d.factionId===team.name),ruler=dynasty?.rulers.find(r=>r.id===dynasty.currentRulerId),epoch=(dynasty?.houseEpochs??[]).find(e=>e.startMonth<=month&&(e.endMonth??Infinity)>month),cities=eligibleCivilCities(month,team,this.state.terms),current=this.state.terms.filter(t=>t.factionId===team.name&&active(t,month)).length;
  const pool=epoch&&ruler?.status==='ruling'?civilGovernorCandidates(month,team,Military.getPeople(),this.state.terms,epoch.foundingRulerId,(id,born)=>Military.getFamilyMember(id,born),Military.getFormations(),DynastyRegistry.getAll()):[];
  return {factionId:team.name,scope:'CURRENT_SNAPSHOT',eligibleCities:cities.length,hasVacancy:cities.length>0&&current<Math.min(MAX_ACTIVE_CIVIL_GOVERNORS_PER_FACTION,Math.max(1,Math.ceil(team.cities.length/4))),candidates:pool.length,retiredMilitary:pool.filter(p=>p.identitySource==='RETIRED_MILITARY').length};
 });}
 getDiagnostics(month:number){const terms=this.state.terms,ended=terms.filter(t=>t.endMonth!==undefined);return {appointed:terms.length,active:terms.filter(t=>active(t,month)).length,ended:ended.length,endReasons:ended.reduce((out,t)=>(out[t.endReason!]=(out[t.endReason!]??0)+1,out),{} as Record<string,number>),loyaltyRecovered:terms.reduce((n,t)=>n+t.loyaltyRecovered,0),devastationRecovered:terms.reduce((n,t)=>n+t.devastationRecovered,0),merits:terms.filter(t=>t.meritEventId).length};}
 update(month:number,teams:Team[],dynasties:Dynasty[]){
  this.reconcile(month,teams,dynasties);
  this.applyGovernance(month,teams);
  if(month%12!==0||month===this.state.lastEvaluationMonth)return;
  this.state.lastEvaluationMonth=month;
  for(const team of teams.filter(team=>team.status==='ACTIVE'&&team.identityStage==='STATE')){
   const dynasty=dynasties.find(d=>d.factionId===team.name),ruler=dynasty?.rulers.find(r=>r.id===dynasty.currentRulerId),epoch=ruler&&(dynasty?.houseEpochs??[]).find(e=>e.startMonth<=month&&(e.endMonth??Infinity)>=month);
   if(!dynasty||!ruler||!epoch||ruler.status!=='ruling'||ruler.accessionYear===undefined||ruler.accessionYear>month||ruler.endYear!==undefined||ruler.deathMonth!==undefined)continue;
   this.promoteCandidates(month,team,dynasty);
   this.rewardMerit(month,team,dynasty);
   const current=this.state.terms.filter(term=>term.factionId===team.name&&active(term,month));
   if(current.length>=Math.min(MAX_ACTIVE_CIVIL_GOVERNORS_PER_FACTION,Math.max(1,Math.ceil(team.cities.length/4))))continue;
   if(this.state.terms.some(term=>term.factionId===team.name&&term.startMonth>=month&&term.startMonth<month+12))continue;
   const eligibleCities=eligibleCivilCities(month,team,this.state.terms),candidates=civilGovernorCandidates(month,team,Military.getPeople(),this.state.terms,epoch.foundingRulerId,(id,bornMonth)=>Military.getFamilyMember(id,bornMonth),Military.getFormations(),DynastyRegistry.getAll());
   if(!eligibleCities.length||!candidates.length)continue;
   const rng=new WorldRandom();rng.initialize(`civil-administration-v1:${worldRandom.exportState().seed}:${team.name}:${month}`);
   if(rng.next()>=CIVIL_APPOINTMENT_CHANCE[this.state.policy])continue;
   const city=eligibleCities[Math.min(eligibleCities.length-1,Math.floor(rng.next()*eligibleCities.length))],candidate=selectCivilGovernorCandidate(candidates,rng.next())!;
   this.appoint(month,team,city,candidate,dynasty);
  }
 }
 appoint(month:number,team:Team,city:City,candidate:CivilGovernorCandidate,dynasty:Dynasty){
  const ruler=dynasty.rulers.find(r=>r.id===dynasty.currentRulerId),epoch=ruler&&(dynasty.houseEpochs??[]).find(e=>e.startMonth<=month&&(e.endMonth??Infinity)>=month);
  if(this.state.terms.filter(t=>t.factionId===team.name&&active(t,month)).length>=civilOfficeCap(team.cities.length)||!ruler||!epoch||!eligibleCivilCities(month,team,this.state.terms).some(c=>c.id===city.id)||!civilGovernorCandidates(month,team,Military.getPeople(),this.state.terms,epoch.foundingRulerId,(id,bornMonth)=>Military.getFamilyMember(id,bornMonth),Military.getFormations(),DynastyRegistry.getAll()).some(c=>c.personId===candidate.personId))throw Error('Invalid civil governor appointment');
  candidate=civilGovernorCandidates(month,team,Military.getPeople(),this.state.terms,epoch.foundingRulerId,(id,bornMonth)=>Military.getFamilyMember(id,bornMonth),Military.getFormations(),DynastyRegistry.getAll()).find(c=>c.personId===candidate.personId&&c.sourceUserId===candidate.sourceUserId&&c.bornMonth===candidate.bornMonth)??(()=>{throw Error('Civil population identity mismatch');})();
  return Military.civilTransaction(team,()=>transaction(()=>{
   const sequence=this.state.sequence+1,assignmentId=`civil-governor-${team.name}-${city.id}-${sequence}`,eventId=`${assignmentId}-appointed`;
   const user=[...team.users].find(u=>u.id===candidate.sourceUserId&&u.bornMonth===candidate.bornMonth)!;
   const previous=this.getByPopulation(user.id,user.bornMonth),family=Military.getFamilyMember(user.id,user.bornMonth),person=Military.getPerson(candidate.personId);
   const established=previous?.personalName??person?.personalName??family?.member.name??((!isPopulationIdentityLabel(user.name)||user.id<1000000000||user.id>1999999999)&&!isRoyalTitleLabel(user.name,DynastyRegistry.getAll())?user.name:undefined);
   const nameEvidence=previous?.nameEvidence??{seed:worldRandom.exportState().seed,culture:deriveNameCulture(team.houseName),originalName:user.name,source:established?'ESTABLISHED' as const:'GENERATED' as const};
   const personalName=established??generateResidentPersonalName({seed:nameEvidence.seed,sourceUserId:user.id,bornMonth:user.bornMonth,culture:nameEvidence.culture});
   const term:CivilGovernorTerm={office:'XIANLING',receipts:[],nameEvidence,version:1,assignmentId,personId:previous?.personId??candidate.personId,sourceUserId:candidate.sourceUserId,bornMonth:candidate.bornMonth,personalName,identitySource:candidate.identitySource,familyId:candidate.familyId,familyMemberId:candidate.familyMemberId,royalRulerId:candidate.royalRulerId,factionId:team.name,countryName:team.displayName??team.name,epochFounderId:epoch.foundingRulerId,cityId:city.id,cityName:city.name,rulerId:ruler.id,rulerTitle:DynastyRegistry.getRulerHistoricalTitle(ruler.id,team.name,month)??`${team.displayName??team.name}君主`,startMonth:month,appointEventId:eventId,loyaltyRecovered:0,devastationRecovered:0};
   const event:WorldEvent={id:eventId,year:month,monthIndex:month,type:'civil-governor-appointed',category:'politics',importance:'major',actorFactionId:team.name,factionIds:[team.name],rulerId:ruler.id,cityId:city.id,cityName:city.name,title:`${term.rulerTitle}任命${term.personalName}为${civilOfficeTitle(term)}。`,metadata:{personId:term.personId,sourceUserId:term.sourceUserId,bornMonth:term.bornMonth,cityId:term.cityId,assignmentId,term:JSON.stringify(term)}};
   if(WorldHistory.addEvent(event)!==eventId)throw Error('Civil governor appointment history rejected');
   this.state.sequence=sequence;this.state.terms.push(term);Military.registerCivilPerson(user,term);return {...term};
  }));
 }
 private rewardMerit(month:number,team:Team,dynasty:Dynasty){
  const ruler=dynasty.rulers.find(r=>r.id===dynasty.currentRulerId);if(!ruler||ruler.status!=='ruling'||ruler.deathMonth!==undefined||!['KING','EMPEROR'].includes(team.sovereigntyRank))return;
  for(const term of this.state.terms.filter(t=>t.factionId===team.name&&active(t,month))){
   const p=Military.getPerson(term.personId),user=[...team.users].find(u=>u.id===term.sourceUserId&&u.bornMonth===term.bornMonth);if(!p||!user||user.isDestroyed||unresolvedCourtBans(p,team.name,month,term.epochFounderId).length||(p.nobilityHistory??[]).some(g=>g.month===month)||(p.honorHistory??[]).some(h=>h.kind==='REVOKED'&&h.factionId===team.name&&h.epochFounderId===term.epochFounderId))continue;
   const personal=currentNobleGrant(p,team.name,month,term.epochFounderId)?.rank,link=Military.getFamilyMember(p.sourceUserId,p.bornMonth),inherited=link&&link.family.factionId===team.name&&link.family.epochFounderId===term.epochFounderId?familyNobleRankAt(link.family,link.member,month):undefined,previous=personal&&inherited?(NOBLE_RANKS.indexOf(personal)>NOBLE_RANKS.indexOf(inherited)?personal:inherited):personal??inherited;
   const merit=civilNobleMerit(p,this.state.terms.filter(t=>t.factionId===team.name&&t.epochFounderId===term.epochFounderId),month,user.loyalty,previous);if(!merit)continue;
   const rng=new WorldRandom();rng.initialize(`civil-peerage-v1:${worldRandom.exportState().seed}:${p.personId}:${team.name}:${month}`);if(rng.next()>=.08)continue;
   Military.civilTransaction(team,()=>Military.recordCivilNoble(p,{...merit,basis:'CIVIL',eventId:`civil-noble-${p.personId}-${term.epochFounderId}-${merit.rank}`,personId:p.personId,sourceUserId:p.sourceUserId,bornMonth:p.bornMonth,personalName:p.personalName,factionId:team.name,countryName:team.displayName??team.name,epochFounderId:term.epochFounderId,rulerId:ruler.id,rulerTitle:DynastyRegistry.getRulerHistoricalTitle(ruler.id,team.name,month)??ruler.givenName,month,previousRank:previous??'NONE',commandId:'',captureEventIds:[],cityIds:[],importantCityIds:[],importantEventIds:[]}));
  }
 }
 private promoteCandidates(month:number,team:Team,dynasty:Dynasty){
  const rows=this.state.terms.filter(t=>t.factionId===team.name&&active(t,month)).flatMap(term=>{const user=[...team.users].find(u=>u.id===term.sourceUserId&&u.bornMonth===term.bornMonth),e=user&&civilPromotionEvidence(term,month,user.loyalty,team.cities.length,this.state.terms);return e?[{term,weight:1+e.strategy/100+Math.min(1,e.contribution/20)}]:[];});
  if(!rows.length)return;
  const rng=new WorldRandom();rng.initialize(`civil-promotion-v1:${worldRandom.exportState().seed}:${team.name}:${month}`);
  if(rng.next()>=.35)return;
  let draw=rng.next()*rows.reduce((sum,r)=>sum+r.weight,0);const selected=rows.find(r=>(draw-=r.weight)<0)??rows.at(-1)!;
  this.promote(month,selected.term,team,dynasty);
 }
 promote(month:number,term:CivilGovernorTerm,team:Team,dynasty:Dynasty){
  const current=this.state.terms.find(t=>t.assignmentId===term.assignmentId),user=[...team.users].find(u=>u.id===term.sourceUserId&&u.bornMonth===term.bornMonth),person=Military.getPerson(term.personId),ruler=dynasty.rulers.find(r=>r.id===dynasty.currentRulerId);
  const evidence=current&&user&&civilPromotionEvidence(current,month,user.loyalty,team.cities.length,this.state.terms);
  if(!current||!user||!evidence||user.isDestroyed||user.role!=='NORMAL'||user.rulerId||user.nativeRoyalRulerId||person?.deathMonth!==undefined||person?.politicalRulerId||person&&unresolvedCourtBans(person,team.name,month,term.epochFounderId).length||person?.appointments.some(a=>a.endMonth===undefined)||team.status!=='ACTIVE'||team.identityStage!=='STATE'||!ruler||ruler.status!=='ruling'||ruler.deathMonth!==undefined||dynasty.factionId!==team.name||term.factionId!==team.name||!(dynasty.houseEpochs??[]).some(e=>e.foundingRulerId===term.epochFounderId&&e.startMonth<=month&&(e.endMonth??Infinity)>month))throw Error('Invalid civil promotion');
  return Military.civilTransaction(team,()=>transaction(()=>{
   const office=CIVIL_OFFICES[civilOfficeLevel(current.office)+1];
   this.end(month,current,'PROMOTED');
   const sequence=this.state.sequence+1,assignmentId=`civil-governor-${team.name}-${sequence}`,eventId=`${assignmentId}-appointed`;
   const next:CivilGovernorTerm={...current,office,promotion:evidence,assignmentId,startMonth:month,appointEventId:eventId,receipts:[],loyaltyRecovered:0,devastationRecovered:0,rulerId:ruler.id,rulerTitle:DynastyRegistry.getRulerHistoricalTitle(ruler.id,team.name,month)??ruler.givenName,countryName:team.displayName??team.name};
   for(const key of ['endMonth','endReason','endEventId','lastEffectMonth','meritMonth','meritEventId','meritLoyaltyRecovered','meritDevastationRecovered'] as const)delete next[key];
   if(!isLocalCivilOffice(office)){delete next.cityId;delete next.cityName;}
   if(WorldHistory.addEvent({id:eventId,year:month,monthIndex:month,type:'civil-governor-appointed',category:'politics',importance:'major',actorFactionId:team.name,factionIds:[team.name],rulerId:ruler.id,cityId:next.cityId,cityName:next.cityName,title:`${next.rulerTitle}以${next.personalName}治理有绩，由${civilOfficeTitle(current)}擢任${civilOfficeTitle(next)}。`,metadata:{personId:next.personId,sourceUserId:next.sourceUserId,bornMonth:next.bornMonth,assignmentId,term:JSON.stringify(next)}})!==eventId)throw Error('Civil promotion history rejected');
   this.state.sequence=sequence;this.state.terms.push(next);return {...next};
  }));
 }
 private end(month:number,term:CivilGovernorTerm,reason:CivilGovernorEndReason){
  if(term.endMonth!==undefined)return;
  transaction(()=>{
   const endEventId=`${term.assignmentId}-ended-${month}`,ended:CivilGovernorTerm={...term,endMonth:month,endReason:reason,endEventId};
   const event:WorldEvent={id:endEventId,year:month,monthIndex:month,type:'civil-governor-ended',category:'politics',importance:'normal',actorFactionId:term.factionId,factionIds:[term.factionId],cityId:term.cityId,cityName:term.cityName,title:`${term.personalName}${reason==='DEATH'?'卒，':''}离任${civilOfficeTitle(term)}。`,metadata:{personId:term.personId,sourceUserId:term.sourceUserId,bornMonth:term.bornMonth,cityId:term.cityId,assignmentId:term.assignmentId,endReason:reason,term:JSON.stringify(ended)}};
   if(WorldHistory.addEvent(event)!==endEventId)throw Error('Civil governor end history rejected');
   const row=this.state.terms.find(t=>t.assignmentId===term.assignmentId);if(!row)throw Error('Civil governor term missing');Object.assign(row,ended);
  });
 }
 private reconcile(month:number,teams:Team[],dynasties:Dynasty[]){
  for(const term of this.state.terms.filter(t=>active(t,month))){
   const team=teams.find(t=>t.name===term.factionId),city=teams.flatMap(t=>t.cities).find(c=>c.id===term.cityId),user=teams.flatMap(t=>[...t.users]).find(u=>u.id===term.sourceUserId&&u.bornMonth===term.bornMonth),person=Military.getPerson(term.personId),dynasty=dynasties.find(d=>d.factionId===term.factionId),epoch=(dynasty?.houseEpochs??[]).find(e=>e.foundingRulerId===term.epochFounderId&&e.startMonth<=month&&(e.endMonth??Infinity)>month);
   let reason:CivilGovernorEndReason|undefined;
   if(isLocalCivilOffice(term.office)&&(!city||city.destroyed||city.ownerFactionId!==term.factionId))reason='CITY_LOST';
   else if(!user||user.isDestroyed||person?.deathMonth!==undefined||person?.status==='DEAD')reason='DEATH';
   else if(user.team!==team||user.role!=='NORMAL'||user.rulerId||user.player.rulerId)reason='IDENTITY_ENDED';
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
   const team=teams.find(t=>t.name===term.factionId),city=isLocalCivilOffice(term.office)?team?.cities.find(c=>c.id===term.cityId):team?.cities.filter(c=>!c.destroyed&&c.ownerFactionId===term.factionId&&(c.loyalty<80||c.devastation>0)).sort((a,b)=>a.id.localeCompare(b.id))[0];
   if(!team||!city)continue;
   const effect=civilGovernanceEffect(term,city,month,this.state.policy);if(!effect.loyalty&&!effect.devastation)continue;
   const cityBefore={loyalty:city.loyalty,devastation:city.devastation};
   transaction(()=>{
    const row=this.state.terms.find(t=>t.assignmentId===term.assignmentId)!;
    if(effect.loyalty)city.loyalty=Math.min(80,city.loyalty+effect.loyalty);
    if(effect.devastation)city.devastation=Math.max(0,city.devastation-effect.devastation);
    const effectId=`${row.assignmentId}-effect-${month}`;
    const receipt={eventId:effectId,month,cityId:city.id,cityName:city.name,loyalty:effect.loyalty,devastation:effect.devastation};
    if(WorldHistory.addEvent({id:effectId,year:month,monthIndex:month,type:'civil-governor-effect',category:'politics',importance:'normal',actorFactionId:row.factionId,factionIds:[row.factionId],cityId:city.id,cityName:city.name,title:`${row.personalName}办理${city.name}恢复事务。`,metadata:{personId:row.personId,assignmentId:row.assignmentId,receipt:JSON.stringify(receipt)}})!==effectId)throw Error('Civil effect receipt rejected');
    (row.receipts??=[]).push(receipt);
    row.loyaltyRecovered+=effect.loyalty;row.devastationRecovered+=effect.devastation;row.lastEffectMonth=month;
    if(!row.meritEventId&&row.loyaltyRecovered+row.devastationRecovered>=3){
     const id=`${row.assignmentId}-merit-${month}`,event:WorldEvent={id,year:month,monthIndex:month,type:'civil-governor-merit',category:'politics',importance:'normal',actorFactionId:row.factionId,factionIds:[row.factionId],cityId:row.cityId,cityName:row.cityName,title:`${row.personalName}任${civilOfficeTitle(row)}有绩。`,description:`任${civilOfficeTitle(row)}${month-row.startMonth}个月，城市忠诚恢复${row.loyaltyRecovered}，战乱创伤恢复${row.devastationRecovered}。`,metadata:{personId:row.personId,sourceUserId:row.sourceUserId,bornMonth:row.bornMonth,cityId:row.cityId,assignmentId:row.assignmentId,loyaltyRecovered:row.loyaltyRecovered,devastationRecovered:row.devastationRecovered}};
     if(WorldHistory.addEvent(event)!==id)throw Error('Civil governor merit history rejected');row.meritMonth=month;row.meritEventId=id;row.meritLoyaltyRecovered=row.loyaltyRecovered;row.meritDevastationRecovered=row.devastationRecovered;
    }
   },()=>Object.assign(city,cityBefore));
  }
 }
}

const CivilAdministration=new CivilAdministrationStore();
export default CivilAdministration;
