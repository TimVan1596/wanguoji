import {civilRetirementEvidence,validStewardshipWindow,stewardshipContribution,stewardshipInterval,type CivilStewardshipWindow} from '../Politics/CivilCareerRules';
import type {CivilGovernorTerm} from '../Politics/CivilAdministrationSchema';
import type {WorldSaveV1} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
/** Frozen observations are authoritative samples, not invented recovery receipts. */
export function validateCivilCareerRecords(t:CivilGovernorTerm,save:WorldSaveV1,events:readonly WorldEvent[],byId:ReadonlyMap<string,{event:WorldEvent;index:number}>,seen:Set<string>){
 const at=(e:WorldEvent)=>e.monthIndex??e.year,ended=t.endMonth??save.world.worldMonth,appointment=byId.get(t.appointEventId)!.index;
 const validateWindow=(w:CivilStewardshipWindow,cutoff:number)=>{
  if(!w||!w.cityId||!w.cityName||!Number.isSafeInteger(w.controlledSince)||!Array.isArray(w.samples)||!w.samples.length||w.samples.length>stewardshipInterval)throw Error('invalid civil observation window');
  if(!validStewardshipWindow(w,t.startMonth,w.samples.at(-1)!.month,w.samples.length===stewardshipInterval))throw Error('non-contiguous or unstable civil observations');
  for(const s of w.samples){if(s.month>ended||s.historyIndex<appointment+1||s.historyIndex>cutoff||s.historyIndex>events.length||s.historyIndex&&at(events[s.historyIndex-1])>s.month||events[s.historyIndex]&&at(events[s.historyIndex])<s.month)throw Error('civil observation history boundary mismatch');}
  if(events.some((e,i)=>i<cutoff&&i>=w.samples[0].historyIndex&&e.cityId===w.cityId&&at(e)>=w.samples[0].month&&at(e)<=w.samples.at(-1)!.month&&['siege-started','city-captured','capital-fallen','city-destroyed','city-recovered'].includes(e.type)))throw Error('civil peaceful assessment crosses a control or siege disruption');
 };
 let previous=t.startMonth;
 for(const a of t.stewardshipAssessments??[]){
  const source=byId.get(a.eventId);if(!source||seen.has(a.eventId)||a.assignmentId!==t.assignmentId||a.eventId!==`${t.assignmentId}-stewardship-${a.month}`||!['LOW','MEDIUM'].includes(a.policy)||a.contribution!==stewardshipContribution(a.policy)||!validStewardshipWindow(a,t.startMonth,a.month)||a.samples[0].month<=previous||a.month>ended||source.event.type!=='civil-stewardship-assessed'||source.event.actorFactionId!==t.factionId||source.event.cityId!==a.cityId||source.event.cityName!==a.cityName||source.event.metadata?.personId!==t.personId||source.event.metadata?.assignmentId!==t.assignmentId||source.event.metadata?.assessment!==JSON.stringify(a)||at(source.event)!==a.month||source.index<=appointment||t.endEventId&&source.index>=byId.get(t.endEventId)!.index)throw Error('invalid civil stewardship assessment source');
  validateWindow(a,source.index);seen.add(a.eventId);previous=a.month;
 }
 if(t.stewardshipWindow){validateWindow(t.stewardshipWindow,t.endEventId?byId.get(t.endEventId)!.index:events.length);if(t.stewardshipWindow.samples.length>=stewardshipInterval||t.stewardshipWindow.samples[0].month<=previous)throw Error('repeated civil stewardship period');}
 if(t.endReason==='RETIREMENT'){
  const proof=t.retirement,expected=proof&&civilRetirementEvidence({...t,endMonth:undefined},t.endMonth!,save.worldRandom.seed,proof.policy);
  if(!proof||!expected||proof.roll>=proof.chance||JSON.stringify(proof)!==JSON.stringify(expected))throw Error('invalid civil retirement evidence');
 }else if(t.retirement)throw Error('retirement without actual retirement');
}
