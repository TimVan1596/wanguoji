import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import {militaryAmbition} from '../../Politics/MilitaryPoliticalDisposition';
import {evaluateDepositionOpportunity,chooseDepositionClaimant} from '../../Politics/InReignDeposition';
import {getFactionStability} from '../../Components/City';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {canonicalWorldSaveProjection} from '../../Persistence/WorldSaveSchema';

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
  const choice=chooseDepositionClaimant(evaluation,month,evaluation.probability*.73);
  check(evaluation.eligible&&choice?.evidence.support?.personId===p.personId,'real capital-loss crisis produces a named support decision among already legal kin');if(!choice)throw Error('No legal political support');
  evaluation.selection=choice.evidence;evaluation.militaryRoll=choice.evidence.roll;
  const bodyIds=new Set(core.teams.flatMap((t:any)=>[...t.users]).map((u:any)=>u.id));
  const count=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),commands=Military.getFormations().filter(f=>f.status==='ACTIVE').length;
  check((Dynasty as any).commitDeposition(team,dy,king,choice.claimant.ruler,choice.claimant.relation,month,evaluation),'existing authoritative deposition transaction commits the selected legal ruler');
  const newBodies=core.teams.flatMap((t:any)=>[...t.users]).filter((u:any)=>!bodyIds.has(u.id));
  check(newBodies.every((u:any)=>u.role==='RULER'&&u.rulerId===choice.claimant.ruler.id)&&core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===count+newBodies.length&&Military.getFormations().filter(f=>f.status==='ACTIVE').length===commands&&p.status==='ACTIVE'&&team.getUserById(p.sourceUserId)===user,'support preserves the same serving body and command; only the existing new-monarch map lifecycle may add its royal body');
  const saved=exportWorldSave(core),valid=validateWorldSave(saved);check(valid.valid,`political support evidence passes strict world validation: ${valid.errors.join(';')}`);
  const event=(saved.worldHistory.events as any[]).find((e:any)=>e.type==='ruler-deposed'&&e.metadata?.nextRulerId===choice.claimant.ruler.id)!;
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
  const canonical=canonicalWorldSaveProjection(saved);hydrateWorldSave(core,JSON.parse(JSON.stringify(saved)));
  check(JSON.stringify(canonicalWorldSaveProjection(exportWorldSave(core)))===JSON.stringify(canonical),'support, personality, life and identity survive canonical hydration unchanged');
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
