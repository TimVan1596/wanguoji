import type {WorldSaveV1,RulerSaveV17} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import type {Dynasty} from '../Politics/Dynasty';
import type {MilitaryPerson} from '../Politics/MilitaryCommandRegistry';
import {importRulerSave} from './RulerSaveProjection';
import {familyAtEvidenceBoundary,createFamilyNobleContext,familyResidenceAt} from '../Politics/FamilyNobleSuccession';
import {familyBirthParents,planFamilyChildBirth,isFamilyBirthPolicy,familyChildForPopulationEntry,FAMILY_ANNUAL_BIRTH_LIMIT,COUNTRY_ANNUAL_FAMILY_BIRTH_LIMIT} from '../Politics/FamilyChildBirth';
/** Actual committed birth boundaries. Indexes live only for this validation call. */
export function validateFamilyChildren(save:WorldSaveV1){
 const errors:string[]=[],state=save.registries.militaryCommandRegistry,policy=state.familyBirthPolicy??'BASELINE';if(!isFamilyBirthPolicy(policy))return ['invalid family birth policy'];
 const families=state.families??[],events=save.worldHistory.events as WorldEvent[],positions=new Map(events.map((e,i)=>[e.id,i])),dynasties=save.dynasties.map(d=>({...d,rulers:(d.rulers as RulerSaveV17[]).map(importRulerSave)})) as Dynasty[],seen=new Set<string>(),admissions=new Set<string>();
 const commandEnds=new Map<string,number>(),deaths=new Map<string,number>();for(const [i,e] of events.entries()){if(e.type==='military-command-ended'&&typeof e.metadata?.commandId==='string'&&!commandEnds.has(e.metadata.commandId))commandEnds.set(e.metadata.commandId,i);if(e.type==='military-person-died'&&typeof e.metadata?.personId==='string'&&!deaths.has(e.metadata.personId))deaths.set(e.metadata.personId,i);}
 for(const f of families)for(const m of f.members){if(!m.birth){if(m.source==='HOUSEHOLD_BIRTH'||m.memberId.startsWith(`${f.familyId}-child-`))errors.push('missing real family birth');continue;}
  try{
   const b=m.birth,boundary=positions.get(b.eventId),e=boundary===undefined?undefined:events[boundary];
   if(policy==='BASELINE'||b.version!==1||b.policy!==policy||b.familyId!==f.familyId||b.factionId!==f.factionId||b.epochFounderId!==f.epochFounderId||b.parentMemberId!==m.parentMemberId||b.month!==m.bornMonth||m.enteredMonth!==b.month||b.month<f.foundedMonth||b.month>save.world.worldMonth||m.source!=='HOUSEHOLD_BIRTH'||!e||e.type!=='family-child-born'||e.actorFactionId!==f.factionId||(e.monthIndex??e.year)!==b.month||e.metadata?.familyId!==f.familyId||e.metadata?.memberId!==m.memberId||e.metadata?.parentMemberId!==m.parentMemberId||e.metadata?.familyBirth!==JSON.stringify(b)||seen.has(b.eventId)||boundary===undefined)throw Error('invalid birth identity/source');
   const before=(id:string)=>(positions.get(id)??Infinity)<boundary;
   if(!before(`${f.familyId}-founded`)||!before(b.basisEventId))throw Error('birth precedes charter or actual parental authority');
   const historical=familyAtEvidenceBoundary(f,b.month,boundary,events,positions),historicalPeople:MilitaryPerson[]=state.people.filter(p=>historical.members.some(m=>m.militaryPersonId===p.personId)).map(p=>{
    const appointments=p.appointments.filter(a=>before(`military-appointment-${a.commandId}`)).map(a=>({...a,...((commandEnds.get(a.commandId)??Infinity)>=boundary?{endMonth:undefined,endReason:undefined}:{}),officeHistory:a.officeHistory?.filter(o=>before(o.eventId))})),dead=(deaths.get(p.personId)??Infinity)<boundary,member=historical.members.find(m=>m.militaryPersonId===p.personId),acceded=p.politicalRulerId&&events.some((e,i)=>i<boundary&&(e.rulerId===p.politicalRulerId||e.metadata?.nextRulerId===p.politicalRulerId||e.metadata?.foundingRulerId===p.politicalRulerId)&&['ruler-acceded','ruler-succession','ruler-deposed','dynasty-usurped','empire-split'].includes(e.type));
    return {...p,appointments,status:dead?'DEAD':appointments.some(a=>a.endMonth===undefined)?'ACTIVE':'RETIRED',deathMonth:dead?p.deathMonth:undefined,politicalRulerId:acceded?p.politicalRulerId:undefined,factionId:member?familyResidenceAt(historical,member,b.month):p.factionId,nobilityHistory:p.nobilityHistory?.filter(g=>before(g.eventId)),honorHistory:p.honorHistory?.filter(g=>before(g.eventId)),politicalHistory:p.politicalHistory?.filter(a=>before(a.eventId))};
   });
   const annual=f.members.filter(ch=>ch.birth?.opportunityMonth===b.opportunityMonth&&before(ch.birth.eventId)).length,countryAnnual=families.filter(x=>x.factionId===f.factionId).reduce((n,x)=>n+x.members.filter(ch=>ch.birth?.opportunityMonth===b.opportunityMonth&&before(ch.birth.eventId)).length,0);
   if(annual>=FAMILY_ANNUAL_BIRTH_LIMIT||countryAnnual>=COUNTRY_ANNUAL_FAMILY_BIRTH_LIMIT)throw Error('annual birth cap exceeded');
   const c=createFamilyNobleContext(b.month,[historical],historicalPeople,events.slice(0,boundary),dynasties),expected=familyBirthParents(historical,c).map(({member,basisEventId})=>planFamilyChildBirth(f,{...member,basisEventId},b.month,String(save.worldRandom.seed),policy)).find(Boolean);
   if(e.title!==`${historical.members.find(p=>p.memberId===m.parentMemberId)?.name}之子${m.name}出生。`)throw Error('birth narrative identity mismatch');
   if(m.deathCause==='NATURAL_DEATH'&&(m.deathMonth??Infinity)<b.naturalDeathMonth)throw Error('natural death precedes fixed birth life');
   if(!expected||expected.memberId!==m.memberId||expected.name!==m.name||JSON.stringify(expected.birth)!==JSON.stringify(b))throw Error('deterministic birth/lifespan/parent replay mismatch');
   const entryId=`${m.memberId}-population-entered`,entryPosition=positions.get(entryId),entry=entryPosition===undefined?undefined:events[entryPosition];
   if(m.sourceUserId===undefined){if(m.populationEnteredMonth!==undefined||entry||m.militaryPersonId)throw Error('unmapped child has a false population identity');}
   else {if(!Number.isSafeInteger(m.sourceUserId)||!Number.isSafeInteger(m.populationEnteredMonth)||m.populationEnteredMonth!<m.bornMonth+216||!entry||entryPosition!<=boundary||entry.type!=='family-child-population-entered'||entry.actorFactionId!==f.factionId||(entry.monthIndex??entry.year)!==m.populationEnteredMonth||entry.metadata?.memberId!==m.memberId||entry.metadata?.familyId!==f.familyId||entry.metadata?.sourceUserId!==m.sourceUserId||entry.metadata?.bornMonth!==m.bornMonth||entry.metadata?.birthEventId!==b.eventId||entry.metadata?.populationCause!=='NATURAL_GROWTH')throw Error('invalid actual adult population entry');
    const atEntry=families.map(f=>familyAtEvidenceBoundary(f,m.populationEnteredMonth!,entryPosition!,events,positions)),selected=familyChildForPopulationEntry(atEntry,f.factionId,f.epochFounderId,m.sourceUserId,m.populationEnteredMonth!,String(save.worldRandom.seed));if(!createFamilyNobleContext(m.populationEnteredMonth!,atEntry,[],events.slice(0,entryPosition!),dynasties).activeEpochs.has(`${f.factionId}/${f.epochFounderId}`))throw Error('population entry has no original lawful epoch');if(selected?.member.memberId!==m.memberId)throw Error('population slot did not select this existing adult identity');admissions.add(entryId);
   }
   if(m.deathMonth!==undefined&&m.sourceUserId===undefined){const death=events.find(e=>e.id===`${f.familyId}-${m.memberId}-death`);if(m.deathMonth!==b.naturalDeathMonth||m.deathCause!=='NATURAL_DEATH'||death?.metadata?.birthEventId!==b.eventId)throw Error('invalid abstract child natural death');}
   if(m.sourceUserId!==undefined)for(const d of dynasties)for(const r of d.rulers)if(r.residentIdentity?.sourceUserId===m.sourceUserId&&r.bornYear===m.bornMonth&&r.naturalDeathYear!==b.naturalDeathMonth)throw Error('accession changed the original family child life');
   if(m.sourceUserId===undefined&&b.naturalDeathMonth<=save.world.worldMonth&&m.deathMonth===undefined)throw Error('missing actual child lifecycle death');
   const p=m.militaryPersonId?state.people.find(p=>p.personId===m.militaryPersonId):undefined;if(p&&JSON.stringify(p.familyLife)!==JSON.stringify({familyId:f.familyId,memberId:m.memberId,birthEventId:b.eventId,naturalDeathMonth:b.naturalDeathMonth}))throw Error('military bridge changed the original life');
   seen.add(b.eventId);
  }catch(error){errors.push(`invalid family child ${m.memberId}: ${String(error)}`);}
 }
 for(const e of events){if(e.type==='family-child-born'&&!seen.has(e.id))errors.push('orphan family birth');if(e.type==='family-child-population-entered'&&!admissions.has(e.id))errors.push('orphan family child population entry');}
 for(const p of state.people)if(p.familyLife&&!families.some(f=>f.familyId===p.familyLife!.familyId&&f.members.some(m=>m.memberId===p.familyLife!.memberId&&m.birth?.eventId===p.familyLife!.birthEventId&&m.militaryPersonId===p.personId&&m.sourceUserId===p.sourceUserId&&m.bornMonth===p.bornMonth)))errors.push('orphan military family life bridge');
 return errors;
}
