import {createNaturalCore} from './NaturalCoreHarness';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Checks live-to-loaded continuation, separately from loaded-to-loaded repeatability. */
export async function runLiveSaveContinuation(seed:string,years=100){
 const {core,game}=await createNaturalCore(seed),advance=(months:number)=>{core.setWorldRunning(true);for(let m=0;m<months;m++){for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return exportWorldSave(core);};
 try{
  for(let m=0;m<years*12;m++){for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');if(m%120===0)await new Promise(r=>setTimeout(r,0));}
  core.setWorldRunning(false);const saved=exportWorldSave(core),bodyKey=(b:any)=>b.gameObject?.logicalUnitId??`other:${b.gameObject?.constructor.name}:${b.gameObject?.x}/${b.gameObject?.y}`,bodyOrder=core.scene.physics.world.bodies.entries.map(bodyKey),live=advance(12);hydrateWorldSave(core,structuredClone(saved));const hydratedOrder=core.scene.physics.world.bodies.entries.map(bodyKey),loaded=advance(12),diff=diffCanonicalWorldSave(live,loaded);
  hydrateWorldSave(core,structuredClone(saved));const bodyPositions=new Map(bodyOrder.map((id:string,i:number)=>[id,i]));core.scene.physics.world.bodies.entries.sort((a:any,b:any)=>(bodyPositions.get(bodyKey(a))??Infinity)-(bodyPositions.get(bodyKey(b))??Infinity));const withOriginalBodyOrder=advance(12),orderRestored=diffCanonicalWorldSave(live,withOriginalBodyOrder);
  const result={seed,years,startMonth:saved.world.worldMonth,endMonth:loaded.world.worldMonth,matched:diff.matched,bodyCount:bodyOrder.length,bodyOrderChanged:JSON.stringify(bodyOrder)!==JSON.stringify(hydratedOrder),bodyOrderRestoredMatched:orderRestored.matched,bodyOrderRestoredDifferences:orderRestored.differences.slice(0,10),differenceCount:diff.differenceCount,subsystems:diff.subsystemCounts,firstDifferences:diff.differences.slice(0,20)};
  if(!diff.matched)throw Error(JSON.stringify(result));return result;
 }finally{game.destroy(true);}
}
