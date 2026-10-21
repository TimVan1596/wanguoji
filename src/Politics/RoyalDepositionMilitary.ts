import type {Ruler} from "./Dynasty";
import type {MilitaryPerson,MilitaryFormation} from "./MilitaryCommandRegistry";
import type {MilitaryPoliticalEvidence,MilitaryPoliticalParticipant,MilitaryPoliticalUser} from "./MilitaryPoliticalInfluence";
import type {WorldEvent} from "../History/WorldHistory";
import type {MilitaryOffice} from "./MilitaryOffice";

export interface RoyalDepositionMilitaryEvidence {
 rulerId:string;
 participant:MilitaryPoliticalParticipant;
 office:MilitaryOffice;
 officeEventId:string;
 appointmentEventId:string;
 members:Array<{unitId:string;userId:number;name:string;bornMonth:number;factionId:string}>;
 victories:Array<{eventId:string;cityId:string;month:number}>;
 advantage:number;
}
/** A bounded advantage for an actual current command, never an endorsement or a coup probability. */
export function royalCommandAdvantage(unitCount:number,distinctCities:number){
 return distinctCities<1?0:.10+(unitCount>=8?.05:0)+.05*Math.min(2,distinctCities);
}

export function deriveRoyalDepositionMilitary(input:{factionId:string;month:number;rulers:readonly Ruler[];people:MilitaryPerson[];formations:MilitaryFormation[];users:MilitaryPoliticalUser[];events:WorldEvent[];influence:MilitaryPoliticalEvidence}):RoyalDepositionMilitaryEvidence[]{
 const {factionId,month,people,formations,users,events,influence}=input,byEvent=new Map(events.map(e=>[e.id,e]));
 return input.rulers.flatMap(r=>{
  const link=r.militaryIdentity,p=link&&people.find(p=>p.personId===link.personId);
  const participant=p&&influence.candidates.find(c=>c.personId===p.personId);
  if(!p||!link||!participant||r.reignOrdinal!==undefined||r.accessionYear!==undefined||r.deathMonth!==undefined||r.deathReason!==undefined||
    !["heir","kin"].includes(r.status)||month-r.bornYear<216||r.naturalDeathYear===undefined||r.naturalDeathYear<=month||
    p.royalIdentity?.rulerId!==r.id||p.royalIdentity.factionId!==factionId||p.royalIdentity.naturalDeathMonth!==r.naturalDeathYear||
    p.factionId!==factionId||p.sourceUserId!==link.sourceUserId||p.name!==link.sourceUserLabel||p.bornMonth!==r.bornYear||participant.bornMonth!==r.bornYear)return [];
  const formation=formations.find(f=>f.commandId===participant.commandId)!;
  // Qualification must cover the whole actual command, not a surviving subset of bad references.
  if(!formation||formation.memberUnitIds.length!==participant.memberUnitIds.length||new Set(formation.memberUnitIds).size!==formation.memberUnitIds.length||formation.memberUnitIds.some(id=>!participant.memberUnitIds.includes(id)))return [];
  const appointment=p.appointments.find(a=>a.commandId===participant.commandId&&a.factionId===factionId&&a.endMonth===undefined);
  const grant=appointment?.officeHistory?.filter(g=>g.month<=month).at(-1),officeEvent=grant&&byEvent.get(grant.eventId);
  const appointmentEvent=events.find(e=>e.type==="military-appointment"&&e.actorFactionId===factionId&&e.metadata?.personId===p.personId&&e.metadata?.commandId===participant.commandId&&(e.monthIndex??e.year)===appointment?.startMonth);
  if(!appointment||!grant||!officeEvent||officeEvent.type!=="military-office-granted"||officeEvent.actorFactionId!==factionId||officeEvent.metadata?.personId!==p.personId||officeEvent.metadata?.commandId!==participant.commandId||officeEvent.metadata?.office!==grant.office||(officeEvent.monthIndex??officeEvent.year)!==grant.month||!appointmentEvent)return [];
  const members=participant.memberUnitIds.map(unitId=>users.find(u=>u.unitId===unitId&&u.liveBindingVerified&&u.factionId===factionId)!);
  if(members.some(u=>!u)||new Set(members.map(u=>u.userId)).size!==members.length)return [];
  const seen=new Set<string>();
  const victories=participant.capturedEventIds.flatMap(id=>{
   const e=byEvent.get(id),at=e?.monthIndex??e?.year??Infinity;
   if(!e?.cityId||seen.has(e.cityId)||e.metadata?.commandId!==appointment.commandId||e.actorFactionId!==factionId||at<appointment.startMonth||at>month)return [];
   seen.add(e.cityId);return [{eventId:e.id,cityId:e.cityId,month:at}];
  }).sort((a,b)=>a.month-b.month||a.eventId.localeCompare(b.eventId)).slice(0,2);
  const advantage=royalCommandAdvantage(members.length,victories.length);
  return advantage?[{rulerId:r.id,participant:structuredClone(participant),office:grant.office,officeEventId:grant.eventId,appointmentEventId:appointmentEvent.id,
   members:members.map(u=>({unitId:u.unitId!,userId:u.userId,name:u.name,bornMonth:u.bornMonth,factionId:u.factionId})),victories,advantage}]:[];
 }).sort((a,b)=>a.rulerId.localeCompare(b.rulerId));
}
