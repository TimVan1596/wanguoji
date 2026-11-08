import {createNaturalCore} from './NaturalCoreHarness';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {observeSaveValidation} from '../../Persistence/SaveValidationTiming';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {diffCanonicalWorldSave,type WorldSaveV1} from '../../Persistence/WorldSaveSchema';
/** Actual same native DTO, three isolated restores. Not a simulation balance experiment. */
export async function runSaveValidationPerformance(seed:string,input:WorldSaveV1,compareLegacy=false){
 const {core,game}=await createNaturalCore(seed);const rows:any[]=[];let oracleCases=0;
 if(compareLegacy){
  const path="/logs/z59-RoyalHouseholdValidation-before.ts",old=await import(/* @vite-ignore */path),current=await import("../../Persistence/RoyalHouseholdValidation");
  const cases:any[]=[input,structuredClone(input),structuredClone(input),structuredClone(input),structuredClone(input),structuredClone(input)];
  for(let i=1;i<cases.length;i++){const d:any=cases[i].dynasties.find((d:any)=>d.rulers.some((r:any)=>r.householdBirth)),r:any=d.rulers.find((r:any)=>r.householdBirth);if(!r)throw Error("Missing actual child");if(i===1)r.householdBirth.ticket+=.001;if(i===2)r.parentId="forged-parent";if(i===3)r.naturalDeathMonth+=1;if(i===4)r.successionScope=undefined;if(i===5)cases[i].worldHistory.events.push(structuredClone(cases[i].worldHistory.events.find((e:any)=>e.id===r.householdBirth.eventId)!));}
  for(const value of cases){if(JSON.stringify(old.validateRoyalHouseholds(value))!==JSON.stringify(current.validateRoyalHouseholds(value)))throw Error("Indexed birth validator differs from original V55 oracle");oracleCases++;}
 }
 try{game.loop.stop();core.setWorldRunning(false);
  for(let repeat=0;repeat<3;repeat++){
   const phases:Record<string,number>={};observeSaveValidation((name,ms)=>phases[name]=(phases[name]??0)+ms);
   let at=performance.now();const result=validateWorldSave(input),validationMs=performance.now()-at;observeSaveValidation(undefined);
   if(!result.valid)throw Error(result.errors.slice(0,12).join(';'));
   at=performance.now();const json=JSON.stringify(input),stringifyMs=performance.now()-at;
   at=performance.now();const dto=JSON.parse(json),parseMs=performance.now()-at;
   at=performance.now();hydrateWorldSave(core,dto);const hydrationMs=performance.now()-at;
   at=performance.now();const saved=exportWorldSave(core),exportMs=performance.now()-at;
   const diff=diffCanonicalWorldSave(input,saved);if(!diff.matched)throw Error('Same native DTO differs after read/export: '+JSON.stringify(diff));
   rows.push({repeat,validationMs,phases,stringifyMs,parseMs,hydrationMs,exportMs,bytes:new TextEncoder().encode(json).byteLength,heapBytes:(performance as any).memory?.usedJSHeapSize,canonicalUnchanged:true});
  }return {seed,oracleCases,month:input.world.worldMonth,saveVersion:input.saveSchemaVersion,rows,scope:'Same native DTO, actual complete strict validation, hydration and exporter; no header upgrade, history mutation, RNG or screenshots'};
 }finally{observeSaveValidation(undefined);game.destroy(true);}
}
