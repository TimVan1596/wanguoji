import {createNaturalCore} from './NaturalCoreHarness';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {siegeParticipants} from '../SiegeParticipants';
import {nearbyRecruitment,localRecruitmentReserves} from './MilitaryFormationCandidate';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
/** Controlled production transactions, not a second military simulator. */
export async function runFormationManagementCore(seed:string){
 const {core,game}=await createNaturalCore(seed),checks:string[]=[],observations:any[]=[];
 const check=(v:unknown,s:string)=>{if(!v)throw Error(s);checks.push(s);};
 const clock=(m:number)=>(core.simulator as any).clock.importState({worldMonth:m,elapsedMs:0,running:false});
 const step=()=>{for(let i=0;i<30;i++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');};
 const place=(u:any,x:number,y:number)=>{u.player.setPosition(x,y);u.player.body.reset(x,y);const e=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId)!;e.state.logicalX=x;e.state.logicalY=y;};
 try{
  clock(36);core.setWorldRunning(false);let team=core.teams.find(t=>Dynasty.getRoyalMilitaryCandidates(t,36).length>0)!;check(team,'actual dynasty offers an adult royal under the existing rules');
  const sized=(count:number)=>{
   for(const t of core.teams)for(const u of [...t.users])if(team.users.size<count&&t!==team&&u.role==='NORMAL'&&!u.historicalPersonId)u.setTeam(team,{cause:'LIVE_TRANSFER',month:36});
   check(team.users.size===count,'fixture uses exactly '+count+' real people through audited transfers');
  };
  sized(10);const cap=team.capitalCity!,locals=[...team.users].filter(u=>u.role==='NORMAL').slice(0,3);
  const arrange=()=>{
   for(const u of team.users)place(u,cap.block.x+240,cap.block.y+240);
   locals.forEach((u,i)=>place(u,cap.block.x+(i%2)*4,cap.block.y));
   [...team.users].filter(u=>!locals.includes(u)&&u.role==='NORMAL').forEach((u,i)=>place(u,cap.block.x+160+(i%3)*8,cap.block.y+160));
  };arrange();check(siegeParticipants(cap,team,core,32,false).length===3,'only three actual bodies occupy the capital defense area');
  const appoint=(month:number)=>{clock(month);const original=random.next;random.next=()=>{original.call(random);return 0;};try{Military.update(month,[team],core.allCities);}finally{random.next=original;}};
  appoint(36);let active=Military.getFormations().filter(f=>f.factionId===team.name&&f.status==='ACTIVE');check(active.length===1&&active[0].memberUnitIds.length===2,'ten-person country creates exactly one two-person production appointment');
  check(siegeParticipants(cap,team,core,32,false).length===3,'appointment does not move or remove the three capital residents');
  const formation=active[0],person=Military.getPerson(formation.commanderPersonId)!,commander=team.getUserById(person.sourceUserId)!;
  sized(20);arrange();appoint(48);active=Military.getFormations().filter(f=>f.factionId===team.name&&f.status==='ACTIVE');check(active.length===2&&active.every(f=>f.memberUnitIds.length===2),'twenty-person country creates a second real two-person command within existing slots');
  const unique=()=>{const ids=Military.getFormations().filter(f=>f.status==='ACTIVE').flatMap(f=>f.memberUnitIds);return ids.length===new Set(ids).size;};check(unique(),'two commands never share a real unit');
  const x=cap.block.x+160,y=cap.block.y+160;place(commander,x,y);
  const targets=core.allCities.filter(c=>c.ownerTeam!==team).slice(0,5);check(targets.length===5,'promotion scenario has five real cities');
  clock(96);for(const c of targets.slice(0,2))c.capture(team,96,undefined,formation.commandId,person.personId);
  const before=core.teams.reduce((n,t)=>n+t.users.size,0),rng=JSON.stringify(random.exportState()),positions=[...team.users].map(u=>[u.id,u.player.x,u.player.y]);(Military as any).advanceOffices(96,core.teams);
  check(person.appointments[0].officeHistory?.at(-1)?.office==='JIANGJUN'&&formation.memberUnitIds.length===3,'original service and actual capture thresholds unlock and fill three-person general command');
  clock(97);for(const c of targets.slice(2))c.capture(team,97,undefined,formation.commandId,person.personId);clock(156);const count=core.teams.reduce((n,t)=>n+t.users.size,0);(Military as any).advanceOffices(156,core.teams);
  check(person.appointments[0].officeHistory?.at(-1)?.office==='SHANGJIANGJUN'&&formation.memberUnitIds.length===4,'senior promotion unlocks and fills at most four actual members');
  check(core.teams.reduce((n,t)=>n+t.users.size,0)===count&&unique(),'reinforcement creates no population or duplicate assignment');
  check(JSON.stringify(positions)===JSON.stringify([...team.users].filter(u=>positions.some(p=>p[0]===u.id)).map(u=>[u.id,u.player.x,u.player.y])),'recruitment and promotion never teleport a body');
  check(before>=0&&rng.length>0,'production population and random checkpoints are available');
  const checkpoint=exportWorldSave(core);
  // Loss branch: keep one verified nearby recruit, then demonstrate the existing no-reserve end transaction.
  const reserve=nearbyRecruitment(team,core,Military,{x,y},1)[0];check(reserve,'loss fixture has a real unassigned nearby replacement');
  const victim=[...team.users].find(u=>u!==commander&&formation.memberUnitIds.includes(u.player.logicalUnitId!))!;const deadId=victim.player.logicalUnitId!;
  check(victim.destroyUser(false,{cause:'BATTLE_DEATH',month:156,damageSource:'HOSTILE_HOME_OCCUPATION'}),'actual member death invokes production User and population casualty transaction');
  check(!formation.memberUnitIds.includes(deadId)&&formation.memberUnitIds.includes(reserve.player.logicalUnitId!)&&formation.memberUnitIds.length===4&&unique(),'real casualty replacement excludes the dying body and uses an existing unassigned unit');
  // Protect all remaining free bodies by moving them into an actual owned city.
  for(const u of team.users)if(!Military.isAssigned(u.player.logicalUnitId!))place(u,0,0);
  const noReserve=nearbyRecruitment(team,core,Military,{x,y},3);check(noReserve.length===0,'no eligible nearby population remains for refill');
  while(formation.status==='ACTIVE'&&formation.memberUnitIds.length>1){const v=[...team.users].find(u=>u!==commander&&formation.memberUnitIds.includes(u.player.logicalUnitId!))!;v.destroyUser(false,{cause:'BATTLE_DEATH',month:156,damageSource:'HOSTILE_HOME_OCCUPATION'});}
  check(formation.status==='DISBANDED'&&person.status==='RETIRED','without real replacements the original minimum-size rule ends the command, never fabricates soldiers');
  hydrateWorldSave(core,structuredClone(checkpoint));team=core.teams.find(t=>t.name===team.name)!;
  const f=Military.getFormation(formation.commandId)!,p=Military.getPerson(person.personId)!;
  const pop=team.users.size;Military.endPersonCommands(p.personId,156,'DISMISSED');check(f.status==='DISBANDED'&&team.users.size===pop,'retirement releases military ownership without deleting residents');
  const other=Military.getFormations().find(f=>f.factionId===team.name&&f.status==='ACTIVE')!,op=Military.getPerson(other.commanderPersonId)!,body=team.getUserById(op.sourceUserId)!,enemy=core.teams.find(t=>t!==team&&t.status==='ACTIVE')!;
  body.setTeam(enemy,{cause:'LIVE_TRANSFER',month:156});check(other.status==='DISBANDED'&&op.factionId===enemy.name,'real commander transfer closes old formation and keeps one person');
  // Same initial capacity for royalty; no extra military slot or fictitious army.
  const candidate=Dynasty.getRoyalMilitaryCandidates(team,156)[0];check(candidate,'same real family still has a legal adult military candidate');
  locals.filter(u=>!u.isDestroyed).forEach(u=>place(team.getUserById(u.id)!,cap.block.x,cap.block.y));
  const royalMembers=nearbyRecruitment(team,core,Military,team.spawnBlock!,1);check(royalMembers.length===1,'royal enlistment also requires a real nearby nonreserved soldier');
  check(Dynasty.enlistRoyalMilitary(candidate,team,156,royalMembers),'real royal enlistment shares the ordinary capacity and population transaction');
  const royal=Dynasty.findRoyalMilitaryPerson(Military.getPeople().find(p=>p.royalIdentity?.rulerId===candidate.rulerId)!.personId)!;
  const rf=Military.getFormations().find(f=>f.commanderPersonId===royal.militaryIdentity!.personId&&f.status==='ACTIVE')!;check(rf.memberUnitIds.length===2,'royal and ordinary pi generals have identical initial size');
  const saved=exportWorldSave(core),resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let i=0;i<12;i++)step();core.setWorldRunning(false);return exportWorldSave(core);};const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'same real military save resumes twelve months identically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'second save reads without member or identity mutation');
  const t=core.teams.find(t=>t.name===team.name)!;t.markExtinct(core.simulator!.year);Dynasty.markExtinct(t,core.simulator!.year);Military.update(core.simulator!.year,core.teams,core.allCities);check(Military.getFormations().every(f=>f.factionId!==t.name||f.status!=='ACTIVE'),'state termination leaves no active home command');
  observations.push({capitalBefore:3,capitalAfterAppointment:3,capacityByOffice:[2,3,4],saveSchemaVersion:saved.saveSchemaVersion});
  return {seed,checks,observations,scope:'controlled frozen production candidate; not published; no long simulation'};
 }finally{game.destroy(true);}
}
