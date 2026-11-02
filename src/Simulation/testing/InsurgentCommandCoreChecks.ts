import Diplomacy from '../../Politics/Diplomacy';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Actual resident founders, existing followers and both runtime movement authorities. */
export function checkInsurgentCommands(core:any,factionId:string,check:(v:unknown,s:string)=>void){
 const base=exportWorldSave(core),team=()=>core.teams.find((t:any)=>t.name===factionId),month=core.simulator.year;
 const create=()=>{(Military as any).updateInsurgentCommands(month,[team()]);return Military.getFormations().find(f=>f.factionId===factionId&&f.leaderDuty);};
 const strict=()=>{const s=exportWorldSave(core),v=validateWorldSave(s);check(v.valid,`insurgent strict save: ${v.errors.join(';')}`);return s;};
 try{
  for(const point of ['history','state']){
   hydrateWorldSave(core,structuredClone(base));const write=History.addEvent,commit=Military.commitInsurgentCommand;
   if(point==='history')History.addEvent=function(e){const id=write.call(this,e);if(e.type==='leader-command-started')throw Error('injected leader history');return id;};
   else Military.commitInsurgentCommand=function(f){commit.call(this,f);throw Error('injected leader assignment state');};
   try{create();}finally{History.addEvent=write;Military.commitInsurgentCommand=commit;}
   check(diffCanonicalWorldSave(base,exportWorldSave(core)).matched,`${point} failure restores leader, actual force, history, sequence and RNG`);
  }
  hydrateWorldSave(core,structuredClone(base));const population=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),people=Military.getPeople().length,rng=JSON.stringify(random.exportState()),f=create();
  check(f&&f.memberUnitIds.length>=2,'real resident political founder obtains one actual command with an existing follower');if(!f)throw Error('No real insurgent command');
  const leader=team().rulerUser;
  check(f.commanderPersonId===leader.historicalPersonId&&Military.commanderUser(f,team())===leader&&f.memberUnitIds.includes(leader.player.logicalUnitId),'political leader and field commander are the same permanent body and identity');
  check(Military.getPeople().length===people&&core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===population&&JSON.stringify(random.exportState())===rng,'command creates no people, false MilitaryPerson, formal office, lifespan or random draw');
  const saved=strict();create();check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'same leader cannot receive a second duty or duplicate troops');
  for(const field of ['sourceUserId','personId','capacity','rulerId','foundingEventId']){const bad=structuredClone(saved),d:any=bad.registries.militaryCommandRegistry.leaderCommands![0].leaderDuty;d[field]=typeof d[field]==='number'?999999:'forged';check(!validateWorldSave(bad).valid,`strict rejects forged leader ${field}`);}
  {const bad=structuredClone(saved),f=bad.registries.militaryCommandRegistry.leaderCommands![0];f.memberUnitIds.push(f.memberUnitIds[0]);check(!validateWorldSave(bad).valid,'same body cannot be duplicated in a leader command');}
  const target=core.allCities.find((c:any)=>c.ownerFactionId!==factionId&&!c.destroyed)!;
  f.targetCityId=target.id;f.orderStartMonth=month;
  const states=f.memberUnitIds.map(id=>core.logicalUnitRegistry.getEntry(id)!.state);for(const u of states){u.logicalX=target.block.x-128;u.logicalY=target.block.y-128;u.logicalVX=0;u.logicalVY=0;}
  Military.steerLogicalUnits(month,states,[target]);check(states.every(u=>u.logicalVX>0&&u.logicalVY>0),'actual logical leader and follower follow the shared movement orders');
  core.logicalGameplayAuthority=false;for(const id of f.memberUnitIds){const u=core.logicalUnitRegistry.getEntry(id)!.player;u.setPosition(target.block.x-128,target.block.y-128);u.body.reset(u.x,u.y);}
  Military.steerActiveUnits(month,core);check(f.memberUnitIds.every(id=>{const b=core.logicalUnitRegistry.getEntry(id)!.player.Body;return b.velocity.x>0&&b.velocity.y>0;}),'actual Phaser leader and follower follow the same real command');
  hydrateWorldSave(core,structuredClone(saved));
  const armed=Military.getFormation(f.commandId)!,attack=team(),battleMonth=month+24;
  core.simulator.clock.importState({worldMonth:battleMonth,elapsedMs:0,running:false});
  const town=core.allCities.find((c:any)=>c.ownerFactionId!==factionId&&!c.isInCaptureGrace(battleMonth)&&Diplomacy.canAttack(factionId,c.ownerFactionId,battleMonth))!;check(!!town,'leader command has a real hostile city under existing diplomacy');
  const place=(u:any,x:number,y:number)=>{u.player.setPosition(x,y);u.player.body.reset(x,y);const e=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId)!;e.state.logicalX=x;e.state.logicalY=y;};
  const away=core.allCities.find((c:any)=>Math.hypot(c.block.x-town.block.x,c.block.y-town.block.y)>320)!.block;
  for(const t of core.teams)for(const u of t.users)place(u,away.x,away.y);
  for(const id of armed.memberUnitIds)place(core.logicalUnitRegistry.getEntry(id)!.player.user,town.block.x,town.block.y);
  (Military as any).refreshOrders(battleMonth,[attack],core.allCities);town.defense=1;town.updateDefense(battleMonth);
  check(town.ownerFactionId===factionId&&armed.captures.length===1,'same production siege formula records a real leader-led capture with actual local troops');
  check(History.getEvents().some(e=>e.id===armed.captures[0].eventId&&e.metadata?.commanderPersonId===armed.commanderPersonId&&(e.rulerId??e.metadata?.rulerId)===armed.leaderDuty!.rulerId),'capture credits the actual command and the same political ruler without copying old military merits');strict();
  hydrateWorldSave(core,structuredClone(saved));const current=Military.getFormations().find(g=>g.commandId===f.commandId)!;
  {const before=exportWorldSave(core),write=History.addEvent;History.addEvent=function(e){const id=write.call(this,e);if(e.type==='leader-command-ended')throw Error('injected duty end');return id;};let failed=false;try{Military.endInsurgentLeader(current.leaderDuty!.rulerId,month);}catch{failed=true;}finally{History.addEvent=write;}check(failed&&diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'failed ending restores the whole active duty and source history');}
  Military.endInsurgentLeader(current.leaderDuty!.rulerId,month);strict();check(Military.getFormation(current.commandId)?.status==='DISBANDED'&&team().rulerUser&&!team().rulerUser.isDestroyed,'ending command does not kill the living political leader');
  const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return strict();};const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'leader commands continue deterministically twelve months including life and real combat');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'second read creates no duplicate commander or soldiers');
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
