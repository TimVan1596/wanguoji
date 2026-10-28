import {Profiler} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import {setTeams,setWorldYear,setSelectedFactionName,setFactionDetailTab} from '../../store/rootSlice';
import FactionDetails from '../../UI/Components/FactionDetails';
import Dynasty from '../../Politics/Dynasty';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import {deriveRulerAssessment} from '../../Politics/RulerHistoriography';
import {getRulerHistoricalEvents,getRulerDiplomaticEvents} from '../../Politics/RulerChronicle';
import {personServiceLinks,preAccessionMilitary} from '../../Politics/PersonServiceLinks';
import {createNaturalCore} from './NaturalCoreHarness';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {canonicalWorldSaveProjection,diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Same persisted world/ruler, actual React controls and real monthly Core. Never a human visual acceptance. */
export async function runRoyalPanelPerformance(seed:string,input:ReturnType<typeof exportWorldSave>,cached=false){
 if(!input)throw Error('A common V30 input is required; do not generate a new long world for profiling');
 const {core,game}=await createNaturalCore(seed),host=document.createElement('div');host.style.cssText='width:350px;height:800px;position:absolute;top:0';document.body.append(host);const root=createRoot(host),react:number[]=[];
 const step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');};
 try{
  core.setWorldRunning(false);hydrateWorldSave(core,structuredClone(input));const saved=exportWorldSave(core),events=History.getEvents();
  const choices=Dynasty.getAll().flatMap(d=>d.rulers.filter(r=>r.chronicle&&r.accessionYear!==undefined&&r.endYear!==undefined&&r.deathMonth!==undefined).map(r=>({r,factionId:d.factionId,score:events.filter(e=>(e.monthIndex??e.year)>=r.accessionYear!&&(e.monthIndex??e.year)<=r.endYear!).length}))).sort((a,b)=>b.score-a.score||a.r.id.localeCompare(b.r.id));
  const chosen=choices[0];if(!chosen)throw Error('No ended historical monarch in this common snapshot');const factionId=chosen.factionId,rulerId=chosen.r.id;
  const read=()=>{const dynasty=Dynasty.get(factionId)!,ruler=dynasty.rulers.find(r=>r.id===rulerId)!,team=core.teams.find(t=>t.name===factionId)!;return {ruler,rulers:dynasty.rulers,team,events:History.getEvents(),worldMonth:core.simulator!.year,people:Military.getPeople(),formations:Military.getFormations(),allEvents:History.getEvents(),factions:new Map(core.teams.map(t=>[t.name,t]))};};
  const modulePath='/src/UI/Components/FactionDetails/RoyalReadingProjection.ts';const projection=cached?(await import(/* @vite-ignore */modulePath)).createRoyalReadingProjection():undefined;
  const projected:any[]=[];const evaluate=()=>{const a=read(),at=performance.now(),v=projection?projection.get(a):{evidence:deriveRulerAssessment({ruler:a.ruler,dynasty:{rulers:a.rulers},faction:a.team,events:a.events,worldMonth:a.worldMonth}).evidence,full:getRulerHistoricalEvents(a.events,a.ruler,factionId,a.worldMonth,a.ruler.chronicle!.notableEventIds,Infinity),selected:getRulerHistoricalEvents(a.events,a.ruler,factionId,a.worldMonth,a.ruler.chronicle!.notableEventIds,8),diplomacy:getRulerDiplomaticEvents(a.events,a.ruler,factionId,a.worldMonth),service:personServiceLinks(factionId,[a.ruler],a.people,a.formations,a.allEvents,a.worldMonth),earlier:preAccessionMilitary(a.ruler,a.people,a.formations,a.allEvents,{factions:a.factions})};projected.push({month:a.worldMonth,ms:performance.now()-at,evidence:v.evidence,full:v.full.map((e:any)=>e.id),selected:v.selected.map((e:any)=>e.id),diplomacy:v.diplomacy.map((e:any)=>e.id),service:v.service,earlier:v.earlier});};
  const render=(key='main')=>flushSync(()=>{store.dispatch(setTeams([...core.teams]));store.dispatch(setWorldYear(core.simulator!.year));store.dispatch(setSelectedFactionName(factionId));store.dispatch(setFactionDetailTab('house'));root.render(<Provider store={store}><Profiler id='royal' onRender={(_id,_phase,ms)=>react.push(ms)}><FactionDetails key={key}/></Profiler></Provider>);});
  const button=()=>{const r=read().ruler,pid=r.militaryIdentity?.personId??r.residentIdentity?.personId??r.id;return host.querySelector(`[data-person-id="${pid}"]`)?.closest('button')?.parentElement?.querySelector<HTMLButtonElement>('button[aria-expanded]');};
  let at=performance.now();render();const collapsedEnterMs=performance.now()-at;react.length=0;const b=button();if(!b)throw Error('Historical ruler archive control is missing');at=performance.now();flushSync(()=>b.click());const expandMs=performance.now()-at,expandReactMs=react.reduce((n,x)=>n+x,0),expandedDom=host.querySelectorAll('*').length;evaluate();
  core.setWorldRunning(true);const simulation:number[]=[],updates:number[]=[];for(let m=0;m<12;m++){at=performance.now();step();simulation.push(performance.now()-at);evaluate();at=performance.now();flushSync(()=>store.dispatch(setWorldYear(core.simulator!.year)));updates.push(performance.now()-at);await new Promise(r=>setTimeout(r,0));}core.setWorldRunning(false);
  const after=exportWorldSave(core),canonical:any=canonicalWorldSaveProjection(after);delete canonical.appVersion;const ordered=(v:any):any=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(ordered(canonical)))),canonicalSha256=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
  const phases:any[]=[];
  for(const phase of ['collapsed','expanded','collapsed-again']){core.setWorldRunning(false);hydrateWorldSave(core,structuredClone(saved));render(phase);if(phase!=='collapsed')flushSync(()=>button()!.click());let collapseMs:number|undefined;if(phase==='collapsed-again'){at=performance.now();flushSync(()=>button()!.click());collapseMs=performance.now()-at;}
   const longTasks:number[]=[];const observer=PerformanceObserver.supportedEntryTypes.includes('longtask')?new PerformanceObserver(list=>list.getEntries().forEach(e=>longTasks.push(e.duration))):undefined;observer?.observe({type:'longtask'});
   core.simulator!.setSpeed(4);core.setWorldRunning(true);game.loop.start(game.loop.callback);await new Promise(r=>setTimeout(r,500));(core as any).runtimePerformance.reset();longTasks.length=0;react.length=0;await new Promise(r=>setTimeout(r,3000));game.loop.stop();core.setWorldRunning(false);observer?.disconnect();const f=(core as any).runtimePerformance.snapshot();phases.push({phase,collapseMs,fps:1000/f.frameDeltaMs.average,p95FrameMs:f.frameDeltaMs.p95,fixedStepCpuMs:f.fixedStepCpuMs,presentationCpuMs:f.presentationCpuMs,reactMs:react.reduce((n,x)=>n+x,0),longTasks,dom:host.querySelectorAll('*').length});}
  const repeat=()=>{core.setWorldRunning(false);hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++)step();core.setWorldRunning(false);return exportWorldSave(core);};const a=repeat(),b2=repeat();if(!diffCanonicalWorldSave(a,b2).matched)throw Error('Repeated loaded twelve-month continuation differs');hydrateWorldSave(core,structuredClone(a));if(!diffCanonicalWorldSave(a,exportWorldSave(core)).matched)throw Error('Second read differs');
  return {seed,worldMonth:saved.world.worldMonth,population:saved.users.length,eventCount:events.length,factionId,rulerId,rulerName:chosen.r.houseName+chosen.r.givenName,collapsedEnterMs,expandMs,expandReactMs,expandedDom,projected,projection12MonthMs:projected.slice(1).reduce((n,x)=>n+x.ms,0),updates12MonthMs:updates.reduce((a,b)=>a+b,0),simulation12MonthMs:simulation.reduce((a,b)=>a+b,0),phases,canonicalSha256,worldRandomPosition:after.worldRandom.position,continuation:{months:12,deterministic:true,secondRead:true},cache:projection?.diagnostics(),scope:'same V30 world and ended monarch; actual React entry/control, direct projection API, fixed Core CPU, 4x offscreen frame sampling and long-task observations are separate; not Chrome human acceptance'};
 }finally{flushSync(()=>root.unmount());host.remove();game.loop.stop();game.destroy(true);}
}
