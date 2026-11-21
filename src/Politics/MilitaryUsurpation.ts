import {politicalContest,type PoliticalContestRow} from './PoliticalUsurpation';
import type {CivilGovernorTerm} from './CivilAdministrationSchema';
import type {WorldEvent} from '../History/WorldHistory';
import type {MilitaryPoliticalParticipant} from './MilitaryPoliticalInfluence';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import {splitEstablishedPersonalName} from './NameCulture';
import {deriveMilitaryLifeSchedule} from './MilitaryLifeRules';
import type {MilitaryOffice} from './MilitaryOffice';

/** A non-royal person's accession provenance, distinct from royal kin enlistment. */
export interface MilitaryUsurperIdentity {
 version:2;contest:PoliticalContestRow[];personId:string;sourceUserId:number;sourceUserLabel:string;bornMonth:number;naturalDeathMonth:number;
 factionId:string;accessionMonth:number;predecessorRulerId:string;displacedSuccessorId:string;
 commandId:string;office:MilitaryOffice;officeEventId:string;appointmentEventId:string;
 opportunity:{roll:number;chance:number;baselineChance:number};participant:MilitaryPoliticalParticipant;
}
/** Deterministic competition AFTER the original successful usurpation roll. No independent draw. */
export function selectMilitaryUsurper(candidates:readonly MilitaryPoliticalParticipant[],people:readonly MilitaryPerson[],oldHouseName:string,context?:{terms:readonly CivilGovernorTerm[];events:readonly WorldEvent[];month:number;epoch:string}){
 const eligible=candidates.filter(c=>{
  const p=people.find(p=>p.personId===c.personId),name=p&&splitEstablishedPersonalName(p.personalName),d=c.disposition;
  return p&&p.status==='ACTIVE'&&!p.royalIdentity&&!p.politicalRulerId&&p.deathMonth===undefined&&name&&name.houseName!==oldHouseName&&
   c.unitCount>=2&&c.serviceMonths>=60&&c.strength>=2&&c.capturedEventIds.length>0&&c.officeStanding&&d&&d.ambition>d.loyalty;
 });
 if(!eligible.length)return;
 const contest=politicalContest(eligible,people,context?.terms??[],context?.events??[],context?.month??0,context?.epoch??'');
 return eligible.find(c=>c.personId===contest[0]?.personId);
}
export function militaryUsurperIdentity(candidate:MilitaryPoliticalParticipant,person:MilitaryPerson,month:number,predecessorId:string,displacedId:string,opportunity:MilitaryUsurperIdentity['opportunity'],contest:PoliticalContestRow[]):MilitaryUsurperIdentity {
 const office=candidate.officeStanding;if(!office)throw Error('Usurper has no verified real office');
 return {version:2,contest:structuredClone(contest),personId:person.personId,sourceUserId:person.sourceUserId,sourceUserLabel:person.name,bornMonth:person.bornMonth,naturalDeathMonth:deriveMilitaryLifeSchedule(person).naturalDeathMonth,
  factionId:candidate.factionId,accessionMonth:month,predecessorRulerId:predecessorId,displacedSuccessorId:displacedId,commandId:candidate.commandId,office:office.office,officeEventId:office.eventId,appointmentEventId:office.appointmentEventId,opportunity:{...opportunity},participant:structuredClone(candidate)};
}

/** Diagnostic denominator: candidates inside an already successful usurpation, never all generals/months. */
export function auditMilitaryUsurpers(candidates:readonly MilitaryPoliticalParticipant[],people:readonly MilitaryPerson[],oldHouseName:string){
 const blocked:Record<string,number>={},eligible:string[]=[];
 for(const c of candidates){
  if(selectMilitaryUsurper([c],people,oldHouseName)){eligible.push(c.personId);continue;}
  const p=people.find(p=>p.personId===c.personId),name=p&&splitEstablishedPersonalName(p.personalName);
  const reason=!p?'MISSING_PERSON':p.status!=='ACTIVE'||p.deathMonth!==undefined?'NOT_ACTIVE':p.royalIdentity?'ROYAL_KIN':p.politicalRulerId?'ALREADY_RULER':!name?'UNVERIFIED_NAME':name.houseName===oldHouseName?'SAME_HOUSE':c.unitCount<2?'INSUFFICIENT_UNITS':c.serviceMonths<60?'INSUFFICIENT_SERVICE':c.strength<2?'INSUFFICIENT_AUTHORITY':!c.capturedEventIds.length?'NO_VERIFIED_CAPTURE':!c.officeStanding?'NO_CURRENT_OFFICE':'DISPOSITION_NOT_WILLING';
  blocked[reason]=(blocked[reason]??0)+1;
 }
 if(!candidates.length)blocked.NO_COURT_CANDIDATES=1;
 return {candidateCount:candidates.length,eligible,blocked};
}
