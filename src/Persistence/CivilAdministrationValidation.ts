import {CIVIL_OFFICES,isLocalCivilOffice,civilOfficeLevel} from '../Politics/CivilOffice';
import {civilPromotionEvidence} from '../Politics/CivilPromotion';
import {getRulerUserId} from '../Politics/RoyalPopulationIdentity';
import {unresolvedCourtBans} from '../Politics/MilitaryCourtStanding';
import {isPopulationIdentityLabel} from '../Politics/MilitaryPersonIdentity';
import {deriveNameCulture,generateResidentPersonalName} from '../Politics/NameCulture';
import {residentNaturalDeathMonth} from '../Simulation/ResidentLife';
import type {WorldSaveV1} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import {isCivilGovernancePolicy} from '../Politics/CivilAdministrationSchema';

const endReasons=new Set(['DEATH','CITY_LOST','FACTION_ENDED','REGIME_ENDED','POLITICAL_SANCTION','MILITARY_OFFICE','REPLACED','IDENTITY_ENDED','PROMOTED']);
const sources=new Set(['ORDINARY_RESIDENT','FAMILY','NOBLE','ROYAL','RETIRED_MILITARY']);

export function validateCivilAdministration(save:WorldSaveV1){
 const errors:string[]=[],state=save.registries.civilAdministration,events=save.worldHistory.events as WorldEvent[],byId=new Map(events.map((event,index)=>[event.id,{event,index}])),seenAssignments=new Set<string>(),seenEvents=new Set<string>();
 if(!state||state.version!==1||!isCivilGovernancePolicy(state.policy)||!Number.isSafeInteger(state.sequence)||state.sequence<0||!Number.isSafeInteger(state.lastEvaluationMonth)||!Array.isArray(state.terms))return ['invalid civil administration registry'];
 const activeCities=new Set<string>(),activePeople=new Set<string>();
 for(const term of state.terms)try{
  const activeCity=save.cities.find(city=>city.cityId===term.cityId),archivedCity=(save.registries.archivedCities as Array<{id?:string;name?:string}>|undefined)?.find(city=>city.id===term.cityId),city=activeCity??archivedCity,faction=save.factions.find(faction=>faction.factionId===term.factionId),user=save.users.find(user=>user.userId===term.sourceUserId&&user.bornMonth===term.bornMonth);
  if(term.version!==1||!term.assignmentId||seenAssignments.has(term.assignmentId)||!term.personId||!sources.has(term.identitySource)||!Number.isSafeInteger(term.sourceUserId)||!Number.isSafeInteger(term.bornMonth)||!Number.isSafeInteger(term.startMonth)||term.startMonth<0||term.startMonth>save.world.worldMonth||term.startMonth%12!==0||!Number.isSafeInteger(term.loyaltyRecovered)||term.loyaltyRecovered<0||!Number.isSafeInteger(term.devastationRecovered)||term.devastationRecovered<0)throw Error('invalid civil governor basic fields');
  if(!term.office||!CIVIL_OFFICES.includes(term.office)||!Array.isArray(term.receipts))throw Error('missing civil office or recovery receipts');
  if(isLocalCivilOffice(term.office)&&(!city||(activeCity&&activeCity.cityId!==term.cityId)))throw Error('invalid civil governor city reference');if(isLocalCivilOffice(term.office)&&term.cityName!==city?.name)throw Error('civil governor historical city name mismatch');if(!faction)throw Error('invalid civil governor faction reference');if(term.countryName.length===0||!term.epochFounderId||!term.rulerId||!term.rulerTitle)throw Error('invalid civil governor authority fields');
  if(!isLocalCivilOffice(term.office)&&(term.cityId!==undefined||term.cityName!==undefined))throw Error('central office cannot own a local city');
  if(save.dynasties.some(d=>(d.rulers as any[]).some(r=>r.bornMonth===term.bornMonth&&((r.residentIdentity?.sourceUserId===term.sourceUserId)||(r.militaryIdentity?.sourceUserId===term.sourceUserId)||(getRulerUserId(r.rulerId)===term.sourceUserId))&&r.accessionMonth!==undefined&&r.accessionMonth<=term.startMonth)))throw Error('enthroned royal cannot enter ordinary civil recruitment');
  if(term.familyId){const family=save.registries.militaryCommandRegistry.families?.find(family=>family.familyId===term.familyId),member=family?.members.find(member=>member.memberId===term.familyMemberId);if(!family||family.factionId!==term.factionId||!member||member.sourceUserId!==term.sourceUserId||member.bornMonth!==term.bornMonth)throw Error('invalid civil governor family identity');}
  const start=byId.get(term.appointEventId),appointment:any=start&&typeof start.event.metadata?.term==='string'?JSON.parse(String(start.event.metadata.term)):undefined;
  if(!start||start.event.type!=='civil-governor-appointed'||start.event.actorFactionId!==term.factionId||(start.event.monthIndex??start.event.year)!==term.startMonth||start.event.cityId!==term.cityId||start.event.metadata?.assignmentId!==term.assignmentId||start.event.metadata?.personId!==term.personId||start.event.metadata?.sourceUserId!==term.sourceUserId||!appointment||appointment.assignmentId!==term.assignmentId||appointment.personId!==term.personId||appointment.sourceUserId!==term.sourceUserId||appointment.bornMonth!==term.bornMonth||appointment.factionId!==term.factionId||appointment.cityId!==term.cityId||appointment.startMonth!==term.startMonth||appointment.appointEventId!==term.appointEventId||appointment.office!==term.office||JSON.stringify(appointment.promotion)!==JSON.stringify(term.promotion)||appointment.loyaltyRecovered!==0||appointment.devastationRecovered!==0||seenEvents.has(start.event.id))throw Error('invalid civil governor appointment source');
  const evidence=term.nameEvidence,prior=state.terms.find(t=>t!==term&&t.sourceUserId===term.sourceUserId&&t.bornMonth===term.bornMonth&&t.startMonth<term.startMonth),person=save.registries.militaryCommandRegistry.people.find(p=>p.sourceUserId===term.sourceUserId&&p.bornMonth===term.bornMonth);
  if(!evidence||!['HAN','KHITAN','JURCHEN','MONGOL','MANCHU'].includes(evidence.culture)||typeof evidence.seed!=='string'||typeof evidence.originalName!=='string'||!['GENERATED','ESTABLISHED'].includes(evidence.source)||!term.personalName?.trim()||appointment.personalName!==term.personalName||JSON.stringify(appointment.nameEvidence)!==JSON.stringify(evidence))throw Error('invalid frozen civil name evidence');
  if(evidence.source==='GENERATED'&&term.personalName!==generateResidentPersonalName({seed:evidence.seed,culture:evidence.culture,sourceUserId:term.sourceUserId,bornMonth:term.bornMonth}))throw Error('civil generated name mismatch');
  if(user&&evidence.originalName!==user.name)throw Error('civil original population label mismatch');
  const authority=(save.dynasties.find(d=>d.factionId===term.factionId)?.rulers as Record<string,unknown>[]|undefined)?.find(r=>r.rulerId===term.rulerId);
  if(!authority||Number(authority.accessionMonth)>term.startMonth||authority.endMonth!==undefined&&Number(authority.endMonth)<term.startMonth)throw Error('civil appointment lacks ruling authority');
  if(!prior&&evidence.source==='GENERATED'&&evidence.culture!==deriveNameCulture(String(authority.houseName)))throw Error('civil name culture lacks first authority source');
  if(evidence.seed!==save.worldRandom.seed)throw Error('civil name seed mismatch');
  if(evidence.source==='ESTABLISHED'&&!prior){const family=save.registries.militaryCommandRegistry.families?.flatMap(f=>f.members).find(m=>m.sourceUserId===term.sourceUserId&&m.bornMonth===term.bornMonth);if(term.personalName!==(person?.personalName??family?.name??(!isPopulationIdentityLabel(evidence.originalName)||term.sourceUserId<1000000000||term.sourceUserId>1999999999?evidence.originalName:undefined)))throw Error('civil established name lacks source');}
  const familyMember=term.familyId?save.registries.militaryCommandRegistry.families?.find(f=>f.familyId===term.familyId)?.members.find(m=>m.memberId===term.familyMemberId):undefined;
  if(!prior&&term.personId!==(person?.personId??familyMember?.memberId??`resident-${term.sourceUserId}-${term.bornMonth}`))throw Error('civil identity lacks permanent population source');
  if(term.startMonth-term.bornMonth<216||!term.promotion&&term.startMonth-term.bornMonth>900||person?.deathMonth!==undefined&&person.deathMonth<=term.startMonth||person&&unresolvedCourtBans(person,term.factionId,term.startMonth,term.epochFounderId).length)throw Error('civil appointment violates life or political qualification');
  if(prior&&(prior.personId!==term.personId||prior.personalName!==term.personalName||JSON.stringify(prior.nameEvidence)!==JSON.stringify(evidence)))throw Error('civil permanent identity changed');
  if(person&&(person.personId!==term.personId||person.personalName!==term.personalName))throw Error('civil military permanent identity mismatch');
  if(person?.civilOrigin&&(person.civilOrigin.assignmentId!==state.terms.find(t=>t.sourceUserId===term.sourceUserId&&t.bornMonth===term.bornMonth)?.assignmentId||person.civilOrigin.naturalDeathMonth!==residentNaturalDeathMonth(term.sourceUserId,term.bornMonth)))throw Error('civil military lifespan mismatch');
  if(person?.appointments.some(a=>a.startMonth<(term.endMonth??Infinity)&&(a.endMonth??Infinity)>term.startMonth))throw Error('civil military offices overlap');
  seenEvents.add(start.event.id);
  if(term.endMonth===undefined){
   if(term.endReason!==undefined||term.endEventId!==undefined||isLocalCivilOffice(term.office)&&activeCities.has(term.cityId!)||activePeople.has(term.personId)||!user||isLocalCivilOffice(term.office)&&(!activeCity||activeCity.ownerFactionId!==term.factionId)||faction.status!=='ACTIVE'||faction.identityStage!=='STATE'||!user.factionId||user.factionId!==term.factionId)throw Error('invalid active civil governor');
   if(isLocalCivilOffice(term.office))activeCities.add(term.cityId!);activePeople.add(term.personId);
  }else{
   const end=term.endEventId?byId.get(term.endEventId):undefined;
   if(!Number.isSafeInteger(term.endMonth)||term.endMonth<term.startMonth||term.endMonth>save.world.worldMonth||!term.endReason||!endReasons.has(term.endReason)||!end||end.event.type!=='civil-governor-ended'||end.event.actorFactionId!==term.factionId||(end.event.monthIndex??end.event.year)!==term.endMonth||end.event.metadata?.assignmentId!==term.assignmentId||end.event.metadata?.endReason!==term.endReason||end.event.metadata?.term!==JSON.stringify(term)||seenEvents.has(end.event.id))throw Error('invalid civil governor end source');
   seenEvents.add(end.event.id);
  }
  let loyalty=0,devastation=0;const receiptIds=new Set<string>();
  for(const receipt of term.receipts??[]){
   const ref=byId.get(receipt.eventId),month=receipt.month;
   if(receipt.eventId!==`${term.assignmentId}-effect-${month}`||receiptIds.has(receipt.eventId)||!ref||ref.event.type!=='civil-governor-effect'||ref.index<=start.index||term.endEventId!==undefined&&ref.index>=(byId.get(term.endEventId)?.index??-Infinity)||ref.event.metadata?.assignmentId!==term.assignmentId||ref.event.metadata?.personId!==term.personId||ref.event.metadata?.receipt!==JSON.stringify(receipt)||ref.event.cityId!==receipt.cityId||ref.event.cityName!==receipt.cityName||(ref.event.monthIndex??ref.event.year)!==month||month<=term.startMonth||(month-term.startMonth)%12!==0||month>(term.endMonth??save.world.worldMonth)||![0,1].includes(receipt.loyalty)||![0,1].includes(receipt.devastation)||!receipt.loyalty&&!receipt.devastation||isLocalCivilOffice(term.office)&&receipt.cityId!==term.cityId||seenEvents.has(receipt.eventId))throw Error('invalid civil recovery receipt');
   receiptIds.add(receipt.eventId);seenEvents.add(receipt.eventId);loyalty+=receipt.loyalty;devastation+=receipt.devastation;
  }
  if(loyalty!==term.loyaltyRecovered||devastation!==term.devastationRecovered||term.receipts!.length&&term.lastEffectMonth!==term.receipts!.at(-1)!.month)throw Error('civil recovery totals mismatch');
  if(term.promotion){
   const old=state.terms.find(t=>t.assignmentId===term.promotion!.fromAssignmentId),e=old&&civilPromotionEvidence({...old,endMonth:undefined,receipts:old.receipts?.filter(r=>r.month<=term.startMonth)},term.startMonth,term.promotion.loyalty,12,[]);
   if(term.promotion.meritEventIds.some(id=>(byId.get(id)?.index??Infinity)>=start.index)||!old||old.endReason!=='PROMOTED'||old.endMonth!==term.startMonth||old.personId!==term.personId||old.factionId!==term.factionId||civilOfficeLevel(term.office)!==civilOfficeLevel(old.office)+1||!e||JSON.stringify(e)!==JSON.stringify(term.promotion)||(byId.get(old.endEventId!)?.index??Infinity)>=start.index)throw Error('invalid civil promotion evidence');
  }else if(term.office!=='XIANLING')throw Error('initial civil appointment must start as county magistrate');
  if(term.meritEventId){const merit=byId.get(term.meritEventId);if(!merit||merit.event.type!=='civil-governor-merit'||(merit.event.monthIndex??merit.event.year)!==term.meritMonth||merit.event.metadata?.assignmentId!==term.assignmentId||merit.event.metadata?.personId!==term.personId||merit.event.metadata?.loyaltyRecovered!==term.meritLoyaltyRecovered||merit.event.metadata?.devastationRecovered!==term.meritDevastationRecovered||seenEvents.has(merit.event.id))throw Error('invalid civil governor merit source');seenEvents.add(merit.event.id);}
  if(Number(term.assignmentId.split('-').at(-1))>state.sequence)throw Error('civil governor sequence exceeded');
  seenAssignments.add(term.assignmentId);
 }catch(error){errors.push(`invalid civil governor ${term?.assignmentId??'unknown'}: ${String(error)}`);}
 for(let i=0;i<state.terms.length;i++)for(let j=i+1;j<state.terms.length;j++){
  const a=state.terms[i],b=state.terms[j];if(a.startMonth>=(b.endMonth??Infinity)||b.startMonth>=(a.endMonth??Infinity))continue;
  if(a.personId===b.personId||a.sourceUserId===b.sourceUserId&&a.bornMonth===b.bornMonth||a.factionId===b.factionId&&(isLocalCivilOffice(a.office)&&isLocalCivilOffice(b.office)&&a.cityId===b.cityId||!isLocalCivilOffice(a.office)&&a.office===b.office))errors.push('overlapping civil appointments');
 }
 for(const person of save.registries.militaryCommandRegistry.people){if(person.civilOrigin&&!state.terms.some(t=>t.assignmentId===person.civilOrigin?.assignmentId&&t.sourceUserId===person.sourceUserId&&t.bornMonth===person.bornMonth&&t.personId===person.personId&&t.personalName===person.personalName))errors.push('orphan civil military identity');}
 for(const event of events){
  if(event.type==='civil-governor-appointed'&&!seenEvents.has(event.id))errors.push('orphan civil governor appointment');
  if(event.type==='civil-governor-ended'&&!seenEvents.has(event.id))errors.push('orphan civil governor end');
  if(event.type==='civil-governor-effect'&&!seenEvents.has(event.id))errors.push('orphan civil recovery receipt');
  if(event.type==='civil-governor-merit'&&!seenEvents.has(event.id))errors.push('orphan civil governor merit');
 }
 return errors;
}
