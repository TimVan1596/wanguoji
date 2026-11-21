import {familyDisplayEligible} from '../../Politics/FamilyDisplayEligibility';
import Dynasty from '../../Politics/Dynasty';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Profiler} from 'react';
import {Provider} from 'react-redux';
import {store} from '../../store';
import {setTeams,setWorldMonth,setSelectedFactionName,setFactionDetailTab,setPersonArchiveRequest} from '../../store/rootSlice';
import FactionDetails,{UnifiedPeoplePanel} from '../../UI/Components/FactionDetails';
import Civil from '../../Politics/CivilAdministration';
import Military from '../../Politics/MilitaryCommandRegistry';
import {formatWorldDate} from '../WorldTime';
import {RollingStepPerformance} from '../RollingStepPerformance';
import {frameAttribution} from '../FrameAttribution';
import {createNaturalCore} from './NaturalCoreHarness';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave,type WorldSaveV1} from '../../Persistence/WorldSaveSchema';
export async function runUnifiedProfilePerformance(seed:string,input:WorldSaveV1,expectUnified=true){
 const {core,game}=await createNaturalCore(seed),host=document.createElement('div'),root=createRoot(host);host.style.cssText='width:360px;height:760px;overflow:auto';host.dataset.archiveScroll='true';document.body.append(host);
 const checks:string[]=[],rows:any[]=[],commits:number[]=[];const check=(value:unknown,label:string)=>{if(!value)throw Error(label);checks.push(label);};
 try{game.loop.stop();core.setWorldRunning(false);hydrateWorldSave(core,structuredClone(input));
  store.dispatch(setTeams(core.teams));store.dispatch(setWorldMonth({monthIndex:input.world.worldMonth,year:input.world.worldMonth}));
  const familyDisplay={raw:Military.getFamilies().length,visible:Military.getFamilies().filter(f=>familyDisplayEligible(f,input.world.worldMonth,Military.getPeople(),Dynasty.getAll())).length};
  const terms=Civil.getTerms(),candidates=[terms.find(t=>t.endMonth===undefined),terms.find(t=>t.endReason==='DEATH'),...terms.slice(-5)].filter((t):t is NonNullable<typeof t>=>!!t);
  for(const term of candidates){const start=performance.now();flushSync(()=>root.render(<Provider store={store}><Profiler id="civil" onRender={(_id,_phase,ms)=>commits.push(ms)}><UnifiedPeoplePanel key={term.factionId} factionId={term.factionId} month={input.world.worldMonth} civilTarget={{id:term.personId,serial:term.startMonth}}/></Profiler></Provider>));
   for(let wait=0;wait<100&&!host.querySelector(`[data-person-career-identity="${term.personId}"]`);wait++)await new Promise(r=>setTimeout(r,10));
   const detail=expectUnified?host.querySelector(`[data-unified-person="${term.personId}"]`):host.querySelector('[data-civil-governor-detail]');check(detail?.textContent?.includes(term.personalName),'civil deep link shows actual identity');if(expectUnified){check(detail?.querySelector('[data-person-attribute="command"]')&&detail.querySelector('[data-person-attribute="strategy"]'),'civil shares real ability bars');check(host.querySelector(`svg[data-person-id="${term.personId}"]`),'civil shares portrait');}if(term.endReason==='DEATH')check(detail?.textContent?.includes('卒于'+formatWorldDate(term.endMonth!))&&!detail.textContent?.includes('—今'),'deceased governor has death and ended tenure');
   rows.push({kind:'CIVIL',personId:term.personId,openMs:performance.now()-start,dom:host.querySelectorAll('*').length});
  }
  const person=[...Military.getPeople()].sort((a,b)=>b.appointments.length-a.appointments.length)[0];if(person){const factionId=person.appointments.at(-1)!.factionId,start=performance.now();flushSync(()=>{store.dispatch(setSelectedFactionName(factionId));store.dispatch(setFactionDetailTab('people'));store.dispatch(setPersonArchiveRequest({kind:'MILITARY',factionId,id:person.personId}));root.render(<Provider store={store}><FactionDetails/></Provider>);});for(let wait=0;wait<100&&!host.querySelector('[data-person-career-identity]');wait++)await new Promise(r=>setTimeout(r,10));if(!host.querySelector('[data-person-career-identity]'))throw Error('Military archive did not open: '+JSON.stringify({personId:person.personId,factionId,root:store.getState().root.personArchiveRequest,text:host.textContent?.slice(-1500)}));if(expectUnified)check(host.querySelector('[data-person-attribute="command"]'),'military shares ability bars');rows.push({kind:'MILITARY',personId:person.personId,openMs:performance.now()-start});}
  check(diffCanonicalWorldSave({...input,appVersion:exportWorldSave(core).appVersion},exportWorldSave(core)).matched,'all archive reads preserve complete canonical state and RNG');
  const frames:any[]=[],longTasks:number[]=[],renderTiming=new RollingStepPerformance();let renderStart=0,updateStart=0,clockMismatches=0;const originalUpdate=Military.update;Military.update=function(...args){if(args[0]!==core.simulator!.year)clockMismatches++;return originalUpdate.apply(this,args);};const pre=()=>{updateStart=performance.now();},post=()=>{renderTiming.record('Phaser scene update CPU',performance.now()-updateStart);},preRender=()=>{renderStart=performance.now();},postRender=()=>{renderTiming.record('Phaser canvas render CPU',performance.now()-renderStart);};game.events.on('prestep',pre);game.events.on('poststep',post);game.events.on('prerender',preRender);game.events.on('postrender',postRender);let observer:PerformanceObserver|undefined;try{observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>e.duration)));observer.observe({entryTypes:['longtask']});}catch{}
  try{for(const panel of [true,false]){if(!panel)flushSync(()=>root.render(null));hydrateWorldSave(core,structuredClone(input));core.setSimulationSpeed(4);core.setWorldRunning(true);game.loop.start(game.loop.callback);await new Promise(r=>setTimeout(r,500));(core as any).runtimePerformance.reset();frameAttribution.reset();renderTiming.reset();clockMismatches=0;const startMonth=core.simulator!.year,start=performance.now(),heapBefore=(performance as any).memory?.usedJSHeapSize;await new Promise(r=>setTimeout(r,5000));game.loop.stop();core.setWorldRunning(false);frames.push({panel,wallMs:performance.now()-start,startMonth,endMonth:core.simulator!.year,configuredSpeed:core.simulator!.getSpeed(),effectiveMonthsPerSecond:(core.simulator!.year-startMonth)/((performance.now()-start)/1000),runtime:(core as any).runtimePerformance.snapshot(),attribution:frameAttribution.snapshot(),phaser:renderTiming.snapshot(),clockMismatches,heapBefore,heapAfter:(performance as any).memory?.usedJSHeapSize});}
  }finally{Military.update=originalUpdate;game.events.off('prestep',pre);game.events.off('poststep',post);game.events.off('prerender',preRender);game.events.off('postrender',postRender);observer?.disconnect();}check(clockMismatches===0,'live4x transaction month matches actual clock');return {familyDisplay,seed,expectUnified,month:input.world.worldMonth,checks,rows,react:{commits:commits.length,totalMs:commits.reduce((a,b)=>a+b,0)},frames,longTasks,scope:'Actual native 500-year DTO, React controls and offscreen Electron Phaser frame loop; frame residual includes pacing/render/React/GC and does not identify GPU or GC costs. Not human visual acceptance.'};
 }finally{flushSync(()=>root.unmount());host.remove();game.loop.stop();game.destroy(true);}
}
