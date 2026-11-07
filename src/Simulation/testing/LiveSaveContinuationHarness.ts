import {createNaturalCore} from './NaturalCoreHarness';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Compare uninterrupted production Core to the same paused save loaded and resumed.
 * Loaded-to-loaded repeatability alone cannot detect a lost collision schedule. */
export async function runLiveSaveContinuation(seed:string,years=100){
 const {core,game}=await createNaturalCore(seed);
 const advance=(months:number)=>{core.setWorldRunning(true);for(let m=0;m<months;m++){for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return exportWorldSave(core);};
 try{
  for(let m=0;m<years*12;m++){for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');if(m%120===0)await new Promise(r=>setTimeout(r,0));}
  core.setWorldRunning(false);const saved=exportWorldSave(core),live=advance(12);
  hydrateWorldSave(core,structuredClone(saved));const initial=diffCanonicalWorldSave(saved,exportWorldSave(core));
  const loaded=advance(12),diff=diffCanonicalWorldSave(live,loaded);hydrateWorldSave(core,structuredClone(loaded));const reread=diffCanonicalWorldSave(loaded,exportWorldSave(core));
  const result={seed,years,startMonth:saved.world.worldMonth,endMonth:loaded.world.worldMonth,colliders:saved.collisionSchedule.colliders.length,matched:diff.matched,initialMatched:initial.matched,secondRead:reread.matched,differenceCount:diff.differenceCount,firstDifferences:diff.differences};
  if(!diff.matched||!initial.matched||!reread.matched)throw Error(JSON.stringify(result));return result;
 }finally{game.destroy(true);}
}
