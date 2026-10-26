import {createNaturalCore} from './NaturalCoreHarness';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import {frameAttribution} from '../FrameAttribution';
/** Offscreen Electron Canvas timing only, not human Chrome FPS or visual acceptance. */
export async function runRuntimePopulationPerformance(seed='regional-1'){
 const {core,game}=await createNaturalCore(seed),snapshots=new Map<number,ReturnType<typeof exportWorldSave>>(),results:any[]=[];
 const population=()=>core.teams.reduce((n,t)=>n+t.users.size,0);
 try{
  for(let m=0;m<=600;m++){
   if(m%12===0){const n=population();for(const target of [100,150,200])if(!snapshots.has(target)&&Math.abs(n-target)<=12){core.setWorldRunning(false);snapshots.set(target,exportWorldSave(core));core.setWorldRunning(true);}}
   if(m===600)break;for(let i=0;i<30;i++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');if(m%120===0)await new Promise(r=>setTimeout(r,0));
  }
  for(const [target,save]of snapshots)for(const speed of [1,4]){
   hydrateWorldSave(core,structuredClone(save));core.simulator!.setSpeed(speed);core.setWorldRunning(true);
   (core as any).runtimePerformance.reset();frameAttribution.reset();game.loop.start(game.loop.callback);
   await new Promise(r=>setTimeout(r,3500));game.loop.stop();core.setWorldRunning(false);
   const frame=(core as any).runtimePerformance.snapshot(),attribution=frameAttribution.snapshot(),phases=core.getStepPerformanceDiagnostics();
   results.push({target,populationAtStart:save.users.length,populationAtEnd:population(),speed,worldMonth:save.world.worldMonth,averageFPS:frame.frameDeltaMs.average?1000/frame.frameDeltaMs.average:null,frame,attribution,phases,entities:core.getRuntimeUnitDiagnostics(),scope:'actual offscreen Electron Canvas loop; no React sidebar mounted; not user Chrome FPS'});
  }
  return {seed,results,missing:[100,150,200].filter(n=>!snapshots.has(n)),scope:'natural first fifty-year checkpoints; sampled population band ±12; real Phaser loop 3.5 seconds per speed, no screenshots'};
 }finally{game.loop.stop();game.destroy(true);}
}
