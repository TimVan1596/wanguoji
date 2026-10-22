import {createNaturalCore} from './NaturalCoreHarness';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import {CITY_SIEGE_DAMAGE_INTERVAL_MONTHS} from '../../config/simulation';
import {siegeParticipants} from '../SiegeParticipants';
import Diplomacy,{DiplomacySystem} from '../../Politics/Diplomacy';
import Military from '../../Politics/MilitaryCommandRegistry';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';

/** Real bodies and logical registry, production City settlement; candidate code runs in frozen copies. */
export async function runSiegeContestCore(seed:string,candidate=false,profile?:string){
 const {core,game}=await createNaturalCore(seed),checks:string[]=[],damage:any[]=[];
 const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);checks.push(label);};
 const step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');};
 try{
  for(let n=0;n<12;n++)step();core.setWorldRunning(false);const base=exportWorldSave(core);
  for(const logical of [false,true]){
   const scenario=(a:number,d:number)=>{
    hydrateWorldSave(core,structuredClone(base));core.logicalGameplayAuthority=logical;
    const m=core.simulator!.year,city=core.allCities.find(c=>c.ownerTeam&&c.ownerTeam.users.size>=8&&!c.isInCaptureGrace(m))!;
    const owner=city.ownerTeam!,attack=core.teams.find(t=>t!==owner&&t.users.size>=6&&Diplomacy.canAttack(t.name,owner.name,m))!;
    const place=(u:any,x:number,y:number)=>{u.player.setPosition(x,y);u.player.body.reset(x,y);const state=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId)!.state;state.logicalX=x;state.logicalY=y;};
    for(const t of core.teams)for(const u of t.users)place(u,-1024,-1024);
    [...attack.users].sort((a,b)=>Number(a.role==="RULER")-Number(b.role==="RULER")).slice(0,a).forEach(u=>place(u,city.block.x,city.block.y));[...owner.users].slice(0,d).forEach(u=>place(u,city.block.x,city.block.y));
    check(siegeParticipants(city,attack,core,32,true).length===a,`${logical}/${a}/${d}: unique real attackers`);
    check(siegeParticipants(city,owner,core,32,false).length===d,`${logical}/${a}/${d}: only owner units defend`);
    const positions=(t:typeof attack,attacking:boolean)=>siegeParticipants(city,t,core,32,attacking).map(u=>{const e=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId!)!;return {unitId:e.state.unitId,x:logical?e.state.logicalX:u.player.x,y:logical?e.state.logicalY:u.player.y};});
    const attackersBefore=positions(attack,true),defendersBefore=positions(owner,false);
    const devastation=city.devastation,wall=city.defense;for(let i=0;i<100;i++)city.registerSiegeContact(attack,m);(city as any).updateSiege(m);
    const loss=wall-city.defense;damage.push({logical,attackers:a,defenders:d,damage:loss,cityId:city.id,cityName:city.name,attacker:attack.name,defender:owner.name,month:m,wallBefore:wall,wallAfter:city.defense,underSiege:city.underSiege,attackerPositionsBefore:attackersBefore,defenderPositionsBefore:defendersBefore,hadRegisteredContact:true,reason:loss>0?'ACTUAL_WALL_LOSS':!city.underSiege?'NO_EFFECTIVE_CONTACT':city.lastSiegeDamageMonth===m?'FRACTION_ACCUMULATED':'TICK_NOT_DUE',captured:city.ownerFactionId!==owner.name,siegeEnded:!city.underSiege,attackerPositions:siegeParticipants(city,attack,core,32,true).map(u=>({unitId:u.player.logicalUnitId,x:logical?core.logicalUnitRegistry.getEntry(u.player.logicalUnitId!)!.state.logicalX:u.player.x,y:logical?core.logicalUnitRegistry.getEntry(u.player.logicalUnitId!)!.state.logicalY:u.player.y}))});return {city,attack,owner,m,place,loss,devastationChange:city.devastation-devastation};
   };
   if(profile){
    const a=scenario(2,0),aLoss=a.loss,b=scenario(2,2);check(candidate?b.loss<aLoss:b.loss===aLoss,`${logical}: ${candidate?"2v2 real local defense changes actual wall loss":"2v2 defenders do not change baseline wall loss"}`);
    const c=scenario(4,1),strong=c.loss+(c.city as any).siegeDamageRemainder,d=scenario(4,4);check(candidate?strong>d.loss+(d.city as any).siegeDamageRemainder:c.loss===d.loss,`${logical}: ${candidate?"4v1 has greater realized pressure than 4v4":"4v1 and 4v4 have identical baseline wall loss"}`);
    const dead=scenario(2,0);for(const u of siegeParticipants(dead.city,dead.attack,core,32,true))u.destroyUser(false,{cause:"BATTLE_DEATH",month:dead.m,damageSource:"HOSTILE_HOME_OCCUPATION"});
    dead.city.registerSiegeContact(dead.attack,dead.m);const wall=dead.city.defense;(dead.city as any).updateSiege(dead.m);check(candidate?!dead.city.underSiege&&dead.city.defense===wall:dead.city.underSiege,`${logical}: ${candidate?"dead real attackers cannot leave effective ghost pressure":"dead attackers leave stale baseline siege state"}`);
   }
   if(profile){
    const truce=scenario(2,0),before=truce.city.defense;truce.city.registerSiegeContact(truce.attack,truce.m);
    const diplomacy=new DiplomacySystem(Diplomacy,()=>core.allCities,()=>{});(diplomacy as any).form(truce.attack,truce.owner,"TRUCE",truce.m,{reason:"WAR_EXHAUSTION_TRUCE",recentBilateralCaptureCount:1,stabilityA:10,stabilityB:10});
    (truce.city as any).updateSiege(truce.m);check(!truce.city.underSiege&&truce.city.defense===before,`${logical}: actual treaty transaction stops siege immediately`);
    const ended=scenario(2,0),members=siegeParticipants(ended.city,ended.attack,core,32,true),commander=members[0];
    check((Military as any).appoint(commander,ended.attack.name,ended.m,members.map(u=>u.player.logicalUnitId!)),`${logical}: controlled command uses real population and registry`);
    const formation=Military.getFormations().find(f=>f.commanderPersonId===commander.militaryPersonId)!;
    ended.city.registerSiegeContact(ended.attack,ended.m,undefined,formation.commandId,formation.commanderPersonId);Military.endPersonCommands(formation.commanderPersonId,ended.m,"DISMISSED");
    for(const u of ended.attack.users)ended.place(u,-1024,-1024);const wall=ended.city.defense;(ended.city as any).updateSiege(ended.m);
    check(formation.status==="DISBANDED"&&(candidate?!ended.city.underSiege&&ended.city.defense===wall:ended.city.underSiege),`${logical}: ${candidate?"terminated command and departed members leave no ghost assault":"baseline siege contact remains after command termination and departure"}`);
   }
   const single=scenario(1,0);check(candidate?single.loss===0:single.loss>0,`${logical}: single attacker ${candidate?'cannot freely damage':'baseline fixed damage'}`);
   if(candidate)check(single.devastationChange===0,`${logical}: insufficient pressure cannot freely devastate a city`);
   if(profile&&candidate){
    const guarded=scenario(1,1);check(!guarded.city.underSiege&&guarded.loss===0,`${logical}: one attacker cannot reduce a genuinely defended city's wall`);
    if(profile==='Q'){
     const empty=scenario(1,0),wall=empty.city.defense,next=empty.m+CITY_SIEGE_DAMAGE_INTERVAL_MONTHS;
     (core.simulator as any).clock.importState({worldMonth:next,elapsedMs:0,running:false});empty.city.registerSiegeContact(empty.attack,next);(empty.city as any).updateSiege(next);
     check(empty.city.defense<wall,`${logical}: continued lone contact can slowly damage a genuinely empty city`);
    }
   }
   const open=scenario(3,0),openLoss=open.loss;check(openLoss>0,`${logical}: advantage can damage undefended walls`);
   const defended=scenario(3,3);check(candidate?defended.loss<openLoss:defended.loss===openLoss,`${logical}: defenders ${candidate?'reduce':'do not change baseline'} damage`);
   const blocked=scenario(3,8);check(candidate?blocked.loss===0:blocked.loss>0,`${logical}: enough verified defenders ${candidate?'block':'do not block baseline'} damage`);
   const departed=scenario(3,0);for(const u of departed.attack.users)departed.place(u,-1024,-1024);
   departed.city.registerSiegeContact(departed.attack,departed.m);(departed.city as any).lastSiegeDamageYear=-1;const wall=departed.city.defense;(departed.city as any).updateSiege(departed.m);
   check(candidate?!departed.city.underSiege&&departed.city.defense===wall:departed.city.underSiege,`${logical}: ${candidate?'no-position contact cannot continue siege':'baseline accepts historical contact'}`);
   const multi=scenario(3,0),third=core.teams.find(t=>t!==multi.owner&&t!==multi.attack&&t.users.size&&Diplomacy.canAttack(t.name,multi.owner.name,multi.m))!;
   const one=[...third.users][0];multi.place(one,multi.city.block.x,multi.city.block.y);
   multi.city.registerSiegeContact(multi.attack,multi.m);for(let n=0;n<500;n++)multi.city.registerSiegeContact(third,multi.m);
   (multi.city as any).updateSiege(multi.m);check(multi.city.attackingFactionId===(candidate?multi.attack.name:third.name),`${logical}: ${candidate?'real strongest faction':'baseline callback count'} determines attacker`);
   check(siegeParticipants(multi.city,multi.owner,core,32,false).length===0,`${logical}: third-party attacker is never a defender`);
   multi.city.capture(multi.attack,multi.m);check(!(multi.city as any).siegeContacts.size&&!multi.city.underSiege,`${logical}: capture clears old contacts`);
  }
  check(JSON.stringify(damage.filter(r=>!r.logical).map(r=>({attackers:r.attackers,defenders:r.defenders,damage:r.damage})))===JSON.stringify(damage.filter(r=>r.logical).map(r=>({attackers:r.attackers,defenders:r.defenders,damage:r.damage}))), 'Phaser and logical authorities settle identical verified force scenarios');
  hydrateWorldSave(core,structuredClone(base));const month=core.simulator!.year,city=core.allCities.find(c=>c.ownerTeam&&!c.isInCaptureGrace(month))!,attacker=core.teams.find(t=>t!==city.ownerTeam&&Diplomacy.canAttack(t.name,city.ownerFactionId,month))!;
  const placeSaved=(u:any,x:number,y:number)=>{u.player.setPosition(x,y);u.player.body.reset(x,y);const state=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId)!.state;state.logicalX=x;state.logicalY=y;};
  for(const u of city.ownerTeam!.users)placeSaved(u,0,0);
  for(const u of [...city.ownerTeam!.users].slice(0,2))placeSaved(u,city.block.x,city.block.y);
  for(const u of [...attacker.users].slice(0,2))placeSaved(u,city.block.x,city.block.y);
  city.registerSiegeContact(attacker,month);(city as any).updateSiege(month);city.registerSiegeContact(attacker,month);
  check(city.underSiege&&siegeParticipants(city,attacker,core,32,true).length>=2,'save fixture contains a genuine ongoing siege with real positioned attackers');
  const pending=exportWorldSave(core);check(validateWorldSave(pending).valid,'pending real siege contact and fractional pressure are valid JSON DTO');
  hydrateWorldSave(core,structuredClone(pending));check(diffCanonicalWorldSave(pending,exportWorldSave(core)).matched,'pending siege survives hydration without duplicate events');
  const resume=()=>{hydrateWorldSave(core,structuredClone(pending));core.setWorldRunning(true);for(let n=0;n<12;n++)step();core.setWorldRunning(false);return exportWorldSave(core);};
  const a=resume(),b=resume();check(validateWorldSave(a).valid&&diffCanonicalWorldSave(a,b).matched,'twelve month real siege continuation deterministic');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'second save reads identically');
  return {seed,candidate,checks,damage,saveSchemaVersion:base.saveSchemaVersion};
 }finally{game.destroy(true);}
}

/** Real appointment, promotion, nearby reinforcement and save transactions in frozen light candidates. */
export async function runLightMilitaryCore(seed:string,profile:string){
 const [{default:Military},{default:random}]=await Promise.all([import('../../Politics/MilitaryCommandRegistry'),import('../WorldRandom')]);
 const {core,game}=await createNaturalCore(seed),checks:string[]=[];
 const check=(v:unknown,s:string)=>{if(!v)throw Error(s);checks.push(s);};
 const step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');};
 try{
  let formation=Military.getFormations().find(f=>f.status==='ACTIVE');
  for(let i=0;!formation&&i<240;i++){step();formation=Military.getFormations().find(f=>f.status==='ACTIVE');}
  check(formation,'production yearly appointment creates a real light command');const f=formation!,p=Military.getPerson(f.commanderPersonId)!,team=core.teams.find(t=>t.name===f.factionId)!,u=team.getUserById(p.sourceUserId)!;
  core.setWorldRunning(false);const month=core.simulator!.year;
  check(f.memberUnitIds.length===2,'first real appointment has exactly two existing people');
  const original=[...f.memberUnitIds],available=[...team.users].filter(v=>v.role==='NORMAL'&&!v.rulerId&&!Military.isAssigned(v.player.logicalUnitId!));check(available.length>=3,'scenario has real near and far unassigned residents');
  const place=(v:any,x:number,y:number)=>{v.player.setPosition(x,y);v.player.body.reset(x,y);const state=core.logicalUnitRegistry.getEntry(v.player.logicalUnitId!)!.state;state.logicalX=x;state.logicalY=y;};
  // Test fixture positions; the production reinforcement transaction itself may never move a body.
  const x=team.capitalCity!.block.x+128,y=team.capitalCity!.block.y+128;place(u,x,y);for(let i=0;i<available.length;i++)place(available[i],i<2?x+16+i*16:x+200,y);
  const beforePositions=available.map(v=>[v.id,v.player.x,v.player.y]),targets=core.allCities.filter(c=>c.ownerTeam!==team).slice(0,5);check(targets.length===5,'five real cities support original merit promotion thresholds');
  const clock=(m:number)=>(core.simulator as any).clock.importState({worldMonth:m,elapsedMs:0,running:false});clock(month+60);
  for(const c of targets.slice(0,2))c.capture(team,month+60,undefined,f.commandId,p.personId);
  const populationBeforePromotion=core.teams.reduce((n,t)=>n+t.users.size,0),rng=JSON.stringify(random.exportState());(Military as any).advanceOffices(month+60,core.teams);
  check(p.appointments[0].officeHistory?.at(-1)?.office==='JIANGJUN','real captured cities and service time grant general');
  check(f.memberUnitIds.length===(profile==='B'?4:3),'nearby existing recruits respect candidate office cap');
  check(!f.memberUnitIds.includes(available[2].player.logicalUnitId!),'far resident is not remotely recruited');
  check(JSON.stringify(beforePositions)===JSON.stringify(available.map(v=>[v.id,v.player.x,v.player.y])),'reinforcement never teleports a resident');
  check(JSON.stringify(random.exportState())===rng,'refill adds no random draws');check(core.teams.reduce((n,t)=>n+t.users.size,0)===populationBeforePromotion,'first promotion and reinforcement create no population');
  clock(month+61);for(const c of targets.slice(2))c.capture(team,month+61,undefined,f.commandId,p.personId);clock(month+120);const population=core.teams.reduce((n,t)=>n+t.users.size,0);(Military as any).advanceOffices(month+120,core.teams);
  check(p.appointments[0].officeHistory?.at(-1)?.office==='SHANGJIANGJUN'&&f.memberUnitIds.length===4,'senior promotion unlocks at most four actual members');
  check(original.every(id=>f.memberUnitIds.includes(id))&&new Set(Military.getFormations().filter(f=>f.status==='ACTIVE').flatMap(f=>f.memberUnitIds)).size===Military.getFormations().filter(f=>f.status==='ACTIVE').reduce((n,f)=>n+f.memberUnitIds.length,0),'no duplicated members across real commands');
  check(core.teams.reduce((n,t)=>n+t.users.size,0)===population,'promotion and reinforcement create no population');
  const saved=exportWorldSave(core);hydrateWorldSave(core,structuredClone(saved));check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'light formation and actual identities survive strict save and load');
  const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let n=0;n<12;n++)step();core.setWorldRunning(false);return exportWorldSave(core);};const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'light candidate resumes twelve months deterministically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'light candidate second save reads identically');
  Military.endPersonCommands(p.personId,core.simulator!.year,'DISMISSED');check(!Military.getFormations().some(v=>v.commanderPersonId===p.personId&&v.status==='ACTIVE'),'dismissal leaves no active command');
  return {profile,checks,initialMembers:2,maximumMembers:4};
 }finally{game.destroy(true);}
}
