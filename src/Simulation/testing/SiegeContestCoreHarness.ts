import {createNaturalCore} from './NaturalCoreHarness';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import {siegeParticipants} from '../SiegeParticipants';
import Diplomacy from '../../Politics/Diplomacy';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';

/** Real bodies and logical registry, production City settlement; candidate code runs in frozen copies. */
export async function runSiegeContestCore(seed:string,candidate=false){
 const {core,game}=await createNaturalCore(seed),checks:string[]=[],damage:any[]=[];
 const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);checks.push(label);};
 const step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');};
 try{
  for(let n=0;n<12;n++)step();core.setWorldRunning(false);const base=exportWorldSave(core);
  for(const logical of [false,true]){
   const scenario=(a:number,d:number)=>{
    hydrateWorldSave(core,structuredClone(base));core.logicalGameplayAuthority=logical;
    const m=core.simulator!.year,city=core.allCities.find(c=>c.ownerTeam&&c.ownerTeam.users.size>=8&&!c.isInCaptureGrace(m))!;
    const owner=city.ownerTeam!,attack=core.teams.find(t=>t!==owner&&t.users.size>=3&&Diplomacy.canAttack(t.name,owner.name,m))!;
    const place=(u:any,x:number,y:number)=>{u.player.setPosition(x,y);u.player.body.reset(x,y);const state=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId)!.state;state.logicalX=x;state.logicalY=y;};
    for(const t of core.teams)for(const u of t.users)place(u,-1024,-1024);
    [...attack.users].slice(0,a).forEach(u=>place(u,city.block.x,city.block.y));[...owner.users].slice(0,d).forEach(u=>place(u,city.block.x,city.block.y));
    check(siegeParticipants(city,attack,core,32,true).length===a,`${logical}/${a}/${d}: unique real attackers`);
    check(siegeParticipants(city,owner,core,32,false).length===d,`${logical}/${a}/${d}: only owner units defend`);
    const devastation=city.devastation,wall=city.defense;for(let i=0;i<100;i++)city.registerSiegeContact(attack,m);(city as any).updateSiege(m);
    const loss=wall-city.defense;damage.push({logical,attackers:a,defenders:d,damage:loss});return {city,attack,owner,m,place,loss,devastationChange:city.devastation-devastation};
   };
   const single=scenario(1,0);check(candidate?single.loss===0:single.loss>0,`${logical}: single attacker ${candidate?'cannot freely damage':'baseline fixed damage'}`);
   if(candidate)check(single.devastationChange===0,`${logical}: insufficient pressure cannot freely devastate a city`);
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
  check(JSON.stringify(damage.filter(r=>!r.logical).map(({logical,...r})=>r))===JSON.stringify(damage.filter(r=>r.logical).map(({logical,...r})=>r)), 'Phaser and logical authorities settle identical verified force scenarios');
  hydrateWorldSave(core,structuredClone(base));const month=core.simulator!.year,city=core.allCities.find(c=>c.ownerTeam&&!c.isInCaptureGrace(month))!,attacker=core.teams.find(t=>t!==city.ownerTeam&&Diplomacy.canAttack(t.name,city.ownerFactionId,month))!;
  city.registerSiegeContact(attacker,month);const pending=exportWorldSave(core);check(validateWorldSave(pending).valid,'pending real siege contact is valid JSON DTO');
  hydrateWorldSave(core,structuredClone(pending));check(diffCanonicalWorldSave(pending,exportWorldSave(core)).matched,'pending siege survives hydration without duplicate events');
  const resume=()=>{hydrateWorldSave(core,structuredClone(pending));core.setWorldRunning(true);for(let n=0;n<12;n++)step();core.setWorldRunning(false);return exportWorldSave(core);};
  const a=resume(),b=resume();check(validateWorldSave(a).valid&&diffCanonicalWorldSave(a,b).matched,'twelve month real siege continuation deterministic');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'second save reads identically');
  return {seed,candidate,checks,damage,saveSchemaVersion:base.saveSchemaVersion};
 }finally{game.destroy(true);}
}
