import {deriveNobleMerits,meritRoster} from '../../Politics/MilitaryNobility';
import {checkCityHistoryInteraction,checkDefenseMeritInteraction} from "./RoyalArchiveInteractionHarness";
import Military from "../../Politics/MilitaryCommandRegistry";
import Factions from "../FactionRegistry";
import {createNaturalCore} from './NaturalCoreHarness';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import {siegeParticipants} from '../SiegeParticipants';
import Diplomacy,{DiplomacySystem} from '../../Politics/Diplomacy';
import History from '../../History/WorldHistory';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
/** Real positioned Users, production monthly City and political/ownership transactions. */
export async function runSiegeBattleCore(seed='siege-defense-z10'){
 const {core,game}=await createNaturalCore(seed),checks:string[]=[],results:any[]=[];
 const check=(v:unknown,label:string)=>{if(!v)throw Error(label);checks.push(label);};
 const clock=(m:number)=>(core.simulator as any).clock.importState({worldMonth:m,elapsedMs:0,running:false});
 const step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');};
 const place=(u:any,x:number,y:number)=>{u.player.setPosition(x,y);u.player.body.reset(x,y);const e=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId)!;e.state.logicalX=x;e.state.logicalY=y;};
 try{
  for(let n=0;n<12;n++)step();core.setWorldRunning(false);const base=exportWorldSave(core);
  const scenario=(a:number,d:number,logical=false)=>{
   hydrateWorldSave(core,structuredClone(base));core.logicalGameplayAuthority=logical;
   const m=core.simulator!.year,city=core.allCities.find(c=>c.ownerTeam&&c.ownerTeam.users.size>=8&&!c.isInCaptureGrace(m))!,owner=city.ownerTeam!,attack=core.teams.find(t=>t!==owner&&t.users.size>=6&&Diplomacy.canAttack(t.name,owner.name,m))!;
   for(const t of core.teams)for(const u of t.users)place(u,-1024,-1024);
   const attackers=[...attack.users].sort((a,b)=>Number(a.role==='RULER')-Number(b.role==='RULER')).slice(0,a),defenders=[...owner.users].sort((a,b)=>Number(a.role==='RULER')-Number(b.role==='RULER')).slice(0,d);
   for(const u of [...attackers,...defenders])place(u,city.block.x,city.block.y);
   check(siegeParticipants(city,attack,core,32,true).length===a&&siegeParticipants(city,owner,core,32,false).length===d,`${logical}/${a}/${d}: real unique local forces`);
   const tick=(offset:number)=>{clock(m+offset);city.updateDefense(m+offset);};
   return {city,owner,attack,attackers,defenders,m,tick};
  };
  for(const logical of [false,true]){
   for(const [a,d]of [[1,0],[1,1],[2,0],[2,2],[4,1],[4,4]]){
    const s=scenario(a,d,logical),before=s.city.defense;
    for(let n=0;n<=36&&s.city.ownerTeam===s.owner;n++){s.tick(n);if(History.getEvents().some(e=>e.type==='siege-ended'&&e.cityId===s.city.id&&e.year>=s.m))break;}
    const end=History.getEvents().filter(e=>e.type==='siege-ended'&&e.cityId===s.city.id&&e.year>=s.m).at(-1)!;
    console.info('[BattleResult]',JSON.stringify({logical,a,d,before,defense:s.city.defense,end,endOwner:s.city.ownerFactionId,owner:s.owner.name,attack:s.attack.name,battle:s.city.siegeBattle}));
    check(end,`${logical}/${a}/${d}: battle reaches a real capture or end`);
    if(d===0)check(s.city.ownerTeam===s.attack,`${logical}: real attackers can take an undefended city over actual months`);
    if(a===d)check(s.city.ownerTeam===s.owner&&end.metadata?.reason==='REPULSED',`${logical}: equal local defenders resist and end the assault`);
    results.push({logical,a,d,before,endMonth:end.year,result:end.metadata?.reason,captured:s.city.ownerTeam===s.attack});
    check(!s.city.siegeBattle,`${logical}/${a}/${d}: concluded battle leaves no active siege state`);
   }
   {
    const s=scenario(2,0,logical);s.tick(0);const wall=s.city.defense;for(const u of s.attackers)place(u,-1024,-1024);s.tick(1);
    check(!s.city.underSiege&&s.city.defense===wall,`${logical}: departed actual attackers stop damage and record contact ending`);
    check(History.getEvents().some(e=>e.type==='siege-ended'&&e.metadata?.reason==='CONTACT_ENDED'),`${logical}: withdrawal source is real lost contact`);
    if(!logical)await checkCityHistoryInteraction(core,s.city,check);
   }
   {
    const s=scenario(2,0,logical);s.tick(0);const wall=s.city.defense;
    (new DiplomacySystem(Diplomacy,()=>core.allCities,()=>{}) as any).form(s.attack,s.owner,'TRUCE',s.m,{reason:'WAR_EXHAUSTION_TRUCE',recentBilateralCaptureCount:1,stabilityA:10,stabilityB:10});s.tick(1);
    check(!s.city.underSiege&&s.city.defense===wall&&History.getEvents().some(e=>e.type==='siege-ended'&&e.metadata?.reason==='TRUCE'),`${logical}: actual treaty ends battle without a fictional victory`);
   }
  }
  for(const ending of ['DISMISSED','BATTLE_DEATH']){
   const s=scenario(2,0),commander=s.attackers.find(u=>(Military as any).isEligible(u,s.m))!;
   check(commander,'actual local commander is eligible under original appointment rules');
   check((Military as any).appoint(commander,s.attack.name,s.m,[commander.player.logicalUnitId!]),'real two-body command for interruption test');
   (Military as any).refreshOrders(s.m,[s.attack,s.owner],[s.city]);s.tick(0);const wall=s.city.defense;
   if(ending==='BATTLE_DEATH')commander.destroyUser(false,{cause:'BATTLE_DEATH',month:s.m+1,damageSource:'SIEGE_ASSAULT',triggerCityId:s.city.id});else Military.endPersonCommands(commander.militaryPersonId!,s.m+1,'DISMISSED');s.tick(1);
   check(!s.city.siegeBattle&&s.city.defense===wall&&s.city.siegeRetryAfter[s.attack.name]>s.m+1,ending+': real command end cancels old battle and blocks ghost restart');
  }
  {
   const s=scenario(2,4),commander=s.defenders.find(u=>(Military as any).isEligible(u,s.m))!;
   check(commander,'real local defensive commander satisfies original eligibility');
   check((Military as any).appoint(commander,s.owner.name,s.m,[commander.player.logicalUnitId!]),'actual home formation, no virtual garrison');
   for(let n=0;n<=12&&!History.getEvents().some(e=>e.type==='siege-defended'&&e.metadata?.personId===commander.militaryPersonId);n++)s.tick(n);
   const defended=History.getEvents().find(e=>e.type==='siege-defended'&&e.metadata?.personId===commander.militaryPersonId);
   check(defended&&Military.getChronicle(Military.getPerson(commander.militaryPersonId!)!,s.m+12,s.owner.name).some(e=>e.eventId===defended.id&&!e.victory),'verified local defensive general receives a defense chronicle, never a city-capture merit');
   const p=Military.getPerson(commander.militaryPersonId!)!,merits=deriveNobleMerits(p,Military.getFormations(),History.getEvents(),s.owner.name,s.m+12);check(merits.defendedCityIds.includes(s.city.id)&&merits.cityIds.length===0&&meritRoster([p],Military.getFormations(),History.getEvents(),s.owner.name,s.m+12).length===1,'real zero-capture defender enters the historical merit roster with verified defense evidence');
   await checkDefenseMeritInteraction(s.owner.name,p.personId,s.m+12,check);
  }
  {
   const s=scenario(4,0),third=core.teams.find(t=>t!==s.attack&&t!==s.owner&&Diplomacy.canAttack(t.name,s.owner.name,s.m))!;
   for(const u of [...third.users].slice(0,2))place(u,s.city.block.x,s.city.block.y);
   for(let n=0;n<500;n++)s.city.registerSiegeContact(third,s.m);s.tick(0);
   check(s.city.attackingFactionId===s.attack.name,'two hostile countries are counted separately; repeated callbacks cannot override real force counts');
  }
  // Same historical city really changes hands four times; neither close dates nor
  // the general's tenure are substitutes for each individual recovery transaction.
  {
   hydrateWorldSave(core,structuredClone(base));const city=core.allCities.find(c=>c.name==='郢')!,home=city.ownerTeam!,enemy=core.teams.find(t=>t!==home&&t.status==='ACTIVE')!,m=core.simulator!.year;
   const site=core.map!.blocks.flat().find(b=>b.team===home&&!b.city&&core.allCities.every(c=>Math.hypot(c.block.x-b.x,c.block.y-b.y)>160))!;
   check(site,'real Chu land can support a second city before the old capital falls');Factions.foundCity(home,site,undefined,m);
   const users=[...home.users].filter(u=>(Military as any).isEligible(u,m)).slice(0,2);check(users.length===2,'two real eligible Chu residents support the recovery case');
   check((Military as any).appoint(users[0],home.name,m,[users[0].player.logicalUnitId!]),'actual Chu military appointment before repeated recovery');const p=Military.getPerson(users[0].militaryPersonId!)!;
   for(let turn=0;turn<2;turn++){
    const attackMonth=m+24+turn*36;clock(attackMonth-12);city.capture(enemy,attackMonth-12);
    for(const t of core.teams)for(const u of t.users)place(u,-1024,-1024);for(const u of users)place(u,city.block.x,city.block.y);
    (Military as any).refreshOrders(attackMonth,core.teams,[city]);city.defense=1;
    for(let n=0;n<12&&city.ownerTeam!==home;n++){clock(attackMonth+n);city.updateDefense(attackMonth+n);}
    check(city.ownerTeam===home,'actual production siege recovers Ying after a distinct enemy control interval');
   }
   const victories=p.capturedEventIds.map(id=>History.getEvents().find(e=>e.id===id)!).filter(e=>e.type==='city-recovered'&&e.cityId===city.id);
   check(victories.length===2&&new Set(victories.map(e=>e.id)).size===2&&victories[0].year!==victories[1].year,'two Ying recoveries have distinct source IDs and actual dates');
   check(city.history.filter(h=>h.type==='recovered'&&h.newOwnerFactionId===home.name).length===2,'both recoveries have corresponding real city ownership changes');
   check(Military.getCareer(p,m+120).distinctCapturedCities===1&&Military.getCareer(p,m+120).verifiedCaptures===2,'two real recoveries preserve both facts but count one distinct city for bounded merit weighting');
   exportWorldSave(core);
  }
  const comparable=(logical:boolean)=>results.filter(r=>r.logical===logical).map(({logical:_mode,...r})=>r);
  check(JSON.stringify(comparable(false))===JSON.stringify(comparable(true)),'same real force fixtures settle identical results under Phaser and logical authority');
  const s=scenario(2,0);s.tick(0);const pending=exportWorldSave(core);
  const resume=()=>{hydrateWorldSave(core,structuredClone(pending));core.setWorldRunning(true);for(let i=0;i<12;i++)step();core.setWorldRunning(false);return exportWorldSave(core);};
  const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'active V24 battle resumes twelve months identically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'second battle save reads identically');
  return {seed,checks,results,saveSchemaVersion:a.saveSchemaVersion};
 }finally{game.destroy(true);}
}
