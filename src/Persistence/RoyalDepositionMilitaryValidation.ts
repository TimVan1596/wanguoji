import {validMilitaryDisposition} from "../Politics/MilitaryPoliticalDisposition";
import {validMilitaryClaimSupport} from "../Politics/MilitaryClaimSupport";
import {readMilitaryParticipation} from "../Politics/MilitaryPoliticalInfluence";
import type {WorldEvent} from "../History/WorldHistory";
import type {RulerSaveV17} from "./WorldSaveSchema";
import type {WorldSaveV1} from "./WorldSaveSchema";
import {royalCommandAdvantage} from "../Politics/RoyalDepositionMilitary";
import {deriveMilitaryCareer} from "../Politics/MilitaryCareerEvidence";

/** Frozen command membership describes the selection month, not today's surviving formation. */
export function validRoyalDepositionMilitary(save:WorldSaveV1,event:any):boolean {
 try {
  const selection=JSON.parse(event.metadata.depositionSelection);
  if(selection.version<2)return true;
  if(selection.version===3){
   const support=selection.support,participant=readMilitaryParticipation(event)?.participant;
   if(!support||!participant||support.personId!==participant.personId||support.name!==(participant.personalName??participant.name)||JSON.stringify(support.disposition)!==JSON.stringify(participant.disposition)||!validMilitaryClaimSupport(support,selection.candidates,participant.bornMonth))return false;
  }
  const month=event.monthIndex??event.year,faction=event.actorFactionId;
  const registry=save.registries.militaryCommandRegistry,events=save.worldHistory.events as WorldEvent[];
  const rulerRecords=(save.dynasties.find(d=>d.factionId===faction)?.rulers??[]) as RulerSaveV17[];
  const claimedUnits=new Set<string>(),claimedUsers=new Set<number>();
  for(const candidate of selection.candidates){
   const proof=candidate.ownMilitary;if(!proof)continue;
   const r=rulerRecords.find(r=>r.rulerId===candidate.rulerId),i=r?.militaryIdentity,p=registry.people.find(p=>p.personId===i?.personId),part=proof.participant;
   if(!r||!i||!p||proof.rulerId!==r.rulerId||p.royalIdentity?.rulerId!==r.rulerId||p.royalIdentity?.factionId!==faction||p.bornMonth!==r.bornMonth||month-r.bornMonth<216||
    i.enteredMonth>month||r.deathMonth!==undefined&&r.deathMonth<=month||p.deathMonth!==undefined&&p.deathMonth<=month||
    !part||part.personId!==p.personId||part.sourceUserId!==p.sourceUserId||part.name!==p.name||part.personalName!==p.personalName||part.bornMonth!==p.bornMonth||part.factionId!==faction)return false;
   const f=registry.formations.find(f=>f.commandId===part.commandId),a=p.appointments.find(a=>a.commandId===part.commandId&&a.factionId===faction&&a.startMonth<=month&&(a.endMonth===undefined||a.endMonth>=month));
   if(!f||!a||f.factionId!==faction||f.commanderPersonId!==p.personId||f.createdMonth>month)return false;
   const grant=a.officeHistory?.filter(g=>g.month<=month).at(-1),office=events.find(e=>e.id===proof.officeEventId),appointment=events.find(e=>e.id===proof.appointmentEventId);
   if(!grant||grant.office!==proof.office||grant.eventId!==proof.officeEventId||office?.type!=="military-office-granted"||office.actorFactionId!==faction||office.metadata?.personId!==p.personId||office.metadata?.commandId!==f.commandId||office.metadata?.office!==grant.office||(office.monthIndex??office.year)!==grant.month||
    appointment?.type!=="military-appointment"||appointment.actorFactionId!==faction||appointment.metadata?.personId!==p.personId||appointment.metadata?.commandId!==f.commandId||(appointment.monthIndex??appointment.year)!==a.startMonth)return false;
   if(!Array.isArray(proof.members)||proof.members.length<1||proof.members.length>4||part.unitCount!==proof.members.length||!Array.isArray(part.memberUnitIds)||part.memberUnitIds.length!==proof.members.length||
    JSON.stringify(part.memberUnitIds)!==JSON.stringify(proof.members.map((m:any)=>m.unitId))||!proof.members.some((m:any)=>m.unitId===part.commanderUnitId&&m.userId===p.sourceUserId&&m.name===p.name&&m.bornMonth===p.bornMonth))return false;
   for(const member of proof.members){
    if(typeof member.unitId!=="string"||!member.unitId.length||!Number.isSafeInteger(member.userId)||typeof member.name!=="string"||!Number.isInteger(member.bornMonth)||member.bornMonth>month||member.factionId!==faction||claimedUnits.has(member.unitId)||claimedUsers.has(member.userId))return false;
    claimedUnits.add(member.unitId);claimedUsers.add(member.userId);
    // Immutable identity remains checkable even when a living soldier has since transferred.
    const user=save.users.find(u=>u.userId===member.userId);
    if(user&&(user.name!==member.name||user.bornMonth!==member.bornMonth))return false;
   }
   const career=deriveMilitaryCareer(p,registry.formations,events,month);
   if(part.disposition!==undefined&&(!validMilitaryDisposition(part.disposition,p.personId,p.bornMonth,part.strength)||part.politicalSelectionWeight!==part.strength*part.disposition.contestWeight))return false;
   if(part.serviceMonths!==career.serviceMonths||JSON.stringify(part.capturedEventIds)!==JSON.stringify(career.capturedEventIds.slice().sort())||!Array.isArray(proof.victories)||proof.victories.length<1||proof.victories.length>2||new Set(proof.victories.map((v:any)=>v.cityId)).size!==proof.victories.length)return false;
   for(const v of proof.victories){
    const victory=events.find(e=>e.id===v.eventId);
    if(!career.capturedEventIds.includes(v.eventId)||!victory||victory.cityId!==v.cityId||v.month!==(victory.monthIndex??victory.year)||victory.actorFactionId!==faction||victory.metadata?.commandId!==f.commandId||v.month<a.startMonth||v.month>month)return false;
   }
   if(Math.abs(proof.advantage-royalCommandAdvantage(proof.members.length,proof.victories.length))>1e-12||proof.advantage!==candidate.militaryAdvantage)return false;
  }
  return true;
 }catch{return false;}
}
