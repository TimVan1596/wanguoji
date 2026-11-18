import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Profiler} from 'react';
import {Provider} from 'react-redux';
import {store} from '../../store';
import {setTeams,setWorldMonth,setSelectedFactionName,setFactionDetailTab,setPersonArchiveRequest} from '../../store/rootSlice';
import FactionDetails from '../../UI/Components/FactionDetails';
import CivilPanel from '../../UI/Components/CivilAdministration/CivilGovernancePanel';
import Civil from '../../Politics/CivilAdministration';
import Military from '../../Politics/MilitaryCommandRegistry';
import {frameAttribution} from '../FrameAttribution';
import {createNaturalCore} from './NaturalCoreHarness';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave,type WorldSaveV1} from '../../Persistence/WorldSaveSchema';
export async function runUnifiedProfilePerformance(seed:string,input:WorldSaveV1){
 const {core,game}=await createNaturalCore(seed),host=document.createElement('div'),root=createRoot(host);host.style.cssText='width:360px;height:760px;overflow:auto';host.dataset.archiveScroll='true';document.body.append(host);
 const checks:string[]=[],rows:any[]=[],commits:number[]=[];const check=(value:unknown,label:string)=>{if(!value)throw Error(label);checks.push(label);};
 try{game.loop.stop();core.setWorldRunning(false);hydrateWorldSave(core,structuredClone(input));
  store.dispatch(setTeams(core.teams));store.dispatch(setWorldMonth({monthIndex:input.world.worldMonth,year:input.world.worldMonth}));
  const terms=Civil.getTerms(),candidates=[terms.find(t=>t.endMonth===undefined),terms.find(t=>t.endReason==='DEATH'),...terms.slice(-5)].filter((t):t is NonNullable<typeof t>=>!!t);
  for(const term of candidates){const start=performance.now();flushSync(()=>root.render(<Provider store={store}><Profiler id="civil" onRender={(_id,_phase,ms)=>commits.push(ms)}><CivilPanel key={term.factionId} factionId={term.factionId} month={input.world.worldMonth} initialPersonId={term.personId}/></Profiler></Provider>));
   const detail=host.querySelector('[data-civil-governor-detail]');check(detail?.textContent?.includes(term.personalName),'civil deep link shows actual identity');check(detail?.querySelector('[data-person-attribute="command"]')&&detail.querySelector('[data-person-attribute="strategy"]'),'civil shares real ability bars');check(host.querySelector(`svg[data-person-id="${term.personId}"]`),'civil shares portrait');if(term.endReason==='DEATH')check(detail?.textContent?.includes('死亡：')&&!detail.textContent?.includes('—今'),'deceased governor has death and ended tenure');
   rows.push({kind:'CIVIL',personId:term.personId,openMs:performance.now()-start,dom:host.querySelectorAll('*').length});
  }
  const person=[...Military.getPeople()].sort((a,b)=>b.appointments.length-a.appointments.length)[0];if(person){const factionId=person.appointments.at(-1)!.factionId,start=performance.now();flushSync(()=>{store.dispatch(setSelectedFactionName(factionId));store.dispatch(setFactionDetailTab('people'));store.dispatch(setPersonArchiveRequest({kind:'MILITARY',factionId,id:person.personId}));root.render(<Provider store={store}><FactionDetails/></Provider>);});await new Promise(r=>setTimeout(r,0));check(host.querySelector('[data-person-attribute="command"]'),'military shares ability bars');rows.push({kind:'MILITARY',personId:person.personId,openMs:performance.now()-start});}
  check(diffCanonicalWorldSave({...input,appVersion:exportWorldSave(core).appVersion},exportWorldSave(core)).matched,'all archive reads preserve complete canonical state and RNG');
  const frames:any[]=[],longTasks:number[]=[];let observer:PerformanceObserver|undefined;try{observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>e.duration)));observer.observe({entryTypes:['longtask']});}catch{}
  for(const panel of [true,false]){if(!panel)flushSync(()=>root.render(null));hydrateWorldSave(core,structuredClone(input));core.setSimulationSpeed(4);core.setWorldRunning(true);game.loop.start(game.loop.callback);await new Promise(r=>setTimeout(r,500));(core as any).runtimePerformance.reset();frameAttribution.reset();const startMonth=core.simulator!.year,start=performance.now(),heapBefore=(performance as any).memory?.usedJSHeapSize;await new Promise(r=>setTimeout(r,5000));game.loop.stop();core.setWorldRunning(false);frames.push({panel,wallMs:performance.now()-start,startMonth,endMonth:core.simulator!.year,configuredSpeed:4,runtime:(core as any).runtimePerformance.snapshot(),attribution:frameAttribution.snapshot(),heapBefore,heapAfter:(performance as any).memory?.usedJSHeapSize});}
  observer?.disconnect();return {seed,month:input.world.worldMonth,checks,rows,react:{commits:commits.length,totalMs:commits.reduce((a,b)=>a+b,0)},frames,longTasks,scope:'Actual native 500-year DTO, React controls and offscreen Electron Phaser frame loop; frame residual includes pacing/render/React/GC and does not identify GPU or GC costs. Not human visual acceptance.'};
 }finally{flushSync(()=>root.unmount());host.remove();game.loop.stop();game.destroy(true);}
}
