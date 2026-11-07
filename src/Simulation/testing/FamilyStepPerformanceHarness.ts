import {benchmarkActualFamilyEntries} from './FamilyEntryReplayBench';
import {createNaturalCore} from './NaturalCoreHarness';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import {observeFamilyPopulationEntryForSimulation} from '../../Politics/MilitaryFamily';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {canonicalWorldSaveProjection,diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Sequential controlled measurement on the same actual world and actual 4x Core.
 * Hydration/export are measured separately, never included in simulated-step CPU. */
export async function runFamilyStepPerformance(seed:string,input:ReturnType<typeof exportWorldSave>){
 const {core,game}=await createNaturalCore(seed),updateFamilies=Military.updateFamilies,updateTitles=Military.updateFamilyTitles,rows:any[]=[];let annualMs=0,familyMs=0,titleMs=0,entryMs=0,entryCalls=0,royalTitleMs=0;
 const updateRoyalTitles=Dynasty.updateRoyalNobility;if(updateRoyalTitles)Dynasty.updateRoyalNobility=function(...args){const at=performance.now();try{return updateRoyalTitles.apply(this,args);}finally{royalTitleMs+=performance.now()-at;}};
 Military.updateFamilies=function(...args){const at=performance.now();try{return updateFamilies.apply(this,args);}finally{const ms=performance.now()-at;familyMs+=ms;if(args[0]%12===0)annualMs+=ms;}};
 Military.updateFamilyTitles=function(...args){const at=performance.now();try{return updateTitles.apply(this,args);}finally{titleMs+=performance.now()-at;}};
 observeFamilyPopulationEntryForSimulation(s=>{entryMs+=s.elapsedMs;entryCalls++;});
 try{
  let first:ReturnType<typeof exportWorldSave>|undefined;
  for(let repeat=0;repeat<3;repeat++){
   core.setWorldRunning(false);const restoreStart=performance.now();hydrateWorldSave(core,structuredClone(input));const hydrationMs=performance.now()-restoreStart;
   royalTitleMs=0;annualMs=0;familyMs=0;titleMs=0;entryMs=0;entryCalls=0;(core.simulator as any).stepPerformance.reset();core.setSimulationSpeed(4);core.setWorldRunning(true);
   const end=input.world.worldMonth+12,start=performance.now();let ticks=0;
   while(core.simulator!.year<end&&ticks<2000){(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');ticks++;}
   core.setWorldRunning(false);const stepWallMs=performance.now()-start;if(core.simulator!.year!==end)throw Error('Actual 4x Core did not advance exactly twelve months');
   const saveStart=performance.now(),after=exportWorldSave(core),exportMs=performance.now()-saveStart,valid=validateWorldSave(after);if(!valid.valid)throw Error(valid.errors.join(';'));
   if(first&&!diffCanonicalWorldSave(first,after).matched)throw Error('Repeated actual 4x continuation is not deterministic');first??=after;
   rows.push({repeat,hydrationMs,stepWallMs,ticks,annualFamilyMs:annualMs,allMonthlyFamilyMs:familyMs,titleMs,royalTitleMs,entryMs,entryCalls,exportMs,phases:core.getStepPerformanceDiagnostics(),canonicalSha256:await hash(after)});
  }
  observeFamilyPopulationEntryForSimulation(undefined);const entryReplay=benchmarkActualFamilyEntries(input);
  return {entryReplay,seed,startMonth:input.world.worldMonth,endMonth:core.simulator!.year,speed:4,repetitions:3,deterministic:true,scope:'Actual Core.advanceLogicalStep and Phaser postupdate; same real input restored before every measurement, no screenshots or human acceptance',rows};
 }finally{if(updateRoyalTitles)Dynasty.updateRoyalNobility=updateRoyalTitles;Military.updateFamilies=updateFamilies;Military.updateFamilyTitles=updateTitles;observeFamilyPopulationEntryForSimulation(undefined);game.destroy(true);}
}
async function hash(save:ReturnType<typeof exportWorldSave>){const c:any=canonicalWorldSaveProjection(save);delete c.appVersion;const ordered=(v:any):any=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(ordered(c))));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
