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
   for(const [a,d]of [[2,0],[2,2],[4,1],[4,4]]){
    const s=scenario(a,d,logical),before=s.city.defense;
    for(let n=0;n<=36&&s.city.ownerTeam===s.owner;n++){s.tick(n);if(History.getEvents().some(e=>e.type==='siege-ended'&&e.cityId===s.city.id&&e.year>=s.m))break;}
    const end=History.getEvents().filter(e=>e.type==='siege-ended'&&e.cityId===s.city.id&&e.year>=s.m).at(-1)!;
    console.info('[BattleResult]',JSON.stringify({logical,a,d,before,defense:s.city.defense,end,endOwner:s.city.ownerFactionId,owner:s.owner.name,attack:s.attack.name,battle:s.city.siegeBattle}));
    check(end,`${logical}/${a}/${d}: battle reaches a real capture or end`);
    if(d===0)check(s.city.ownerTeam===s.attack,`${logical}: two real attackers can take an undefended city over actual months`);
    if(a===d)check(s.city.ownerTeam===s.owner&&end.metadata?.reason==='REPULSED',`${logical}: equal local defenders resist and end the assault`);
    results.push({logical,a,d,before,endMonth:end.year,result:end.metadata?.reason,captured:s.city.ownerTeam===s.attack});
    check(!s.city.siegeBattle,`${logical}/${a}/${d}: concluded battle leaves no active siege state`);
   }
   {
    const s=scenario(2,0,logical);s.tick(0);const wall=s.city.defense;for(const u of s.attackers)place(u,-1024,-1024);s.tick(1);
    check(!s.city.underSiege&&s.city.defense===wall,`${logical}: departed actual attackers stop damage and record contact ending`);
    check(History.getEvents().some(e=>e.type==='siege-ended'&&e.metadata?.reason==='CONTACT_ENDED'),`${logical}: withdrawal source is real lost contact`);
   }
   {
    const s=scenario(2,0,logical);s.tick(0);const wall=s.city.defense;
    (new DiplomacySystem(Diplomacy,()=>core.allCities,()=>{}) as any).form(s.attack,s.owner,'TRUCE',s.m,{reason:'WAR_EXHAUSTION_TRUCE',recentBilateralCaptureCount:1,stabilityA:10,stabilityB:10});s.tick(1);
    check(!s.city.underSiege&&s.city.defense===wall&&History.getEvents().some(e=>e.type==='siege-ended'&&e.metadata?.reason==='TRUCE'),`${logical}: actual treaty ends battle without a fictional victory`);
   }
  }
  const s=scenario(2,0);s.tick(0);const pending=exportWorldSave(core);
  const resume=()=>{hydrateWorldSave(core,structuredClone(pending));core.setWorldRunning(true);for(let i=0;i<12;i++)step();core.setWorldRunning(false);return exportWorldSave(core);};
  const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'active V24 battle resumes twelve months identically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'second battle save reads identically');
  return {seed,checks,results,saveSchemaVersion:a.saveSchemaVersion};
 }finally{game.destroy(true);}
}
