import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {selectCourtInstigator,courtAttemptChance} from '../../Politics/CourtCoup';
import {evaluateDepositionOpportunity} from '../../Politics/InReignDeposition';
import {getFactionStability} from '../../Components/City';
import {projectFamilyArchive} from '../../Politics/FamilyArchiveProjection';
import {familyNoblePeriods} from '../../Politics/FamilyNoblePeriods';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
/** Independent production example, not a replay of the user's unprovided Gui save. */
export function checkFamilyForfeiture(core:any,personId:string,familyId:string,check:(v:unknown,s:string)=>void){
 const original=exportWorldSave(core),clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
 const person=()=>Military.getPerson(personId)!,family=()=>Military.getFamilies().find(f=>f.familyId===familyId)!,factionId=family().factionId,team=()=>core.teams.find((t:any)=>t.name===factionId),base=person().appointments.at(-1)!.startMonth;
 const strict=()=>{const s=exportWorldSave(core),v=validateWorldSave(s);check(v.valid,`new-period forfeiture strict save: ${v.errors.join(';')}`);return s;};
 const gather=()=>{const t=team(),center=t.capitalCity.block;for(const u of t.users){u.player.setPosition(center.x+2,center.y+2);u.player.body.reset(u.player.x,u.player.y);const state=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId)?.state;if(state){state.logicalX=center.x+2;state.logicalY=center.y+2;}}};
 try{
  clock(base+60);gather();(Military as any).advanceOffices(base+60,core.teams);
  for(const [months,rank]of [[120,'HOU'],[180,'GONG']] as const){
   const used=new Set(person().nobilityHistory!.flatMap(g=>g.cityIds));
   const towns=core.allCities.filter((c:any)=>c.ownerFactionId!==factionId&&!c.destroyed&&!used.has(c.id)).sort((a:any,b:any)=>Number(core.teams.find((t:any)=>t.name===b.ownerFactionId)?.capitalCity===b)-Number(core.teams.find((t:any)=>t.name===a.ownerFactionId)?.capitalCity===a)||String(a.id).localeCompare(String(b.id))).slice(0,2);
   check(towns.length===2,'higher peerage uses two additional distinct existing cities, not copied ancestral merits');
   for(const [i,c]of towns.entries()){const month=base+months-36+i*12;clock(month);const u=team().getUserById(person().sourceUserId);u.player.setPosition(c.block.x,c.block.y);u.player.body.reset(u.player.x,u.player.y);const state=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId)!.state;state.logicalX=c.block.x;state.logicalY=c.block.y;c.capture(team(),month,undefined,person().appointments.at(-1)!.commandId,personId);}
   clock(base+months);gather();(Military as any).advanceOffices(base+months,core.teams);Military.updateNobility(base+months,core.teams,Dynasty.getAll());Military.updateFamilyTitles(base+months,core.teams,Dynasty.getAll());
   check(person().nobilityHistory?.at(-1)?.rank===rank&&family().nobleSuccession?.at(-1)?.kind==='STARTED'&&family().nobleSuccession?.at(-1)?.rank===rank,`actual independent ${rank} merit opens exactly one higher hereditary period`);strict();
  }
  const month=base+192,enemy=core.teams.find((e:any)=>e!==team()&&e.status==='ACTIVE');clock(month-1);team().capitalCity.capture(enemy,month-1);clock(month);team().cities.forEach((c:any)=>c.loyalty=20);gather();for(const u of team().users)u.loyalty=u.militaryPersonId===personId?0:100;(Military as any).advanceOffices(month,core.teams);
  const dy=Dynasty.get(factionId)!,king=Dynasty.getCurrentRuler(factionId)!,evaluation=evaluateDepositionOpportunity({factionId,status:team().status,identityStage:team().identityStage,cityCount:team().cities.length,stability:getFactionStability(team()),currentRuler:king,rulers:dy.rulers,houseName:dy.houseName,worldMonth:month,events:History.getEventsForFaction(factionId),military:Military.getPoliticalInfluence(team(),month,core.logicalUnitRegistry)});
  evaluation.royalMilitaryClaims=Military.getRoyalDepositionClaims(team(),month,evaluation.candidates.map(c=>c.ruler),core.logicalUnitRegistry);const actor=selectCourtInstigator(evaluation,Military.getPeople(),Military.getCourtAttemptInfluence(team(),month,core.logicalUnitRegistry));
  check(actor?.personId===personId&&actor.unitCount>=3,'new-period duke must be the real willing political instigator with at least three existing command members');if(!actor)throw Error('No qualified actual actor');
  const prior=JSON.stringify(family().nobleSuccession),oldPeriods=familyNoblePeriods(family(),month),next=random.next;random.next=()=>{next.call(random);return courtAttemptChance(actor)*.95;};try{(Dynasty as any).evaluateInReignDeposition(team(),dy,king,month);}finally{random.next=next;}
  check(person().politicalHistory?.at(-1)?.severity==='FORFEITURE'&&person().honorHistory?.some(h=>h.kind==='REVOKED'&&h.rank==='GONG'&&h.month===month),'real failed court transaction dismisses, bans and formally revokes the same new-period duke');
  const before=strict(),writer=History.addEvent;History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='family-title-ended'){random.next();throw Error('injected period forfeiture ending');}return id;};try{Military.updateFamilyTitles(month,core.teams,Dynasty.getAll());}finally{History.addEvent=writer;}
  check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'failure to write current-period forfeiture restores title state, history and RNG without erasing the already committed court punishment');
  Military.updateFamilyTitles(month,core.teams,Dynasty.getAll());const ended=family().nobleSuccession!.at(-1)!;
  check(ended.kind==='ENDED'&&['FORFEITED','REVOKED'].includes(ended.reason)&&ended.period===4&&JSON.stringify(family().nobleSuccession!.slice(0,-1))===prior,'only current fourth period ends; all original BO/HOU/GONG sources and previous periods remain immutable');
  const source={people:Military.getPeople(),events:History.getRecordedEvents(),dynasties:Dynasty.getAll()},member=family().members.find(m=>m.militaryPersonId===personId)!;
  check(projectFamilyArchive(family(),{...source,month:month-1}).rows.get(member.memberId)?.effectivePersonal?.rank==='GONG'&&!projectFamilyArchive(family(),{...source,month}).rows.get(member.memberId)?.effectivePersonal&&!projectFamilyArchive(family(),{...source,month}).currentInheritedHolderId,'reading before and after the actual punishment never backfills forfeiture or leaves an effective duke/heir');
  check(familyNoblePeriods(family(),month).length===oldPeriods.length&&family().members.every(m=>m.memberId===member.memberId||!Military.getPerson(m.militaryPersonId??'')?.politicalHistory?.some(a=>a.courtCoupEventId===person().politicalHistory!.at(-1)!.courtCoupEventId)),'the same period count and unpunished relatives remain; no title copy, new hereditary root or family collective guilt');
  const saved=strict();hydrateWorldSave(core,structuredClone(saved));check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'new-period formal forfeiture strictly reads back with identical identity, previous periods and unique history');
 }finally{hydrateWorldSave(core,structuredClone(original));}
}
