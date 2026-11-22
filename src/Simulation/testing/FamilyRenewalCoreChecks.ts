import {familyBirthSource} from '../../Politics/FamilyChildBirth';
import {checkFamilyForfeiture} from './FamilyForfeitureCoreChecks';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import Military,{deriveUserBornMonth} from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {getLocalUserId} from '../../Live/LocalDanmaku';
import {deriveMilitaryLifeSchedule} from '../../Politics/MilitaryLifeRules';
import {planFamilyPopulationEntry} from '../../Politics/MilitaryFamily';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
/** Existing real civilian creation; no preallocated child, invented User or overwritten birthday. */
function descendant(core:any,familyId:string,parentId:string,month:number,check:(v:unknown,s:string)=>void,needsService=false){
 const f=Military.getFamilies().find(f=>f.familyId===familyId)!,t=core.teams.find((t:any)=>t.name===f.factionId),population=core.simulator.population;
 while(t.users.size>=population.getCapacity(t)){const u=[...t.users].find((u:any)=>u.role==='NORMAL'&&!u.militaryPersonId&&!Military.getCommandForUnit(u.player.logicalUnitId??'')) as any;if(!u)throw Error('No safe real population slot');u.destroyUser(false,{cause:'GOD_ACTION',month});}
 let counter:number|undefined;
 for(let n=Math.max(1,(population.counters[f.factionId]??0)+1);n<20000;n++){const label=`${t.shortName??t.name}-${String(n).padStart(3,'0')}`,id=getLocalUserId(label),born=deriveUserBornMonth(id,label,f.factionId,month);if(core.teams.some((t:any)=>t.getUserById(id))||Military.getPeople().some(p=>p.sourceUserId===id)||Military.getFamilies().some(f=>f.members.some(m=>m.sourceUserId===id)))continue;const plan=planFamilyPopulationEntry(Military.getFamilies(),f.factionId,f.epochFounderId,id,born,month,String(random.exportState().seed));if(plan?.familyId===familyId&&plan.member.parentMemberId===parentId&&(!needsService||deriveMilitaryLifeSchedule({personId:Military.nextPersonId(),bornMonth:born}).retirementMonth>month+72)){counter=n;break;}}
 check(counter!==undefined,'a controlled actual natural-population entry can supply the specified legitimate direct child');if(counter===undefined)throw Error('No legitimate natural entry found');population.counters[f.factionId]=counter-1;return population.spawn(t,undefined,false,{cause:'NATURAL_GROWTH',month});
}
export function checkFamilyRenewalCore(core:any,heirId:number,factionId:string,check:(v:unknown,s:string)=>void){
 const original=exportWorldSave(core),clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false}),strict=()=>{const s=exportWorldSave(core),v=validateWorldSave(s);check(v.valid,`renewal/time strict save: ${v.errors.join(';')}`);return s;};
 try{
  Military.setFamilyNoblePolicyForSimulation('RENEWAL');const t=core.teams.find((t:any)=>t.name===factionId),u=t.getUserById(heirId),p=Military.getPerson(u.militaryPersonId)!,link=Military.getFamilyMember(u.id,u.bornMonth)!,familyId=link.family.familyId,memberId=link.member.memberId,base=p.appointments.at(-1)!.startMonth,command=p.appointments.at(-1)!.commandId,enemy=core.teams.find((e:any)=>e!==t&&e.status==='ACTIVE'),towns=t.cities.filter((c:any)=>c!==t.capitalCity&&!c.destroyed).slice(0,2);
  check(towns.length===2,'renewal uses two pre-existing cities and their real military capture transactions');
  for(const [i,c]of towns.entries()){const month=base+12*(i+1);clock(month);c.capture(enemy,month);u.player.setPosition(c.block.x,c.block.y);u.player.body.reset(u.player.x,u.player.y);const unit=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId)!.state;unit.logicalX=c.block.x;unit.logicalY=c.block.y;c.capture(t,month,undefined,command,p.personId);}
  clock(base+60);Military.updateNobility(base+60,core.teams,Dynasty.getAll());const g=p.nobilityHistory?.find(g=>g.rank==='BO');check(g,'the descendant earns its own military BO by actual service and personal captures');if(!g)throw Error('Real descendant military BO not eligible');
  const childMonth=Math.max(base+72,Math.ceil((link.member.bornMonth+38*12)/12)*12);
  const before=strict(),oldActs=JSON.stringify(link.family.nobleSuccession),writer=History.addEvent;
  for(const mode of ['event','state']){const commit=Military.commitFamilyTitle;History.addEvent=function(e){const id=writer.call(this,e);if(mode==='event'&&e.type==='family-title-started'){random.next();throw Error('injected renewal history');};return id;};Military.commitFamilyTitle=function(...args){commit.apply(this,args);if(mode==='state'&&args[1].kind==='STARTED'){random.next();throw Error('injected renewal state');};};try{Military.updateFamilyTitles(base+60,core.teams,Dynasty.getAll());}finally{History.addEvent=writer;Military.commitFamilyTitle=commit;}check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,`${mode} failure rolls back the new hereditary period, source event, state, identities and RNG completely`);}
  Military.updateFamilyTitles(base+60,core.teams,Dynasty.getAll());const f=Military.getFamilies().find(f=>f.familyId===familyId)!,a=f.nobleSuccession!.at(-1)!;
  check(a.kind==='STARTED'&&a.period===2&&a.sourceGrantEventId===g.eventId&&a.rank==='BO'&&JSON.stringify(f.nobleSuccession!.slice(0,-1))===oldActs,'real personal BO starts one sourced second period from an ended or lower inherited period without rewriting prior acts');
  const opened=strict();if(f.nobleSuccession?.[0].kind==='SUCCEEDED')checkFamilyForfeiture(core,p.personId,familyId,check);
  {const resume=()=>{hydrateWorldSave(core,structuredClone(opened));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return strict();};const x=resume(),y=resume();check(diffCanonicalWorldSave(x,y).matched,'an actual second-period save resumes twelve months with identical RNG, persons, titles and original history');hydrateWorldSave(core,structuredClone(x));check(diffCanonicalWorldSave(x,exportWorldSave(core)).matched,'second read preserves new-period source and the single lawful holder');hydrateWorldSave(core,structuredClone(opened));}
  Military.updateFamilyTitles(base+60,core.teams,Dynasty.getAll());check(diffCanonicalWorldSave(opened,exportWorldSave(core)).matched,'new period source cannot be consumed twice');
  for(const altered of ['period','source','holder']){const forged=structuredClone(opened),act=forged.registries.militaryCommandRegistry.families!.find(f=>f.familyId===familyId)!.nobleSuccession!.at(-1)!;if(altered==='period')act.period=3;if(altered==='source')act.sourceGrantEventId=opened.registries.militaryCommandRegistry.families!.find(f=>f.familyId===familyId)!.nobleSuccession![0].sourceGrantEventId;if(altered==='holder')act.holderMemberId=act.previousMemberId+'-fake';(forged.worldHistory.events as import('../../History/WorldHistory').WorldEvent[]).find(e=>e.id===act.eventId)!.metadata!.familyNobleAct=JSON.stringify(act);check(!validateWorldSave(forged).valid,`strict replay rejects forged new-period ${altered}, even when its history echo is altered`);}
  // A child present before the death actually inherits from the second period.
  // A second independent production branch: the old family graph survives a real foreign service career.
  {
   clock(childMonth);const child=descendant(core,familyId,memberId,childMonth,check),body=core.teams.find((t:any)=>t.name===factionId).getUserById(heirId),foreign=core.teams.find((t:any)=>t.name!==factionId&&t.status==='ACTIVE'&&t.identityStage==='STATE');
   check(foreign,'an existing foreign state supplies an independent lawful political authority');
   body.setTeam(foreign,{cause:'LIVE_TRANSFER',month:childMonth});child.setTeam(foreign,{cause:'LIVE_TRANSFER',month:childMonth});Military.updateFamilyTitles(childMonth,core.teams,Dynasty.getAll());
   check(Military.getFamilies().find(f=>f.familyId===familyId)!.nobleSuccession!.at(-1)!.reason==='FOREIGN','real transfer terminates the old home-authority chain without deleting parentage');
   for(const officer of Military.getPeople().filter(p=>p.factionId===foreign.name&&p.status==='ACTIVE'))Military.endPersonCommands(officer.personId,childMonth,'DISMISSED');
   check((Military as any).appoint(body,foreign.name,childMonth,[body.player.logicalUnitId]),'the same actual descendant obtains a lawful foreign initial command through existing appointment gates');
   const command=Military.getPerson(p.personId)!.appointments.at(-1)!.commandId;
   const targets=core.allCities.filter((c:any)=>!c.destroyed&&c.ownerFactionId!==foreign.name).sort((a:any,b:any)=>Number(core.teams.some((t:any)=>t.capitalCity===b))-Number(core.teams.some((t:any)=>t.capitalCity===a))||a.id.localeCompare(b.id)).slice(0,6);
   check(targets.length===6,'six pre-existing foreign cities supply actual new-country capture evidence');
   const captureMonths=[12,24,48,84,96,108];
   for(let offset=1;offset<=180;offset++){const month=childMonth+offset;clock(month);Dynasty.update(month,core.teams);const i=captureMonths.indexOf(offset);if(i>=0){const c=targets[i],opponent=core.teams.find((t:any)=>t!==foreign&&t.status==='ACTIVE');check(opponent,'each directed capture has an existing hostile political owner');c.capture(opponent,month);body.player.setPosition(c.block.x,c.block.y);body.player.body.reset(body.player.x,body.player.y);const logical=core.logicalUnitRegistry.getEntry(body.player.logicalUnitId)!.state;logical.logicalX=c.block.x;logical.logicalY=c.block.y;c.capture(foreign,month,undefined,command,p.personId);}
    if(month%12===0)(Military as any).advanceOffices(month,core.teams);Military.updateNobility(month,core.teams,Dynasty.getAll());Military.updateFamilyTitles(month,core.teams,Dynasty.getAll());
   }
   const house=Military.getFamilies().find(f=>f.familyId===familyId)!,act=house.nobleSuccession!.at(-1)!;
   check(act.kind==='STARTED'&&act.factionId===foreign.name&&act.rank==='GONG'&&house.factionId===factionId,'foreign independent military merit and later promotions establish the new dukedom authority without reviving or moving the ancestral house');
   const foreignSave=strict();hydrateWorldSave(core,structuredClone(foreignSave));check(diffCanonicalWorldSave(foreignSave,exportWorldSave(core)).matched,'cross-country new period strictly reads its own grant, promotion and original father-son evidence');
   const death=childMonth+181;clock(death);const live=core.teams.find((t:any)=>t.name===foreign.name).getUserById(heirId);check(live.destroyUser(false,{cause:'BATTLE_DEATH',month:death}),'the new foreign duke dies through the actual person and military transaction');Military.updateFamilyTitles(death,core.teams,Dynasty.getAll());
   const inherited=Military.getFamilies().find(f=>f.familyId===familyId)!.nobleSuccession!.at(-1)!;
   check(inherited.kind==='SUCCEEDED'&&inherited.rank==='HOU'&&inherited.factionId===foreign.name&&Military.getFamilies().find(f=>f.familyId===familyId)!.members.find(m=>m.memberId===inherited.holderMemberId)?.sourceUserId===child.id,'the real registered son lawfully descends GONG to HOU in the new country, with no copied ancestry or population');strict();
   hydrateWorldSave(core,structuredClone(opened));
  }
  clock(childMonth);const child=descendant(core,familyId,memberId,childMonth,check),pop=core.teams.reduce((n:number,t:any)=>n+t.users.size,0);check(core.teams.find((t:any)=>t.name===factionId).getUserById(heirId).destroyUser(false,{cause:'BATTLE_DEATH',month:childMonth}),'new-period root dies through the authoritative military/User transaction');Military.updateFamilyTitles(childMonth,core.teams,Dynasty.getAll());const inherited=Military.getFamilies().find(f=>f.familyId===familyId)!.nobleSuccession!.at(-1)!;
  check(inherited.kind==='SUCCEEDED'&&inherited.period===2&&inherited.rank==='ZI'&&inherited.holderMemberId===child.familyMemberId&&!child.militaryPersonId&&core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===pop-1,'second period legally descends BO to one real registered civilian ZI, without a military identity, extra army or extra population');strict();
  // In a separate fork the same father has no registered child until after his death.
  hydrateWorldSave(core,structuredClone(opened));clock(childMonth);core.teams.find((t:any)=>t.name===factionId).getUserById(heirId).destroyUser(false,{cause:'BATTLE_DEATH',month:childMonth});Military.updateFamilyTitles(childMonth,core.teams,Dynasty.getAll());const ended=Military.getFamilies().find(f=>f.familyId===familyId)!.nobleSuccession!.at(-1)!;check(ended.kind==='ENDED'&&ended.reason==='NO_HEIR','actual second-period death without a currently registered child ends the period');const sealed=JSON.stringify(ended);
  clock(childMonth+12);const f2=Military.getFamilies().find(f=>f.familyId===familyId)!,members=JSON.stringify(f2.members),seed=String(random.exportState().seed);
  for(let id=100;id<300;id++)check(!planFamilyPopulationEntry([f2],factionId,f2.epochFounderId,id,childMonth-216,childMonth+12,seed),'closed second period rejects new ordinary-population kin assignment');
  Military.updateFamilyHouseholds(childMonth+12,core.teams,Dynasty.getAll());Military.updateFamilyTitles(childMonth+12,core.teams,Dynasty.getAll());check(JSON.stringify(f2.members)===members&&JSON.stringify(f2.nobleSuccession!.at(-1))===sealed,'closed no-heir period retains every existing member and the sealed act without adding special offspring');strict();


 }finally{hydrateWorldSave(core,structuredClone(original));}
}

/** A no-heir founder has truly ended; closure must not fabricate a later branch. */
export function checkLateFamilyRestartCore(core:any,familyId:string,check:(v:unknown,s:string)=>void){
 const original=exportWorldSave(core),clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
 try{
  const f=Military.getFamilies().find(f=>f.familyId===familyId)!,month=Math.ceil(((f.nobleSuccession?.at(-1)?.month??0)+12)/12)*12;clock(month);
  check(f.nobleSuccession?.at(-1)?.kind==='ENDED','real no-heir family is formally closed');
  const members=JSON.stringify(f.members),acts=JSON.stringify(f.nobleSuccession),seed=String(random.exportState().seed),population=core.teams.reduce((n:number,t:any)=>n+t.users.size,0);
  for(let id=100;id<300;id++)check(!planFamilyPopulationEntry([f],f.factionId,f.epochFounderId,id,month-216,month,seed),'ended original title cannot attach another ordinary resident as a fabricated descendant');
  for(const m of f.members)check(!familyBirthSource(f,m,month,m.militaryPersonId?Military.getPerson(m.militaryPersonId):undefined),'ended original title supplies no special family birth authority');
  Military.updateFamilyHouseholds(month,core.teams,Dynasty.getAll());Military.updateFamilyTitles(month,core.teams,Dynasty.getAll());
  check(JSON.stringify(f.members)===members&&JSON.stringify(f.nobleSuccession)===acts&&core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===population,'closure preserves registered identities, sealed source acts and real population');
  const save=exportWorldSave(core);check(validateWorldSave(save).valid,'closed original family remains strictly readable');hydrateWorldSave(core,structuredClone(save));check(diffCanonicalWorldSave(save,exportWorldSave(core)).matched,'closed original family strictly round-trips without a new branch');
 }finally{hydrateWorldSave(core,structuredClone(original));}
}
