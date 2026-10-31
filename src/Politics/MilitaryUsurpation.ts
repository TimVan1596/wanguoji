import type {MilitaryPoliticalParticipant} from './MilitaryPoliticalInfluence';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import {splitEstablishedPersonalName} from './NameCulture';
import {deriveMilitaryLifeSchedule} from './MilitaryLifeRules';
import type {MilitaryOffice} from './MilitaryOffice';

/** A non-royal person's accession provenance, distinct from royal kin enlistment. */
export interface MilitaryUsurperIdentity {
 version:1;personId:string;sourceUserId:number;sourceUserLabel:string;bornMonth:number;naturalDeathMonth:number;
 factionId:string;accessionMonth:number;predecessorRulerId:string;displacedSuccessorId:string;
 commandId:string;office:MilitaryOffice;officeEventId:string;appointmentEventId:string;
 opportunity:{roll:number;chance:number;baselineChance:number};participant:MilitaryPoliticalParticipant;
}
/** Deterministic competition AFTER the original successful usurpation roll. No independent draw. */
export function selectMilitaryUsurper(candidates:readonly MilitaryPoliticalParticipant[],people:readonly MilitaryPerson[],oldHouseName:string){
 return candidates.find(c=>{
  const p=people.find(p=>p.personId===c.personId),name=p&&splitEstablishedPersonalName(p.personalName),d=c.disposition;
  return p&&p.status==='ACTIVE'&&!p.royalIdentity&&!p.politicalRulerId&&p.deathMonth===undefined&&name&&name.houseName!==oldHouseName&&
   c.unitCount>=2&&c.serviceMonths>=60&&c.strength>=2&&c.capturedEventIds.length>0&&c.officeStanding&&d&&d.ambition>d.loyalty;
 });
}
export function militaryUsurperIdentity(candidate:MilitaryPoliticalParticipant,person:MilitaryPerson,month:number,predecessorId:string,displacedId:string,opportunity:MilitaryUsurperIdentity['opportunity']):MilitaryUsurperIdentity {
 const office=candidate.officeStanding;if(!office)throw Error('Usurper has no verified real office');
 return {version:1,personId:person.personId,sourceUserId:person.sourceUserId,sourceUserLabel:person.name,bornMonth:person.bornMonth,naturalDeathMonth:deriveMilitaryLifeSchedule(person).naturalDeathMonth,
  factionId:candidate.factionId,accessionMonth:month,predecessorRulerId:predecessorId,displacedSuccessorId:displacedId,commandId:candidate.commandId,office:office.office,officeEventId:office.eventId,appointmentEventId:office.appointmentEventId,opportunity:{...opportunity},participant:structuredClone(candidate)};
}
