import {createElement,Profiler} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import {setTeams,setWorldYear,setSelectedFactionName,setFactionDetailTab} from '../../store/rootSlice';
import FactionDetails from '../../UI/Components/FactionDetails';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import {createNaturalCore} from './NaturalCoreHarness';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
export async function runMilitaryPanelPerformance(seed='regional-3',years=320,snapshot?:ReturnType<typeof exportWorldSave>){
 const {core,game}=await createNaturalCore(seed);const host=document.createElement('div');host.style.cssText='width:440px;height:800px;position:absolute;left:0;top:0;';document.body.append(host);const root=createRoot(host);
 try{
  if(snapshot){core.setWorldRunning(false);hydrateWorldSave(core,snapshot);}else for(let m=0;m<years*12;m++){for(let i=0;i<30;i++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');if(m%120===0)await new Promise(r=>setTimeout(r,0));}
  core.setWorldRunning(false);const saved=exportWorldSave(core),team=[...core.teams].sort((a,b)=>Military.getPeople().filter(p=>p.appointments.some(x=>x.factionId===b.name)).length-Military.getPeople().filter(p=>p.appointments.some(x=>x.factionId===a.name)).length)[0];
  let chronicleCalls=0,eventReads=0;const chronicle=Military.getChronicle,events=History.getEvents;Military.getChronicle=function(...args){chronicleCalls++;return chronicle.apply(this,args);};History.getEvents=function(...args){eventReads++;return events.apply(this,args);};
  const commits:number[]=[];let start=performance.now();flushSync(()=>{store.dispatch(setTeams([...core.teams]));store.dispatch(setWorldYear(core.simulator!.year));store.dispatch(setSelectedFactionName(team.name));store.dispatch(setFactionDetailTab('military'));root.render(createElement(Provider,{store,children:createElement(Profiler,{id:'military',onRender:(_id,_phase,d)=>commits.push(d),children:createElement(FactionDetails)})}));});
  const enterMs=performance.now()-start,collapsedChronicleCalls=chronicleCalls,initialDom=host.querySelectorAll('*').length;
  const rows=Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]'));start=performance.now();if(rows.length)flushSync(()=>rows[0].click());const firstExpandMs=performance.now()-start;
  const measure=async(sidebar:boolean)=>{if(!sidebar)flushSync(()=>root.render(null));core.simulator!.setSpeed(4);core.setWorldRunning(true);game.loop.start(game.loop.callback);await new Promise(r=>setTimeout(r,500));(core as any).runtimePerformance.reset();await new Promise(r=>setTimeout(r,3000));game.loop.stop();core.setWorldRunning(false);const f=(core as any).runtimePerformance.snapshot();return {sidebar,averageFPS:1000/f.frameDeltaMs.average,p95FrameMs:f.frameDeltaMs.p95};};
  const frame=[await measure(true),await measure(false)];Military.getChronicle=chronicle;History.getEvents=events;
  return {seed,years,factionId:team.name,worldMonth:saved.world.worldMonth,population:saved.users.length,worldPeople:Military.getPeople().length,localPeople:Military.getPeople().filter(p=>p.appointments.some(a=>a.factionId===team.name)).length,worldEvents:(saved.worldHistory.events as unknown[]).length,enterMs,firstExpandMs,collapsedChronicleCalls,eventReads,initialDom,frame,react:{commits:commits.length,totalMs:commits.reduce((a,b)=>a+b,0)},snapshot:saved,scope:'actual natural Core world; same snapshot for paired UI measurements; offscreen Electron timings, not human Chrome acceptance'};
 }finally{flushSync(()=>root.unmount());host.remove();game.loop.stop();game.destroy(true);}
}
