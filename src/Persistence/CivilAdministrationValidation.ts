import type {WorldSaveV1} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import {isCivilGovernancePolicy} from '../Politics/CivilAdministrationSchema';

const endReasons=new Set(['DEATH','CITY_LOST','FACTION_ENDED','REGIME_ENDED','POLITICAL_SANCTION','MILITARY_OFFICE','REPLACED','IDENTITY_ENDED']);
const sources=new Set(['ORDINARY_RESIDENT','FAMILY','NOBLE','ROYAL','RETIRED_MILITARY']);

export function validateCivilAdministration(save:WorldSaveV1){
 const errors:string[]=[],state=save.registries.civilAdministration,events=save.worldHistory.events as WorldEvent[],byId=new Map(events.map((event,index)=>[event.id,{event,index}])),seenAssignments=new Set<string>(),seenEvents=new Set<string>();
 if(!state||state.version!==1||!isCivilGovernancePolicy(state.policy)||!Number.isSafeInteger(state.sequence)||state.sequence<0||!Number.isSafeInteger(state.lastEvaluationMonth)||!Array.isArray(state.terms))return ['invalid civil administration registry'];
 const activeCities=new Set<string>(),activePeople=new Set<string>();
 for(const term of state.terms)try{
  const activeCity=save.cities.find(city=>city.cityId===term.cityId),archivedCity=(save.registries.archivedCities as Array<{id?:string;name?:string}>|undefined)?.find(city=>city.id===term.cityId),city=activeCity??archivedCity,faction=save.factions.find(faction=>faction.factionId===term.factionId),user=save.users.find(user=>user.userId===term.sourceUserId&&user.bornMonth===term.bornMonth);
  if(term.version!==1||!term.assignmentId||seenAssignments.has(term.assignmentId)||!term.personId||!sources.has(term.identitySource)||!Number.isSafeInteger(term.sourceUserId)||!Number.isSafeInteger(term.bornMonth)||!Number.isSafeInteger(term.startMonth)||term.startMonth<0||term.startMonth>save.world.worldMonth||term.startMonth%12!==0||!Number.isSafeInteger(term.loyaltyRecovered)||term.loyaltyRecovered<0||!Number.isSafeInteger(term.devastationRecovered)||term.devastationRecovered<0)throw Error('invalid civil governor basic fields');
  if(!city||(activeCity&&activeCity.cityId!==term.cityId))throw Error('invalid civil governor city reference');if(term.cityName!==city.name)throw Error('civil governor historical city name mismatch');if(!faction)throw Error('invalid civil governor faction reference');if(term.countryName.length===0||!term.epochFounderId||!term.rulerId||!term.rulerTitle)throw Error('invalid civil governor authority fields');
  if(term.familyId){const family=save.registries.militaryCommandRegistry.families?.find(family=>family.familyId===term.familyId),member=family?.members.find(member=>member.memberId===term.familyMemberId);if(!family||family.factionId!==term.factionId||!member||member.sourceUserId!==term.sourceUserId||member.bornMonth!==term.bornMonth)throw Error('invalid civil governor family identity');}
  const start=byId.get(term.appointEventId),appointment:any=start&&typeof start.event.metadata?.term==='string'?JSON.parse(String(start.event.metadata.term)):undefined;
  if(!start||start.event.type!=='civil-governor-appointed'||start.event.actorFactionId!==term.factionId||(start.event.monthIndex??start.event.year)!==term.startMonth||start.event.cityId!==term.cityId||start.event.metadata?.assignmentId!==term.assignmentId||start.event.metadata?.personId!==term.personId||start.event.metadata?.sourceUserId!==term.sourceUserId||!appointment||appointment.assignmentId!==term.assignmentId||appointment.personId!==term.personId||appointment.sourceUserId!==term.sourceUserId||appointment.bornMonth!==term.bornMonth||appointment.factionId!==term.factionId||appointment.cityId!==term.cityId||appointment.startMonth!==term.startMonth||appointment.appointEventId!==term.appointEventId||appointment.loyaltyRecovered!==0||appointment.devastationRecovered!==0||seenEvents.has(start.event.id))throw Error('invalid civil governor appointment source');
  seenEvents.add(start.event.id);
  if(term.endMonth===undefined){
   if(term.endReason!==undefined||term.endEventId!==undefined||activeCities.has(term.cityId)||activePeople.has(term.personId)||!user||!activeCity||activeCity.ownerFactionId!==term.factionId||faction.status!=='ACTIVE'||faction.identityStage!=='STATE'||!user.factionId||user.factionId!==term.factionId)throw Error('invalid active civil governor');
   activeCities.add(term.cityId);activePeople.add(term.personId);
  }else{
   const end=term.endEventId?byId.get(term.endEventId):undefined;
   if(!Number.isSafeInteger(term.endMonth)||term.endMonth<term.startMonth||term.endMonth>save.world.worldMonth||!term.endReason||!endReasons.has(term.endReason)||!end||end.event.type!=='civil-governor-ended'||end.event.actorFactionId!==term.factionId||(end.event.monthIndex??end.event.year)!==term.endMonth||end.event.metadata?.assignmentId!==term.assignmentId||end.event.metadata?.endReason!==term.endReason||end.event.metadata?.term!==JSON.stringify(term)||seenEvents.has(end.event.id))throw Error('invalid civil governor end source');
   seenEvents.add(end.event.id);
  }
  if(term.meritEventId){const merit=byId.get(term.meritEventId);if(!merit||merit.event.type!=='civil-governor-merit'||(merit.event.monthIndex??merit.event.year)!==term.meritMonth||merit.event.metadata?.assignmentId!==term.assignmentId||merit.event.metadata?.personId!==term.personId||merit.event.metadata?.loyaltyRecovered!==term.meritLoyaltyRecovered||merit.event.metadata?.devastationRecovered!==term.meritDevastationRecovered||seenEvents.has(merit.event.id))throw Error('invalid civil governor merit source');seenEvents.add(merit.event.id);}
  if(Number(term.assignmentId.split('-').at(-1))>state.sequence)throw Error('civil governor sequence exceeded');
  seenAssignments.add(term.assignmentId);
 }catch(error){errors.push(`invalid civil governor ${term?.assignmentId??'unknown'}: ${String(error)}`);}
 for(const event of events){
  if(event.type==='civil-governor-appointed'&&!seenEvents.has(event.id))errors.push('orphan civil governor appointment');
  if(event.type==='civil-governor-ended'&&!seenEvents.has(event.id))errors.push('orphan civil governor end');
  if(event.type==='civil-governor-merit'&&!seenEvents.has(event.id))errors.push('orphan civil governor merit');
 }
 return errors;
}
