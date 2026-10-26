import {createElement,Profiler} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import {setTeams,setWorldYear,setSelectedFactionName,setFactionDetailTab} from '../../store/rootSlice';
import FactionDetails from '../../UI/Components/FactionDetails';
import Military from '../../Politics/MilitaryCommandRegistry';
import {createNaturalCore} from './NaturalCoreHarness';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import {frameAttribution} from '../FrameAttribution';
/** Offscreen Electron Canvas timing only, not human Chrome FPS or visual acceptance. */
export async function runRuntimePopulationPerformance(seed='regional-1',targets=[100,150,200]){
 const {core,game}=await createNaturalCore(seed),snapshots=new Map<number,ReturnType<typeof exportWorldSave>>(),results:any[]=[];
 const population=()=>core.teams.reduce((n,t)=>n+t.users.size,0);
 try{
  for(let m=0;m<=600;m++){
   if(m%12===0){const n=population();for(const target of targets)if(!snapshots.has(target)&&Math.abs(n-target)<=12){core.setWorldRunning(false);snapshots.set(target,exportWorldSave(core));core.setWorldRunning(true);}}
   if(m===600)break;for(let i=0;i<30;i++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');if(m%120===0)await new Promise(r=>setTimeout(r,0));
  }
  core.setWorldRunning(false);
  for(const [target,save]of snapshots)for(const speed of [1,4])for(const sidebar of target===Math.max(...snapshots.keys())?[false,true]:[false]){
   hydrateWorldSave(core,structuredClone(save));
   const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let commits:number[]=[];
   if(sidebar){const team=[...core.teams].sort((a,b)=>Military.getPeople().filter(p=>p.appointments.some(x=>x.factionId===b.name)).length-Military.getPeople().filter(p=>p.appointments.some(x=>x.factionId===a.name)).length)[0];flushSync(()=>{store.dispatch(setTeams([...core.teams]));store.dispatch(setWorldYear(core.simulator!.year));store.dispatch(setSelectedFactionName(team.name));store.dispatch(setFactionDetailTab('military'));root.render(createElement(Provider,{store,children:createElement(Profiler,{id:'actual-military-sidebar',onRender:(_id,_phase,duration)=>{commits.push(duration);},children:createElement(FactionDetails)})}));});}
   let goalCalls=0,goalCpuMs=0;const observe=core.checkGameOver;core.checkGameOver=function(){const started=performance.now();try{return observe.call(this);}finally{goalCalls++;goalCpuMs+=performance.now()-started;}};
   core.simulator!.setSpeed(speed);core.setWorldRunning(true);
   game.loop.start(game.loop.callback);await new Promise(r=>setTimeout(r,500));
   (core as any).runtimePerformance.reset();frameAttribution.reset();commits=[];goalCalls=0;goalCpuMs=0;const counters=core.getSimulationDiagnostics();
   await new Promise(r=>setTimeout(r,3000));game.loop.stop();core.setWorldRunning(false);
   const frame=(core as any).runtimePerformance.snapshot(),attribution=frameAttribution.snapshot(),phases=core.getStepPerformanceDiagnostics();
   const world:any=core.scene.physics.world;
   results.push({physics:{dynamicBodies:world.bodies.size,staticBodies:world.staticBodies.size,activeColliders:world.colliders.getActive?.().length??world.colliders._active?.length,occupationCallbacks:core.getSimulationDiagnostics().occupationCallbacks-counters.occupationCallbacks,goalObservationCalls:goalCalls,goalObservationCpuMs:goalCpuMs},sidebar:sidebar?'military':'none',react:{commits:commits.length,totalActualDurationMs:commits.reduce((n,x)=>n+x,0),maxActualDurationMs:Math.max(0,...commits)},target,populationAtStart:save.users.length,populationAtEnd:population(),speed,worldMonth:save.world.worldMonth,averageFPS:frame.frameDeltaMs.average?1000/frame.frameDeltaMs.average:null,frame,attribution,phases,entities:core.getRuntimeUnitDiagnostics(),scope:'actual offscreen Electron Canvas loop; React Profiler only for the explicit military sidebar case; not user Chrome FPS or GPU render CPU'});
   core.checkGameOver=observe;flushSync(()=>root.unmount());host.remove();
  }
  return {seed,results,missing:targets.filter(n=>!snapshots.has(n)),scope:'natural first fifty-year checkpoints; sampled population band ±12; real Phaser loop 3.5 seconds per speed, no screenshots'};
 }finally{game.loop.stop();game.destroy(true);}
}
