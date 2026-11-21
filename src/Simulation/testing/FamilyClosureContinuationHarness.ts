import Civil from '../../Politics/CivilAdministration';
import {createNaturalCore} from './NaturalCoreHarness';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {diffCanonicalWorldSave,type WorldSaveV1} from '../../Persistence/WorldSaveSchema';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {familyExpansionOpen,familyAppointmentWeight} from '../../Politics/MilitaryFamily';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Directed continuation of a naturally registered child, not a natural revival-frequency claim. */
export async function runFamilyClosureContinuation(input:WorldSaveV1){
 const {core,game}=await createNaturalCore('regional-3'),checks:string[]=[],check=(v:unknown,s:string)=>{if(!v)throw Error(s);checks.push(s);},strict=()=>exportWorldSave(core),clock=(month:number)=>(core.simulator as any).clock.importState({worldMonth:month,elapsedMs:0,running:false});
 try{game.loop.stop();core.setWorldRunning(false);hydrateWorldSave(core,structuredClone(input));
  const month=input.world.worldMonth,family=Military.getFamilies().find(f=>f.familyId==='military-family-military-person-37-秦-ruler-1')!,member=family?.members.find(m=>m.memberId===family.familyId+'-child-1719'),team=core.teams.find(t=>t.name===family?.factionId)!,user=member?.sourceUserId===undefined?undefined:team?.getUserById(member.sourceUserId),old=family?.nobleSuccession?.at(-1);
  check(month===2400&&old?.kind==='ENDED'&&old.reason==='RANK_EXHAUSTED'&&member?.birth&&user,'native regional-3 has a real living child of a closed exhausted title family');
  if(!member||!user||!old)throw Error('Missing native child');
  check(member.bornMonth<old.month&&member.populationEnteredMonth!>old.month&&member.birth!.naturalDeathMonth>month+60,'already-born child survived closure and actually entered its normal population slot later');
  const oldActs=JSON.stringify(family.nobleSuccession),birth=JSON.stringify(member.birth),population=core.teams.reduce((n,t)=>n+t.users.size,0);
  check(!familyExpansionOpen(family,month)&&familyAppointmentWeight(family,member,team.name,family.epochFounderId,month,'MEDIUM')===1,'closed original chain gives this real living descendant no old inherited recruitment advantage');
  const assigned=Military.getCommandForUnit(user.player.logicalUnitId!);if(assigned)Military.endPersonCommands(assigned.commanderPersonId,month,'DISMISSED');
  if(Military.getFormations().filter(f=>f.factionId===team.name&&f.status==='ACTIVE').length>=2){const p=Military.getPeople().find(p=>p.factionId===team.name&&p.status==='ACTIVE')!;Military.endPersonCommands(p.personId,month,'DISMISSED');}
  check((Military as any).isEligible(user,month),'closed-family descendant passes the original real military eligibility gates');
  check((Military as any).appoint(user,team.name,month,[user.player.logicalUnitId!]),'same real adult obtains only the original XIAOWEI command transaction');
  const person=Military.getPerson(user.militaryPersonId!)!,command=person.appointments.at(-1)!.commandId;
  check(person.sourceUserId===member.sourceUserId&&person.bornMonth===member.bornMonth&&person.personalName===member.name&&core.teams.reduce((n,t)=>n+t.users.size,0)===population,'closed-family enlistment preserves existing child identity, name, birth and population');
  const city=core.allCities.find(c=>c.ownerTeam!==team&&!c.destroyed&&c.ownerTeam&&c.ownerTeam.cities.length>1)!;check(city,'an existing enemy city supplies independent new military merit');
  clock(month+12);user.player.setPosition(city.block.x,city.block.y);user.player.Body.reset(user.player.x,user.player.y);const state=core.logicalUnitRegistry.getEntry(user.player.logicalUnitId!)!.state;state.logicalX=city.block.x;state.logicalY=city.block.y;city.capture(team,month+12,undefined,command,person.personId);Civil.update(month+12,core.teams,Dynasty.getAll());
  const awardMonth=month+36;clock(awardMonth);(Military as any).advanceOffices(awardMonth,core.teams);Military.updateNobility(awardMonth,core.teams,Dynasty.getAll());Military.updateFamilies(awardMonth,core.teams,Dynasty.getAll());
  const grant=person.nobilityHistory?.find(g=>g.month===awardMonth);check(grant?.rank==='NAN'&&grant.captureEventIds.length===1&&grant.previousRank==='NONE','existing descendant earns independent new NAN through real service and a real capture, without reviving the old title');
  const before=strict(),writer=History.addEvent;History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='family-title-started'){random.next();throw Error('injected real closure revival');}return id;};try{Military.updateFamilyTitles(awardMonth,core.teams,Dynasty.getAll());}finally{History.addEvent=writer;}
  check(diffCanonicalWorldSave(before,strict()).matched,'new-period write failure restores the full real native world, old closure, population and RNG');
  Military.updateFamilyTitles(awardMonth,core.teams,Dynasty.getAll());const current=Military.getFamilies().find(f=>f.familyId===family.familyId)!,act=current.nobleSuccession!.at(-1)!;
  check(act.kind==='STARTED'&&act.period===2&&act.sourceGrantEventId===grant!.eventId&&act.holderMemberId===member.memberId&&JSON.stringify(current.nobleSuccession!.slice(0,-1))===oldActs,'real independent new merit opens a new period while preserving every old exhausted-title act');
  check(JSON.stringify(current.members.find(m=>m.memberId===member.memberId)!.birth)===birth&&familyExpansionOpen(current,awardMonth),'new source reopens future lawful family activity without altering the already-born identity');
  const saved=strict(),step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');},resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let i=0;i<12;i++)step();core.setWorldRunning(false);return strict();};
  const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'closed-family real revival continues twelve months deterministically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,strict()).matched,'revived period, child lifespan and old source acts survive a second strict read');
  return {seed:'regional-3',nativeInputMonth:month,controlledContinuation:true,naturalRevivalFrequency:false,checks,familyId:family.familyId,memberId:member.memberId,sourceGrantEventId:grant!.eventId,oldClosureEventId:old.eventId,saveVersion:saved.saveSchemaVersion};
 }finally{game.destroy(true);}
}
