import type {WorldSaveV1} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import {capturePoliticalCrisis,readPoliticalCrisis,formatPoliticalEvent} from '../Politics/PoliticalEventNarrative';
import {getRecentDepositionEvidence} from '../Politics/InReignDeposition';
import {derivePoliticalSuccessionShocks} from '../Politics/PoliticalSuccessionCrisis';
import {getRevolutionEligibility} from '../Politics/DynasticRevolution';
import {verifiedPoliticalOffice} from '../Politics/MilitaryPoliticalInfluence';
import {importRulerSave} from './RulerSaveProjection';

/** Validate against events BEFORE the transaction, never the current city or character state. */
export function validatePoliticalCrises(save:WorldSaveV1):string[]{
 const errors:string[]=[],events=(save.worldHistory.events as WorldEvent[]).map(e=>({...e,year:e.monthIndex??e.year}));
 for(const [index,event] of events.entries()){
  if(event.metadata?.politicalCrisis===undefined)continue;
  try{
   const s=readPoliticalCrisis(event),m=event.metadata,before=events.slice(0,index),dy=save.dynasties.find(d=>d.factionId===event.actorFactionId);
   if(!s||!dy||!['ruler-deposed','dynasty-usurped'].includes(event.type)||s.kind!==(event.type==='ruler-deposed'?'DEPOSITION':'REVOLUTION')||!Number.isSafeInteger(s.cityCount)||s.cityCount<1||!Number.isFinite(s.stability)||s.stability<0||s.stability>100||typeof s.countryName!=='string'||!s.countryName||!Number.isSafeInteger(s.successorBornMonth))throw Error('context');
   const rulers=(dy.rulers as Parameters<typeof importRulerSave>[0][]).map(importRulerSave),previous=rulers.find(r=>r.id===(m.previousRulerId??m.predecessorRulerId)),next=rulers.find(r=>r.id===event.rulerId);
   if(!previous||!next||s.successorBornMonth!==next.bornYear||s.capitalCityId!==m.capitalCityId||s.capitalCityName!==m.capitalCityName)throw Error('ruler or capital snapshot');
   let ids:string[];
   if(s.kind==='DEPOSITION'){
    ids=getRecentDepositionEvidence(s.factionId,before,s.worldMonth).map(e=>e.eventId);
    if(!ids.length||ids.join(',')!==m.crisisEvidenceEventIds||!(s.stability<=40||s.cityCount<=2)||s.worldMonth%12!==0||s.worldMonth-next.bornYear<192)throw Error('deposition sources');
   }else{
    const displaced=rulers.find(r=>r.id===m.displacedSuccessorId),shocks=derivePoliticalSuccessionShocks(s.factionId,previous,s.worldMonth,before);
    if(!displaced||!['natural','combat','captured'].includes(String(m.successionReason))||s.countryName!==m.oldStateName)throw Error('succession boundary');
    const gate=getRevolutionEligibility({worldMonth:s.worldMonth,factionId:s.factionId,identityStage:'STATE',status:'ACTIVE',stability:s.stability,cityCount:s.cityCount,predecessor:previous,successor:displaced,successionReason:m.successionReason as 'natural'|'combat'|'captured',politicalShocks:shocks,
     previousSuccessionMonths:rulers.filter(r=>r.predecessorId&&r.accessionYear!==undefined&&r.accessionYear<=s.worldMonth&&(r.accessionYear<s.worldMonth||(r.reignOrdinal??0)<=(previous.reignOrdinal??0))).map(r=>r.accessionYear!)});
    if(gate.blockers.length||gate.riskTier!==m.riskTier||gate.evidence.join(',')!==m.vulnerabilityEvidence)throw Error('revolution gates');
    ids=gate.observedPoliticalShocks.map(s=>s.eventId);
   }
   const {version:_,facts:__,...input}=s;
   if(JSON.stringify(capturePoliticalCrisis(input,ids,before))!==JSON.stringify(s))throw Error('historical source facts');
   if(s.successorOffice){
    const o=s.successorOffice,p=save.registries.militaryCommandRegistry.people.find(p=>p.personId===next.militaryIdentity?.personId),standing=p&&verifiedPoliticalOffice(p,o.commandId,s.factionId,s.worldMonth,before);
    if(!p||p.personId!==o.personId||!standing||standing.office!==o.office||standing.eventId!==o.eventId)throw Error('office provenance');
   }
   if(typeof m.militaryParticipation==='string'){
    const context=JSON.parse(m.militaryParticipation).politicalContext;if(context.cityCount!==s.cityCount||context.stability!==s.stability)throw Error('military context');
   }
   if(event.description!==formatPoliticalEvent(event))throw Error('narrative');
  }catch(error){errors.push(`invalid political crisis narrative evidence: ${event.id} (${String(error)})`);}
 }
 return errors;
}
