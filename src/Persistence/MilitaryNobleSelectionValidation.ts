import {militaryPoliticalDefense} from '../Politics/MilitaryPoliticalInfluence';
import type {WorldSaveV1} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import type {Dynasty} from '../Politics/Dynasty';
import {currentNobleGrant,nobleEpochForRuler,NOBLE_RANKS} from '../Politics/MilitaryNobility';
import {deriveMilitaryCareer} from '../Politics/MilitaryCareerEvidence';
import {deriveMilitaryLifeSchedule} from '../Politics/MilitaryLifeRules';
import {militaryPoliticalStrength,compareMilitaryStanding,ENABLE_NOBILITY_POLITICAL_WEIGHT,type MilitaryPoliticalParticipant} from '../Politics/MilitaryPoliticalInfluence';
import {MILITARY_FORMATION_CAPACITY} from '../Politics/MilitaryOffice';
/** Validate the original eligible-candidate snapshot, not today's changed unit roster. */
export function validNoblePoliticalSelection(s:MilitaryPoliticalParticipant,save:WorldSaveV1,before:WorldEvent[],at:number,factionId:string,dy:Dynasty,previousRulerId:string){
 const scope=nobleEpochForRuler(dy,previousRulerId)?.foundingRulerId,ids=new Set(before.map(e=>e.id)),state=save.registries.militaryCommandRegistry;
 const grantFor=(p:typeof state.people[number])=>scope?currentNobleGrant({...p,honorHistory:p.honorHistory?.filter(h=>ids.has(h.eventId)),nobilityHistory:p.nobilityHistory?.filter(g=>ids.has(g.eventId))},factionId,at,scope):undefined;
 const selected=state.people.find(p=>p.personId===s.personId),proof=s.nobleSelection;
 if(!proof)return !s.nobility&&s.basePoliticalWeight===undefined&&s.finalPoliticalWeight===undefined&&(!ENABLE_NOBILITY_POLITICAL_WEIGHT||!selected||!grantFor(selected));
 if(!ENABLE_NOBILITY_POLITICAL_WEIGHT||!scope||proof.scopeFounderId!==scope||!Array.isArray(proof.candidates)||!proof.candidates.length||proof.candidates.length>2)return false;
 const people=new Set<string>(),units=new Set<string>();
 for(const q of proof.candidates){
  const p=state.people.find(p=>p.personId===q.personId),f=state.formations.find(f=>f.commandId===q.commandId),a=p?.appointments.find(a=>a.commandId===q.commandId&&a.factionId===factionId&&a.startMonth<=at&&at<=(a.endMonth??at));
  if(!p||!f||!a||people.has(p.personId)||f.commanderPersonId!==p.personId||f.factionId!==factionId||q.factionId!==factionId||q.sourceUserId!==p.sourceUserId||q.bornMonth!==p.bornMonth||q.name!==p.name||q.personalName!==p.personalName||p.deathMonth!==undefined&&(p.deathMonth<at||p.deathMonth===at&&before.some(e=>e.type==='military-person-died'&&e.metadata?.personId===p.personId))||at>=deriveMilitaryLifeSchedule(p).retirementMonth)return false;
  const office=a.officeHistory?.filter(g=>g.month<=at&&ids.has(g.eventId)).at(-1)?.office;
  if(!office||!Array.isArray(q.memberUnitIds)||q.unitCount!==q.memberUnitIds.length||q.unitCount<1||q.unitCount>MILITARY_FORMATION_CAPACITY[office]||!q.memberUnitIds.includes(q.commanderUnitId)||q.memberUnitIds.some(id=>typeof id!=='string'||!id||units.has(id))||new Set(q.memberUnitIds).size!==q.unitCount)return false;
  people.add(p.personId);q.memberUnitIds.forEach(id=>units.add(id));
  const career=deriveMilitaryCareer(p,state.formations,before,at),defense=militaryPoliticalDefense(p,state.formations,before,at,factionId),strength=militaryPoliticalStrength(career.serviceMonths,q.unitCount,career.verifiedCaptures,defense.eventIds.length,defense.localServiceMonths),g=grantFor(p),weight=q.strength*(1+(g?(NOBLE_RANKS.indexOf(g.rank)+1)*.05:0));
  if(JSON.stringify(q.defenseEventIds??[])!==JSON.stringify(defense.eventIds)||!strength.eligible||q.strength!==strength.strength||q.serviceMonths!==career.serviceMonths||JSON.stringify(q.capturedEventIds)!==JSON.stringify(career.capturedEventIds.slice().sort())||q.basePoliticalWeight!==q.strength||q.finalPoliticalWeight!==weight||JSON.stringify(q.nobility)!==JSON.stringify(g?{eventId:g.eventId,rank:g.rank,countryName:g.countryName}:undefined))return false;
 }
 const ordered=[...proof.candidates].sort(compareMilitaryStanding),first=ordered[0];
 const {nobleSelection:_,...participant}=s;
 return proof.candidates.some(q=>q.nobility)&&first.personId===s.personId&&JSON.stringify(participant)===JSON.stringify(first)&&ordered.every((q,i)=>q.personId===proof.candidates[i].personId);
}
