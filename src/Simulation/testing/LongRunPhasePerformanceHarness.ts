import {createNaturalCore} from './NaturalCoreHarness';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import Civil from '../../Politics/CivilAdministration';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {canonicalWorldSaveProjection,type WorldSaveV1} from '../../Persistence/WorldSaveSchema';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
async function fingerprint(save:WorldSaveV1){const value:any=canonicalWorldSaveProjection(save);delete value.appVersion;const ordered=(v:any):any=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,ordered(v[k])])):v;const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(ordered(value))));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
/** Native DTO, real Arcade/fixed steps, no rendering or visual acceptance. */
export async function runLongRunPhasePerformance(seed:string,input:WorldSaveV1,months=300,repetitions=3){
 const {core,game}=await createNaturalCore(seed),rows:any[]=[];
 const military=Military.update,dynasty=Dynasty.update,civil=Civil.update;
 let mismatches=0,monthCalls:number[]=[];
 Military.update=function(...args){if(args[0]!==core.simulator!.year)mismatches++;monthCalls.push(args[0]);return military.apply(this,args);};
 Dynasty.update=function(...args){if(args[0]!==core.simulator!.year)mismatches++;return dynasty.apply(this,args);};
 Civil.update=function(...args){if(args[0]!==core.simulator!.year)mismatches++;return civil.apply(this,args);};
 try{game.loop.stop();
  for(let repeat=0;repeat<repetitions;repeat++){
   core.setWorldRunning(false);const readStart=performance.now();hydrateWorldSave(core,structuredClone(input));const hydrationMs=performance.now()-readStart;
   (core.simulator as any).stepPerformance.reset();mismatches=0;monthCalls=[];core.setSimulationSpeed(4);core.setWorldRunning(true);
   const heapBefore=(performance as any).memory?.usedJSHeapSize,start=performance.now();
   for(let m=0;m<months;m++){for(let step=0;step<30;step++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');if(m%12===11)await new Promise(r=>setTimeout(r,0));}
   core.setWorldRunning(false);const simulationWallMs=performance.now()-start,phases=core.getStepPerformanceDiagnostics(),writeStart=performance.now(),saved=exportWorldSave(core),exportMs=performance.now()-writeStart;
   if(saved.world.worldMonth!==input.world.worldMonth+months||mismatches||monthCalls.length!==months||new Set(monthCalls).size!==months)throw Error('Clock and transaction month mismatch');
   const canonicalSha256=await fingerprint(saved);if(rows.length&&rows[0].canonicalSha256!==canonicalSha256)throw Error('Repeated actual Core continuation differs');
   rows.push({repeat,hydrationMs,exportMs,simulationWallMs,heapBefore,heapAfter:(performance as any).memory?.usedJSHeapSize,clockMismatches:mismatches,uniqueMonths:new Set(monthCalls).size,phases,canonicalSha256});
  }
  return {seed,inputSeed:input.worldRandom.seed,startMonth:input.world.worldMonth,months,repetitions,configuredSpeed:4,input:{users:input.users.length,factions:input.factions.length,rulers:input.dynasties.reduce((n,d)=>n+(d.rulers as unknown[]).length,0),events:(input.worldHistory.events as unknown[]).length},scope:'Manual authoritative fixed steps with real Arcade physics; render loop stopped. Separate from live Electron frame measurement and human acceptance.',rows};
 }finally{Military.update=military;Dynasty.update=dynasty;Civil.update=civil;game.destroy(true);}
}
