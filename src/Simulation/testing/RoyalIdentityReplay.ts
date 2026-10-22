import {createNaturalCore} from './NaturalCoreHarness';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';

/** Replays the real failed world. No synthetic person, war or population system. */
export async function runRoyalIdentityReplay(seed:string,expectFixed:boolean){
 const {core,game}=await createNaturalCore(seed),trace:any[]=[],checks:string[]=[];let previous='';
 const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);checks.push(label);};
 const step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');};
 try{
  for(let month=1;month<=1200;month++){
   step();
   const links=Military.getPeople().filter(p=>p.royalIdentity).map(p=>{
    const owner=Dynasty.getAll().find(d=>d.factionId===p.royalIdentity!.factionId),r=owner?.rulers.find(r=>r.id===p.royalIdentity!.rulerId),u=core.teams.flatMap(t=>[...t.users]).find(u=>u.id===p.sourceUserId),team=core.teams.find(t=>t.name===owner?.factionId);
    return {personId:p.personId,militaryFaction:p.factionId,militaryStatus:p.status,militaryDeath:p.deathMonth,royalFaction:owner?.factionId,royalStatus:r?.status,royalDeath:r?.deathMonth,currentRulerId:owner?.currentRulerId,royalId:r?.id,naturalDeath:r?.naturalDeathYear,politicalEnd:r?.endYear,ownerStatus:team?.status,user:u&&{id:u.id,role:u.role,rulerId:u.rulerId,factionId:u.team.name,unitId:u.player.logicalUnitId},commands:Military.getFormations().filter(f=>f.commanderPersonId===p.personId).map(f=>({id:f.commandId,status:f.status,members:f.memberUnitIds,target:f.targetCityId})),consistent:!!r&&r.bornYear===p.bornMonth&&r.deathMonth===p.deathMonth&&(r.status==='dead')===(p.status==='DEAD')};
   });
   const stamp=JSON.stringify(links);if(stamp!==previous){trace.push({month,links,population:core.getPopulationSummary(),events:History.getEvents().filter(e=>(e.monthIndex??e.year)>=month-1).slice(0,12)});previous=stamp;}
   const invalid=links.filter(r=>!r.consistent);
   if(invalid.length){
    if(expectFixed)throw Error('Royal identity diverged: '+JSON.stringify({month,invalid,trace:trace.slice(-4)}));
    return {seed,outcome:'expected-invalid-old-production',firstMismatchMonth:month,invalid,trace};
   }
   if(expectFixed&&month%12===0){core.setWorldRunning(false);exportWorldSave(core);core.setWorldRunning(true);}
   if(month%120===0)await new Promise(r=>setTimeout(r,0));
  }
  check(expectFixed,'old failure must reproduce');core.setWorldRunning(false);const save=exportWorldSave(core);
  const resume=()=>{hydrateWorldSave(core,structuredClone(save));core.setWorldRunning(true);for(let n=0;n<12;n++)step();core.setWorldRunning(false);return exportWorldSave(core);};
  const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'same save resumes twelve months identically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'second save loads without canonical mutation');
  return {seed,outcome:'fixed',checks,validatedMonths:1200,trace,saveSchemaVersion:save.saveSchemaVersion};
 }finally{game.destroy(true);}
}
