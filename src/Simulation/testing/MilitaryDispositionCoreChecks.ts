import {formatPoliticalEvent,readPoliticalCrisis} from "../../Politics/PoliticalEventNarrative";
import {formatHistoryEventTitle} from "../../History/HistoryRenderRules";
import {projectRulerHistoricalEvents} from "../../Politics/RulerChronicle";
import {SIMULATION_FIXED_STEP_MS} from "../SimulationDriver";
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import {militaryAmbition} from '../../Politics/MilitaryPoliticalDisposition';
import {evaluateDepositionOpportunity,chooseDepositionClaimant} from '../../Politics/InReignDeposition';
import {getFactionStability} from '../../Components/City';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';

/** Same genuine two-officer/court world as the noble regression. No synthetic persons or claims. */
export function checkMilitaryDisposition(core:any,base:ReturnType<typeof exportWorldSave>,ids:string[],factionId:string,check:(v:unknown,s:string)=>void){
 try{
  hydrateWorldSave(core,structuredClone(base));
  const team=core.teams.find((t:any)=>t.name===factionId)!,month=base.world.worldMonth;
  const people=ids.map(id=>Military.getPerson(id)!);
  for(const p of people)team.getUserById(p.sourceUserId).loyalty=95;
  const restrained=Military.getPoliticalInfluence(team,month,core.logicalUnitRegistry);
  check(!restrained.candidates.length&&restrained.blocked.filter(b=>b.reason==='SUPPORTS_CONTINUITY').length===2,'two real loyal officers maintain the dynasty instead of pressuring the court');
  const p=[...people].sort((a,b)=>militaryAmbition(a.personId,a.bornMonth)-militaryAmbition(b.personId,b.bornMonth))[0],user=team.getUserById(p.sourceUserId)!;
  user.loyalty=10;
  const willing=Military.getPoliticalInfluence(team,month,core.logicalUnitRegistry);
  check(willing.candidates.length===1&&willing.candidates[0].personId===p.personId,'changing the actual User relation changes political participation without changing the real command');
  const enemy=core.teams.find((t:any)=>t!==team&&t.status==='ACTIVE')!;team.capitalCity.capture(enemy,month);for(const city of team.cities)city.loyalty=20;
  const dy=Dynasty.get(factionId)!,king=Dynasty.getCurrentRuler(factionId)!;
  const evaluation=evaluateDepositionOpportunity({factionId,status:team.status,identityStage:team.identityStage,cityCount:team.cities.length,stability:getFactionStability(team),currentRuler:king,rulers:dy.rulers,houseName:dy.houseName,worldMonth:month,events:History.getEvents(),military:Military.getPoliticalInfluence(team,month,core.logicalUnitRegistry)});
  evaluation.royalMilitaryClaims=Military.getRoyalDepositionClaims(team,month,evaluation.candidates.map(c=>c.ruler),core.logicalUnitRegistry);
  const preview=chooseDepositionClaimant(evaluation,month,0),minimum=preview?Math.min(...preview.evidence.candidates.map(c=>c.weight)):Infinity;
  const choice=Array.from({length:1000},(_,i)=>chooseDepositionClaimant(evaluation,month,evaluation.probability*(i+.5)/1000)).find(c=>c?.evidence.candidates.find(x=>x.rulerId===c.claimant.ruler.id)?.weight===minimum);
  check(choice&&choice.evidence.candidates.some(c=>c.weight>minimum),'lower-weight lawful adult claimant actually wins the reused original draw in this controlled production transaction');
  check(evaluation.eligible&&choice?.evidence.support?.personId===p.personId,'real capital-loss crisis produces a named support decision among already legal kin');if(!choice)throw Error('No legal political support');
  evaluation.selection=choice.evidence;evaluation.militaryRoll=choice.evidence.roll;
  const beforeFailure=exportWorldSave(core),write=History.addEvent;
  History.addEvent=function(e){const id=write.call(this,e);if(e.type==='ruler-deposed')throw Error('injected political-support history write failure');return id;};
  let failed=false;
  try{failed=!(Dynasty as any).commitDeposition(team,dy,king,choice.claimant.ruler,choice.claimant.relation,month,evaluation);}finally{History.addEvent=write;}
  const afterFailure=exportWorldSave(core);afterFailure.worldRandom=beforeFailure.worldRandom;
  check(failed&&diffCanonicalWorldSave(beforeFailure,afterFailure).matched,'failed real support transaction restores the complete canonical world except attempted RNG consumption');
  const bodyIds=new Set(core.teams.flatMap((t:any)=>[...t.users]).map((u:any)=>u.id));
  const count=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),commands=Military.getFormations().filter(f=>f.status==='ACTIVE').length;
  check((Dynasty as any).commitDeposition(team,dy,king,choice.claimant.ruler,choice.claimant.relation,month,evaluation),'existing authoritative deposition transaction commits the selected legal ruler');
  const newBodies=core.teams.flatMap((t:any)=>[...t.users]).filter((u:any)=>!bodyIds.has(u.id));
  check(newBodies.every((u:any)=>u.role==='RULER'&&u.rulerId===choice.claimant.ruler.id)&&core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===count+newBodies.length&&Military.getFormations().filter(f=>f.status==='ACTIVE').length===commands&&p.status==='ACTIVE'&&team.getUserById(p.sourceUserId)===user,'support preserves the same serving body and command; only the existing new-monarch map lifecycle may add its royal body');
  const saved=exportWorldSave(core),valid=validateWorldSave(saved);check(valid.valid,`political support evidence passes strict world validation: ${valid.errors.join(';')}`);
  const event=(saved.worldHistory.events as any[]).find((e:any)=>e.type==='ruler-deposed'&&e.metadata?.nextRulerId===choice.claimant.ruler.id)!;
  const liveEvent=History.getEvents().find(e=>e.id===event.id)!,political=readPoliticalCrisis(liveEvent)!;
  check(political.facts.length>0&&political.cityCount===team.cities.length&&political.stability===getFactionStability(team),'political narrative retains actual source events and boundary context');
  const reading=formatPoliticalEvent(liveEvent)!;check(reading.includes('被废')&&reading.includes(choice.claimant.ruler.givenName)&&reading.includes('统兵支持')&&!/权重|抽签|系统判定/.test(reading),'default event prose gives actual cause, legal successor and named support without developer rules');
  for(const ruler of [king,choice.claimant.ruler]){const plan=projectRulerHistoricalEvents(History.getEventsForFaction(factionId),ruler as any,factionId,month,ruler.chronicle?.notableEventIds??[]);check(plan.all.some(e=>e.id===event.id&&formatHistoryEventTitle(e,new Map())===reading),'scroll and both real monarch chronicles share the same dated political fact');}
  const oldLoyalty=user.loyalty;user.loyalty=99;check(formatPoliticalEvent(liveEvent)===reading,'later loyalty cannot rewrite historical political support or cause');user.loyalty=oldLoyalty;
  for(const field of ['cityCount','stability','birth','sourceCity','sourceMonth','sourceEvent','office']){
   const bad=structuredClone(saved),row=(bad.worldHistory.events as any[]).find(e=>e.id===event.id)!,proof=JSON.parse(String(row.metadata.politicalCrisis));
   if(field==='birth')proof.successorBornMonth--;
   else if(field==='sourceCity')proof.facts[0].cityName='future-city';
   else if(field==='sourceMonth')proof.facts[0].worldMonth=month+1;
   else if(field==='sourceEvent')proof.facts[0].eventId='foreign-or-invented';
   else if(field==='office')proof.successorOffice={personId:'not-royal',commandId:'fake',office:'SHANGJIANGJUN',eventId:'fake'};
   else proof[field]++;
   row.metadata.politicalCrisis=JSON.stringify(proof);row.description=formatPoliticalEvent({...row,year:row.monthIndex} as any);
   check(!validateWorldSave(bad).valid,`strict crisis evidence refuses forged ${field} even with regenerated prose`);
  }
  for(const edit of ['ambition','loyalty','prestige','responseThreshold','contestWeight','supporter','supportedRuler','supportBonus','choiceWeight']){
   const bad=structuredClone(saved),row=(bad.worldHistory.events as any[]).find((e:any)=>e.id===event.id)!,selection=JSON.parse(String(row.metadata!.depositionSelection)),participation=JSON.parse(String(row.metadata!.militaryParticipation));
   if(edit==='supporter')selection.support.personId='not-the-actual-officer';
   else if(edit==='supportedRuler')selection.support.rulerId='not-a-legal-claimant';
   else if(edit==='supportBonus')selection.candidates[0].supportBonus+=.01;
   else if(edit==='choiceWeight')participation.participant.politicalSelectionWeight+=.01;
   else {participation.participant.disposition[edit]+=1;participation.participant.nobleSelection.candidates[0].disposition[edit]+=1;}
   row.metadata!.depositionSelection=JSON.stringify(selection);row.metadata!.militaryParticipation=JSON.stringify(participation);
   check(!validateWorldSave(bad).valid,`strict world rejects forged political ${edit}`);
  }
  hydrateWorldSave(core,JSON.parse(JSON.stringify(saved)));
  const differences=diffCanonicalWorldSave(saved,exportWorldSave(core));
  check(differences.matched,`support, personality, life and identity survive canonical hydration unchanged: ${JSON.stringify(differences.differences.slice(0,8))}`);
  const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);const s=exportWorldSave(core);check(validateWorldSave(s).valid,'political support world remains strictly valid after twelve real months');return s;};
  const first=resume(),second=resume();check(diffCanonicalWorldSave(first,second).matched,'political support save resumes twelve months deterministically');hydrateWorldSave(core,structuredClone(first));check(diffCanonicalWorldSave(first,exportWorldSave(core)).matched,'political support continued save reads again with no duplicated identity or history');
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
