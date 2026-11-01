import {splitEstablishedPersonalName} from '../Politics/NameCulture';
import type {WorldSaveV1} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import {familyMemberId,familyFounderSource,familyAppointmentWeight} from '../Politics/MilitaryFamily';
export function validateMilitaryFamilies(save:WorldSaveV1){
 const errors:string[]=[],state=save.registries.militaryCommandRegistry,events=save.worldHistory.events as WorldEvent[],seen=new Set<string>(),residentIds=new Set<number>(),families=state.families;
 if(families!==undefined&&!Array.isArray(families))return ['invalid military families'];
 for(const f of families??[])try{
  const p=state.people.find(p=>p.personId===f.founderPersonId),dy=save.dynasties.find(d=>d.factionId===f.factionId),epochs=dy?.houseEpochs as import('../Politics/DynasticRevolution').DynastyHouseEpoch[]|undefined;
  const source=events.find(e=>e.id===f.sourceEventId),foundation=events.find(e=>e.id===`${f.familyId}-founded`);
  if(!Number.isSafeInteger(f.foundedMonth)||f.foundedMonth<0||f.surname!==splitEstablishedPersonalName(p?.personalName??'')?.houseName.replace(/氏$/,'')||f.renewals!==undefined&&!Array.isArray(f.renewals)||seen.has(f.familyId)||f.familyId!==`military-family-${f.founderPersonId}-${f.epochFounderId}`||!p||p.deathMonth!==undefined&&p.deathMonth<=f.foundedMonth||p.royalIdentity||!source||!foundation||foundation.type!=='military-family-founded'||foundation.metadata?.sourceEventId!==f.sourceEventId||foundation.metadata?.personId!==p.personId||foundation.metadata?.familyId!==f.familyId||(foundation.monthIndex??foundation.year)!==f.foundedMonth||f.foundedMonth>save.world.worldMonth||!epochs?.some(e=>e.foundingRulerId===f.epochFounderId&&e.startMonth<=f.foundedMonth&&(e.endMonth??Infinity)>=f.foundedMonth)||!Array.isArray(f.members)||!f.members.length)throw Error('invalid family charter');
  // Replay eligibility at foundation, not the founder's later death or defection.
  if(!familyFounderSource({...p,deathMonth:undefined,factionId:f.factionId,politicalRulerId:undefined},[source],f.factionId,f.epochFounderId,f.foundedMonth))throw Error('family lacks real merit');
  seen.add(f.familyId);
  const members=new Map(f.members.map(m=>[m.memberId,m]));if(members.size!==f.members.length)throw Error('duplicate family member');
  for(const m of f.members){
   if(!Number.isSafeInteger(m.sourceUserId)||!Number.isSafeInteger(m.generation)||m.generation<0||typeof m.name!=='string'||residentIds.has(m.sourceUserId)||m.memberId!==familyMemberId(m.sourceUserId,m.bornMonth)||!Number.isSafeInteger(m.bornMonth)||!Number.isSafeInteger(m.enteredMonth)||m.enteredMonth<f.foundedMonth||m.enteredMonth>save.world.worldMonth||m.enteredMonth-m.bornMonth<18*12||!m.name.startsWith(f.surname)||(m.deathMonth!==undefined&&(!Number.isSafeInteger(m.deathMonth)||m.deathMonth<m.enteredMonth||m.deathMonth>save.world.worldMonth)))throw Error('invalid member identity or life');
   residentIds.add(m.sourceUserId);
   if(m.source==='FOUNDER'){if(m.parentMemberId||m.generation!==0||m.militaryPersonId!==p.personId||m.sourceUserId!==p.sourceUserId||m.bornMonth!==p.bornMonth||m.name!==p.personalName)throw Error('invalid founder');}
   else {const parent=m.parentMemberId?members.get(m.parentMemberId):undefined,entry=events.find(e=>e.id===`${m.memberId}-entered`);
    if(!entry||entry.type!=='military-family-member-entered'||entry.actorFactionId!==f.factionId||(entry.monthIndex??entry.year)!==m.enteredMonth||entry.metadata?.familyId!==f.familyId||entry.metadata?.sourceUserId!==m.sourceUserId||entry.metadata?.bornMonth!==m.bornMonth||entry.metadata?.residentName!==m.name||entry.metadata?.parentMemberId!==m.parentMemberId||entry.metadata?.populationCause!=='NATURAL_GROWTH')throw Error('missing real population entry source');
    if(m.source!=='NATURAL_GROWTH'||!parent||parent.enteredMonth>=m.enteredMonth||m.generation!==parent.generation+1||m.bornMonth-parent.bornMonth<18*12||m.bornMonth-parent.bornMonth>55*12||(parent.deathMonth??Infinity)<=m.bornMonth)throw Error('invalid parent or cyclic genealogy');
   }
   const military=m.militaryPersonId?state.people.find(p=>p.personId===m.militaryPersonId):undefined;
   if(m.militaryPersonId&&(!military||military.sourceUserId!==m.sourceUserId||military.bornMonth!==m.bornMonth||military.personalName!==m.name||military.deathMonth!==undefined&&m.deathMonth!==military.deathMonth))throw Error('family military identity mismatch');
   if(military)for(const [i,appointment] of military.appointments.entries()){
    const e=events.find(e=>e.id===`military-appointment-${appointment.commandId}`);
    if(!e||e.metadata?.familyId!==f.familyId||e.metadata?.familyMemberId!==m.memberId)continue;
    const epoch=epochs?.find(ep=>ep.startMonth<=appointment.startMonth&&(ep.endMonth??Infinity)>=appointment.startMonth)?.foundingRulerId;
    const expected=i===0?familyAppointmentWeight(f,{...m,militaryPersonId:undefined,deathMonth:undefined},appointment.factionId,epoch,appointment.startMonth):1;
    if(e.metadata?.familyAppointmentWeight!==expected)throw Error('invalid family appointment advantage');
   }
   const user=save.users.find(u=>u.userId===m.sourceUserId);
   if(user&&(user.bornMonth!==m.bornMonth||m.generation>0&&user.name!==m.name||m.deathMonth!==undefined||m.generation>0&&user.familyMemberId!==m.memberId))throw Error('family resident binding mismatch');
   if(!user&&m.deathMonth===undefined&&m.exitMonth===undefined&&!military?.politicalRulerId)throw Error('family member missing live population or death');
  }
  const renewed=new Set<string>();for(const renewal of f.renewals??[]){const member=f.members.find(m=>m.memberId===renewal.memberId),person=member?.militaryPersonId&&state.people.find(p=>p.personId===member.militaryPersonId),source=events.find(e=>e.id===renewal.sourceEventId),event=events.find(e=>e.id===`${f.familyId}-${renewal.memberId}-merit`);
   if(!member||member.generation===0||!person||!source||renewed.has(member.memberId)||renewal.month<member.enteredMonth||renewal.month>save.world.worldMonth||!event||event.type!=='military-family-merit'||event.metadata?.sourceEventId!==source.id||(event.monthIndex??event.year)!==renewal.month||!familyFounderSource({...person,deathMonth:undefined,factionId:f.factionId},[source],f.factionId,f.epochFounderId,renewal.month))throw Error('invalid renewed family merit');renewed.add(member.memberId);
  }
 }catch(e){errors.push(`invalid military family ${f?.familyId}: ${String(e)}`);}
 for(const u of save.users)if(u.familyMemberId&&!families?.some(f=>f.members.some(m=>m.memberId===u.familyMemberId&&m.sourceUserId===u.userId&&m.bornMonth===u.bornMonth)))errors.push('orphan family resident');
 for(const e of events){
  if(e.type==='military-family-founded'&&!families?.some(f=>`${f.familyId}-founded`===e.id))errors.push('orphan family foundation');
  if(e.type==='military-family-member-entered'&&!families?.some(f=>f.members.some(m=>`${m.memberId}-entered`===e.id)))errors.push('orphan family population entry');
  if(e.type==='military-family-merit'&&!families?.some(f=>f.renewals?.some(r=>`${f.familyId}-${r.memberId}-merit`===e.id)))errors.push('orphan renewed family merit');
 }
 return errors;
}
