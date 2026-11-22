import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {CivilGovernorTerm,CivilPromotionEvidence} from './CivilAdministrationSchema';
import type {WorldEvent} from '../History/WorldHistory';
export type CrossCareerPolicy='BASELINE'|'LOW'|'MEDIUM';
/** A bounded relative competition weight only. It cannot supply governance receipts or military victories. */
export function civilCrossCareerEvidence(term:CivilGovernorTerm,person:MilitaryPerson|undefined,events:readonly WorldEvent[],policy:CrossCareerPolicy='LOW'){
 const byId=new Map(events.map(e=>[e.id,e])),ids:string[]=[];
 if(person&&person.personId===term.personId&&person.sourceUserId===term.sourceUserId&&person.bornMonth===term.bornMonth){
  for(const a of person.appointments){
   if(a.endMonth===undefined||a.endMonth>term.startMonth||a.endMonth-a.startMonth<36||a.endReason==='DEATH')continue;
   const start=byId.get(`military-appointment-${a.commandId}`),end=byId.get(`military-command-ended-${a.commandId}`);
   if(start?.type!=='military-appointment'||end?.type!=='military-command-ended'||start.metadata?.personId!==person.personId||end.metadata?.personId!==person.personId||(start.monthIndex??start.year)!==a.startMonth||(end.monthIndex??end.year)!==a.endMonth)continue;
   ids.push(start.id,end.id);
  }
 }
 return {policy,multiplier:ids.length?policy==='LOW'?1.05:policy==='MEDIUM'?1.1:1:1,militaryEventIds:ids};
}
export function civilPromotionCompetitionWeight(term:CivilGovernorTerm,e:CivilPromotionEvidence,person:MilitaryPerson|undefined,events:readonly WorldEvent[],policy:CrossCareerPolicy='LOW'){
 return (1+e.strategy/100+Math.min(1,e.contribution/20))*civilCrossCareerEvidence(term,person,events,policy).multiplier;
}
