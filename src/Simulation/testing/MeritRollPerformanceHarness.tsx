import {Profiler} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import {setTeams,setWorldYear,setSelectedFactionName,setFactionDetailTab} from '../../store/rootSlice';
import FactionDetails from '../../UI/Components/FactionDetails';
import Military from '../../Politics/MilitaryCommandRegistry';
import * as Nobility from '../../Politics/MilitaryNobility';
import History from '../../History/WorldHistory';
import {createNaturalCore} from './NaturalCoreHarness';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {canonicalWorldSaveProjection} from '../../Persistence/WorldSaveSchema';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
export async function runMeritRollPerformance(seed='regional-3',years=422,input?:ReturnType<typeof exportWorldSave>){
 const {core,game}=await createNaturalCore(seed),host=document.createElement('div');host.style.cssText='width:440px;height:800px;position:absolute;top:0';document.body.append(host);const root=createRoot(host);
 const step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');};
 try{
  if(input){core.setWorldRunning(false);hydrateWorldSave(core,structuredClone(input));}else for(let m=0;m<years*12;m++){step();if(m%120===0)await new Promise(r=>setTimeout(r,0));}
  core.setWorldRunning(false);const saved=exportWorldSave(core),factionId=[...core.teams].sort((a,b)=>Military.getPeople().filter(p=>p.appointments.some(a=>a.factionId===b.name)).length-Military.getPeople().filter(p=>p.appointments.some(b=>b.factionId===a.name)).length)[0].name;
  // Both versions start from the identical hydrated boundary, not live-vs-loaded physics runtime.
  hydrateWorldSave(core,structuredClone(saved));
  const cache=(Nobility as any).createMeritRosterProjection?.(),calculations:any[]=[],react:number[]=[];
  const evaluate=()=>{const start=performance.now(),rows=cache?cache.get(Military.getPeople(),Military.getFormations(),History.getEvents(),factionId,core.simulator!.year):Nobility.meritRoster(Military.getPeople(),Military.getFormations(),History.getEvents(),factionId,core.simulator!.year);calculations.push({month:core.simulator!.year,ms:performance.now()-start,rows:rows.map((r:any)=>({personId:r.person.personId,merits:r.merits}))});};
  const render=()=>flushSync(()=>{store.dispatch(setTeams([...core.teams]));store.dispatch(setWorldYear(core.simulator!.year));store.dispatch(setSelectedFactionName(factionId));store.dispatch(setFactionDetailTab('military'));root.render(<Provider store={store}><Profiler id='merit' onRender={(_id,_phase,ms)=>react.push(ms)}><FactionDetails/></Profiler></Provider>);});
  const tab=(text:string)=>Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent===text)!;
  render();react.length=0;let at=performance.now();flushSync(()=>tab('功臣录').click());const enterMs=performance.now()-at,enterReactMs=react.reduce((a,b)=>a+b,0),dom=host.querySelectorAll('*').length;evaluate();
  core.setWorldRunning(true);const simulationMs:number[]=[];for(let m=0;m<12;m++){at=performance.now();step();simulationMs.push(performance.now()-at);evaluate();flushSync(()=>store.dispatch(setWorldYear(core.simulator!.year)));await new Promise(r=>setTimeout(r,0));}core.setWorldRunning(false);
  const after=exportWorldSave(core),canonical:any=canonicalWorldSaveProjection(after);delete canonical.appVersion;const ordered=(v:any):any=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(ordered(canonical)))),canonicalSha256=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
  const frames:any[]=[];let switchToPeopleMs=0;
  for(const text of ['功臣录','现役与历任']){core.setWorldRunning(false);hydrateWorldSave(core,structuredClone(saved));render();at=performance.now();flushSync(()=>tab(text).click());if(text==='现役与历任')switchToPeopleMs=performance.now()-at;core.simulator!.setSpeed(4);core.setWorldRunning(true);game.loop.start(game.loop.callback);await new Promise(r=>setTimeout(r,500));(core as any).runtimePerformance.reset();await new Promise(r=>setTimeout(r,3000));game.loop.stop();core.setWorldRunning(false);const f=(core as any).runtimePerformance.snapshot();frames.push({view:text,fps:1000/f.frameDeltaMs.average,p95FrameMs:f.frameDeltaMs.p95,dom:host.querySelectorAll('*').length});}
  return {seed,years,startedFromHydratedSnapshot:true,worldMonth:saved.world.worldMonth,population:saved.users.length,worldPeople:saved.registries.militaryCommandRegistry.people.length,factionId,localPeople:saved.registries.militaryCommandRegistry.people.filter(p=>p.appointments.some(a=>a.factionId===factionId)).length,events:(saved.worldHistory.events as unknown[]).length,enterMs,enterReactMs,dom,switchToPeopleMs,calculations,ranking12MonthMs:calculations.slice(1).reduce((n,x)=>n+x.ms,0),simulation12MonthMs:simulationMs.reduce((n,x)=>n+x,0),frames,canonicalSha256,worldRandomPosition:after.worldRandom.position,cache:cache?.diagnostics(),snapshot:saved,scope:'one real natural long-world snapshot; React entry, ranking API, fixed monthly simulation and 4x offscreen Electron frames measured separately; not human Chrome acceptance'};
 }finally{flushSync(()=>root.unmount());host.remove();game.loop.stop();game.destroy(true);}
}
