import type {WorldSaveV1} from "./WorldSaveSchema";
import {deriveMilitaryLifeSchedule} from "../Politics/MilitaryLifeRules";
import {deriveMilitaryCareer} from "../Politics/MilitaryCareerEvidence";
import {militaryPoliticalStrength} from "../Politics/MilitaryPoliticalInfluence";
import {MILITARY_OFFICE_NAMES} from "../Politics/MilitaryOffice";
const object=(v:any)=>v&&typeof v==="object"&&!Array.isArray(v);
export function validateMilitarySecessions(save:WorldSaveV1){
 const errors:string[]=[],state=save.registries?.militaryCommandRegistry;
 if(!state||!Array.isArray(state.people)||!Array.isArray(state.formations)||!Array.isArray(save.dynasties)||!Array.isArray(save.worldHistory?.events))return errors;
 const records=save.dynasties.flatMap(d=>Array.isArray(d?.rulers)?d.rulers:[]).filter(object) as any[];
 const events=(save.worldHistory.events as any[]).filter(object);
 for(const r of records){
  const i=r.residentIdentity,e=i?.military;if(e===undefined)continue;
  const p=state.people.find(p=>p.personId===e?.personId),f=state.formations.find(f=>f.commandId===e?.commandId);
  const a=p?.appointments.find(a=>a.commandId===e.commandId&&a.factionId===i.sourceFactionId);
  const grant=a?.officeHistory?.filter(g=>g.month<=i.foundedMonth).at(-1);
  let valid=Boolean(object(e)&&p&&f&&a&&grant&&p.politicalRulerId===r.rulerId&&p.personId===i.personId&&p.sourceUserId===i.sourceUserId&&p.name===i.sourceUserLabel&&p.bornMonth===r.bornMonth&&
   `${r.houseName?.replace(/氏$/,"")}${r.givenName}`===p.personalName&&e.personalName===p.personalName&&p.status!=="ACTIVE"&&
   r.naturalDeathMonth===deriveMilitaryLifeSchedule(p).naturalDeathMonth&&r.deathMonth===p.deathMonth&&
   a.endMonth===i.foundedMonth&&a.endReason==="TRANSFERRED"&&grant.office===e.office&&e.office in MILITARY_OFFICE_NAMES&&
   e.sourceFactionId===i.sourceFactionId&&e.sourceFactionName===i.sourceFactionName&&e.worldMonth===i.foundedMonth&&e.cityId===i.cityId&&
   f.commanderPersonId===p.personId&&f.factionId===i.sourceFactionId&&f.status==="DISBANDED"&&Array.isArray(e.originalMemberUnitIds)&&Array.isArray(e.participants)&&
   e.originalMemberUnitIds.length>=2&&e.originalMemberUnitIds.length<=12&&new Set(e.originalMemberUnitIds).size===e.originalMemberUnitIds.length&&
   e.originalMemberUnitIds.length===f.memberUnitIds.length&&e.originalMemberUnitIds.every((id:string)=>f.memberUnitIds.includes(id))&&
   e.participants.length>=2&&e.participants.length<=1+Math.max(1,Math.floor((e.originalMemberUnitIds.length-1)/2)));
  if(valid){
   const units=new Set(),users=new Set();
   for(const u of e.participants){
    if(!object(u)||!Number.isSafeInteger(u.userId)||typeof u.name!=="string"||!Number.isSafeInteger(u.bornMonth)||u.bornMonth>e.worldMonth||typeof u.unitId!=="string"||units.has(u.unitId)||users.has(u.userId)||!e.originalMemberUnitIds.includes(u.unitId)||!Number.isFinite(u.x)||!Number.isFinite(u.y)||u.x<0||u.y<0||!["PHASER","LOGICAL"].includes(u.positionSource)||u.districtCityId!==i.cityId||u.ownedFactionId!==i.sourceFactionId)valid=false;
    units.add(u?.unitId);users.add(u?.userId);
   }
   if(e.participants[0]?.userId!==p!.sourceUserId||e.participants[0]?.bornMonth!==p!.bornMonth||e.participants[0]?.name!==p!.name)valid=false;
   const career=deriveMilitaryCareer(p!,state.formations,events,e.worldMonth);
   if(career.serviceMonths!==e.serviceMonths||!Array.isArray(e.capturedEventIds)||JSON.stringify([...career.capturedEventIds].sort())!==JSON.stringify([...e.capturedEventIds].sort())||!militaryPoliticalStrength(e.serviceMonths,e.originalMemberUnitIds.length,e.capturedEventIds.length).eligible)valid=false;
   const founding=events.filter(x=>x.type==="empire-split"&&x.metadata?.foundingRulerId===r.rulerId);
   if(founding.length!==1||founding[0].metadata?.militaryPersonId!==p!.personId||founding[0].metadata?.militarySplitEvidence!==JSON.stringify(e)||founding[0].metadata?.transferredPopulation!==e.participants.length||founding[0].metadata?.externalPopulation!==0||founding[0].targetFactionId!==i.sourceFactionId)valid=false;
  }
  if(!valid)errors.push("military secession identity, office, followers or life evidence mismatch");
 }
 for(const p of state.people)if(p.politicalRulerId){
  const rs=records.filter(r=>r.rulerId===p.politicalRulerId&&r.residentIdentity?.military?.personId===p.personId);
  if(rs.length!==1)errors.push("military political identity lacks unique ruler life");
 }
 return errors;
}
