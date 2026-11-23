import {civilPromotionFacts} from '../Politics/CivilPromotion';
import {WorldRandom} from '../Simulation/WorldRandom';
import {civilPromotionChance} from '../Politics/CivilCareerRules';
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
  if(events.some((e,i)=>i<Math.min(cutoff,w.samples.at(-1)!.historyIndex)&&i>=w.samples[0].historyIndex&&e.cityId===w.cityId&&at(e)>=w.samples[0].month&&at(e)<=w.samples.at(-1)!.month&&['siege-started','city-captured','capital-fallen','city-destroyed','city-recovered'].includes(e.type)))throw Error('civil peaceful assessment crosses a control or siege disruption');
 };
 let previous=t.startMonth;
 for(const a of t.stewardshipAssessments??[]){
  const source=byId.get(a.eventId);if(!source||seen.has(a.eventId)||a.assignmentId!==t.assignmentId||a.eventId!==`${t.assignmentId}-stewardship-${a.month}`||!['LOW','MEDIUM'].includes(a.policy)||a.contribution!==stewardshipContribution(a.policy)||!validStewardshipWindow(a,t.startMonth,a.month)||a.samples[0].month<=previous||a.month>ended||source.event.type!=='civil-stewardship-assessed'||source.event.actorFactionId!==t.factionId||source.event.cityId!==a.cityId||source.event.cityName!==a.cityName||source.event.metadata?.personId!==t.personId||source.event.metadata?.assignmentId!==t.assignmentId||source.event.metadata?.assessment!==JSON.stringify(a)||at(source.event)!==a.month||source.index<=appointment||t.endEventId&&source.index>=byId.get(t.endEventId)!.index)throw Error('invalid civil stewardship assessment source');
  validateWindow(a,source.index);seen.add(a.eventId);previous=a.month;
 }
 if(t.stewardshipWindow){validateWindow(t.stewardshipWindow,t.endEventId?byId.get(t.endEventId)!.index:events.length);if(t.stewardshipWindow.samples.length>=stewardshipInterval||t.stewardshipWindow.samples[0].month<=previous)throw Error('repeated civil stewardship period');}
 if(t.promotionReview){
  const r=t.promotionReview;if(!Number.isSafeInteger(r.month)||r.month%12!==0||r.month<t.startMonth||r.month>ended||!Number.isSafeInteger(r.historyIndex)||r.historyIndex<=appointment||r.historyIndex>events.length||!Number.isSafeInteger(r.cityCount)||r.cityCount<0||!Number.isFinite(r.loyalty)||r.loyalty<0||r.loyalty>100||!['BASELINE','LOW','MEDIUM'].includes(r.policy))throw Error('invalid civil promotion review boundary');
  const terms=save.registries.civilAdministration.terms.filter(term=>term.startMonth<=r.month&&(byId.get(term.appointEventId)?.index??Infinity)<r.historyIndex).map(term=>({...term,endMonth:term.endEventId&&(byId.get(term.endEventId)?.index??Infinity)<r.historyIndex?term.endMonth:undefined,receipts:term.receipts?.filter(a=>(byId.get(a.eventId)?.index??Infinity)<r.historyIndex),stewardshipAssessments:term.stewardshipAssessments?.filter(a=>(byId.get(a.eventId)?.index??Infinity)<r.historyIndex)}));
  const current=terms.find(term=>term.assignmentId===t.assignmentId),facts=current&&civilPromotionFacts(current,r.month,r.loyalty,r.cityCount,terms);
  if(!facts||JSON.stringify(facts.reasons)!==JSON.stringify(r.reasons)||r.reasons.length&&(r.outcome!=='INELIGIBLE')||!r.reasons.length&&r.outcome==='INELIGIBLE')throw Error('civil promotion review qualification mismatch');
  if(r.sharedRoll!==undefined){const rng=new WorldRandom();rng.initialize(`civil-promotion-v1:${save.worldRandom.seed}:${t.factionId}:${r.month}`);if(r.sharedRoll!==rng.next())throw Error('civil promotion shared roll mismatch');}
  if(r.outcome==='CHANCE_NOT_MET'&&(r.sharedRoll===undefined||r.sharedRoll<civilPromotionChance(r.policy)))throw Error('civil promotion chance review mismatch');
  if(['NOT_SELECTED','SELECTED'].includes(r.outcome)){const chosen=save.registries.civilAdministration.terms.find(term=>term.assignmentId===r.selectedAssignmentId);if(r.sharedRoll===undefined||r.sharedRoll>=civilPromotionChance(r.policy)||!chosen||chosen.factionId!==t.factionId||chosen.endReason!=='PROMOTED'||chosen.endMonth!==r.month||(r.outcome==='SELECTED')!==(chosen.assignmentId===t.assignmentId))throw Error('civil promotion review lacks an actual chosen promotion');}
 }
 if(t.endReason==='RETIREMENT'){
  const proof=t.retirement,expected=proof&&civilRetirementEvidence({...t,endMonth:undefined},t.endMonth!,save.worldRandom.seed,proof.policy);
  if(!proof||!expected||proof.roll>=proof.chance||JSON.stringify(proof)!==JSON.stringify(expected))throw Error('invalid civil retirement evidence');
 }else if(t.retirement)throw Error('retirement without actual retirement');
}
