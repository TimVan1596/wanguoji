import type {RulerSaveV17,WorldSaveV1} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import {importRulerSave} from './RulerSaveProjection';
import {deriveMilitaryLifeSchedule} from '../Politics/MilitaryLifeRules';
import {selectMilitaryUsurper} from '../Politics/MilitaryUsurpation';
import {validNoblePoliticalSelection} from './MilitaryNobleSelectionValidation';
import {derivePoliticalSuccessionShocks} from '../Politics/PoliticalSuccessionCrisis';
import {getDynasticRevolutionChance} from '../Politics/DynasticRevolution';
import {readPoliticalCrisis} from '../Politics/PoliticalEventNarrative';

/** Separate non-kin provenance. Royal kin/enlistment validation is not weakened or reused as identity. */
export function validateMilitaryUsurpers(save:WorldSaveV1):string[]{
 const errors:string[]=[],state=save.registries.militaryCommandRegistry,events=(save.worldHistory.events as WorldEvent[]).map(e=>({...e,year:e.monthIndex??e.year}));
 const owners=save.dynasties.flatMap(d=>(d.rulers as RulerSaveV17[]).map(r=>({d,r}))),seen=new Set<string>();
 for(const {d,r} of owners){
  const i=r.militaryUsurperIdentity;if(i===undefined)continue;
  try{
   const p=state.people.find(p=>p.personId===i?.personId),f=state.formations.find(f=>f.commandId===i?.commandId),a=p?.appointments.find(a=>a.commandId===i.commandId&&a.factionId===d.factionId),at=i.accessionMonth;
   if(!p||!f||!a||i.version!==1||seen.has(i.personId)||r.militaryIdentity||r.residentIdentity||p.royalIdentity||p.politicalRulerId!==r.rulerId||p.status==='ACTIVE'||r.relationType!=='USURPER'||r.parentId||i.factionId!==d.factionId||i.sourceUserId!==p.sourceUserId||i.sourceUserLabel!==p.name||i.bornMonth!==p.bornMonth||r.bornMonth!==p.bornMonth||r.naturalDeathMonth!==deriveMilitaryLifeSchedule(p).naturalDeathMonth||i.naturalDeathMonth!==r.naturalDeathMonth||r.deathMonth!==p.deathMonth||r.accessionMonth!==at||r.predecessorId!==i.predecessorRulerId||`${r.houseName.replace(/氏$/,'')}${r.givenName}`!==p.personalName||a.endMonth!==at||a.endReason!=='DISMISSED'||f.status!=='DISBANDED'||f.commanderPersonId!==p.personId||f.factionId!==d.factionId)throw Error('unique person/life/command');
   if(owners.some(x=>x.r.rulerId!==r.rulerId&&(x.r.militaryIdentity?.personId===p.personId||x.r.residentIdentity?.personId===p.personId||x.r.militaryUsurperIdentity?.personId===p.personId)))throw Error('duplicate political life');
   seen.add(i.personId);
   const index=events.findIndex(e=>e.type==='dynasty-usurped'&&e.rulerId===r.rulerId),event=events[index],before=events.slice(0,index),m=event?.metadata,context=event&&readPoliticalCrisis(event);
   const rulers=(d.rulers as RulerSaveV17[]).map(importRulerSave),previous=rulers.find(q=>q.id===i.predecessorRulerId),displaced=rulers.find(q=>q.id===i.displacedSuccessorId);
   if(!event||!m||!context||event.actorFactionId!==d.factionId||event.year!==at||m.militaryUsurperIdentity!==JSON.stringify(i)||m.militaryUsurperPersonId!==p.personId||m.displacedSuccessorId!==i.displacedSuccessorId||!previous||!displaced||previous.houseName===r.houseName||displaced.houseName!==previous.houseName||previous.deathMonth!==at||displaced.displacedByUsurpationMonth!==at)throw Error('real succession boundary');
   const q=i.participant,proof=q?.nobleSelection,first=proof?.candidates[0];
   if(!proof||!first||q.personId!==p.personId||q.commandId!==i.commandId||q.officeStanding?.office!==i.office||q.officeStanding.eventId!==i.officeEventId||q.officeStanding.appointmentEventId!==i.appointmentEventId||!validNoblePoliticalSelection({...first,nobleSelection:proof},save,before,at,d.factionId,{...d,rulers} as any,previous.id,3)||JSON.stringify(q.memberUnitIds)!==JSON.stringify([...f.memberUnitIds].sort())||JSON.stringify({...q,nobleSelection:undefined})!==JSON.stringify({...proof.candidates.find(c=>c.personId===p.personId),nobleSelection:undefined}))throw Error('military and office sources');
   const people=state.people.map(person=>{const owner=owners.find(o=>o.r.rulerId===person.politicalRulerId)?.r;return {...person,status:'ACTIVE' as const,deathMonth:undefined,deathCause:undefined,politicalRulerId:owner?.accessionMonth!==undefined&&owner.accessionMonth<at?person.politicalRulerId:undefined};});
   if(selectMilitaryUsurper(proof.candidates,people,previous.houseName)?.personId!==p.personId)throw Error('qualified candidate competition');
   const gate={worldMonth:at,factionId:d.factionId,identityStage:'STATE',status:'ACTIVE',cityCount:context.cityCount,stability:context.stability,predecessor:previous,successor:displaced,successionReason:m.successionReason as 'natural'|'combat'|'captured',politicalShocks:derivePoliticalSuccessionShocks(d.factionId,previous,at,before),previousSuccessionMonths:rulers.filter(q=>q.predecessorId&&q.accessionYear!==undefined&&q.accessionYear<=at&&(q.accessionYear<at||(q.reignOrdinal??0)<=(previous.reignOrdinal??0))).map(q=>q.accessionYear!)};
   const chance=getDynasticRevolutionChance({...gate,military:{candidates:proof.candidates,blocked:[],identityBlocked:0}}),base=getDynasticRevolutionChance(gate);
   if(!i.opportunity||i.opportunity.chance!==chance||i.opportunity.baselineChance!==base||!Number.isFinite(i.opportunity.roll)||i.opportunity.roll<0||i.opportunity.roll>=chance)throw Error('original successful roll');
   const bodies=save.users.filter(u=>u.userId===p.sourceUserId||u.historicalPersonId===p.personId||u.militaryPersonId===p.personId);
   if(bodies.length>1||r.status==='ruling'&&d.currentRulerId===r.rulerId&&bodies.length!==1)throw Error('missing or duplicate body');
   for(const u of bodies)if(r.deathMonth!==undefined||u.userId!==p.sourceUserId||u.name!==p.name||u.bornMonth!==p.bornMonth||u.historicalPersonId!==p.personId||u.militaryPersonId!==p.personId||u.role==='RULER'&&(u.rulerId!==r.rulerId||u.factionId!==d.factionId||d.currentRulerId!==r.rulerId||r.status!=='ruling'))throw Error('body identity or authority');
  }catch(error){errors.push(`invalid military usurper identity: ${r.rulerId} (${String(error)})`);}
 }
 return errors;
}
