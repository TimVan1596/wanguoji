import {Profiler} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import Military from '../../Politics/MilitaryCommandRegistry';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave,canonicalWorldSaveProjection} from '../../Persistence/WorldSaveSchema';
import {createNaturalCore} from './NaturalCoreHarness';
import MilitaryFamilyBrowser from '../../UI/Components/FactionDetails/MilitaryFamilyBrowser';
import * as Browser from '../../UI/Components/FactionDetails/MilitaryFamilyBrowser';
import * as Reading from '../../UI/Components/FactionDetails/FamilyArchiveSource';
import {associatedMilitaryFamilies,projectFamilyTrunk,layoutFamilyArchive} from '../../UI/Components/FactionDetails/militaryFamilyTree';
const wait=()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));
/** Identical real saved world, actual React controls; never visual acceptance. */
export async function runFamilyPerformance(seed:string,input:ReturnType<typeof exportWorldSave>){
 if(!input)throw Error('A real common Core snapshot is required');
 const {core,game}=await createNaturalCore(seed),host=document.createElement('div'),root=createRoot(host),commits:number[]=[],phases:any[]=[];host.style.cssText='width:1100px;height:760px';document.body.append(host);
 (globalThis as any).__wanguojiFamilyPhases=[];
 const api=Reading as any,modelApi=Browser as any,allTasks:Array<{startTime:number;duration:number}>=[],supported=PerformanceObserver.supportedEntryTypes.includes('longtask'),observer=supported?new PerformanceObserver(rows=>rows.getEntries().forEach(e=>allTasks.push({startTime:e.startTime,duration:e.duration}))):undefined;observer?.observe({type:'longtask'});
 const measure=async(name:string,work:()=>void)=>{commits.length=0;const start=performance.now();flushSync(work);const wallMs=performance.now()-start;await wait();const record={phase:name,wallMs,settledMs:performance.now()-start,reactMs:commits.reduce((n,x)=>n+x,0),mountedNodes:document.querySelectorAll('[data-family-member]').length,dom:document.querySelector('[role="dialog"]')?.querySelectorAll('*').length??0,longTasks:allTasks.filter(e=>e.startTime>=start&&e.startTime<=performance.now()).map(e=>e.duration)};phases.push(record);return record;};
 const dialog=()=>document.querySelector('[role="dialog"]')!,button=(text:string)=>Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent===text)!,openFamily=(name:string)=>Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.includes(`始祖${name}`))!;
 try{
  core.setWorldRunning(false);hydrateWorldSave(core,structuredClone(input));const base=exportWorldSave(core),initialHash=await hash(base),faction=core.teams.map(t=>({id:t.name,families:associatedMilitaryFamilies(Military.getFamilies(),t.name,Military.getPeople())})).sort((a,b)=>b.families.length-a.families.length||a.id.localeCompare(b.id))[0];if(!faction?.families.length)throw Error('No actual family in this predetermined world');
  const familyIds=faction.families.map(f=>f.familyId),ranked=[...faction.families].sort((a,b)=>b.members.length-a.members.length||a.familyId.localeCompare(b.familyId)),chosenId=ranked[0].familyId,secondId=ranked[1]?.familyId;
  const direct:any[]=[];
  for(let repeat=0;repeat<3;repeat++){
   hydrateWorldSave(core,structuredClone(base));api.resetFamilyArchiveReading?.();const families=Military.getFamilies().filter(f=>familyIds.includes(f.familyId)),family=families.find(f=>f.familyId===chosenId)!,month=core.simulator!.year;
   let at=performance.now();for(const f of families)(api.familySummary??api.familyArchive)(f,month);const listSummaryMs=performance.now()-at;hydrateWorldSave(core,structuredClone(base));api.resetFamilyArchiveReading?.();const coldFamily=Military.getFamilies().find(f=>f.familyId===chosenId)!;at=performance.now();const archive=api.familyArchive(coldFamily,month),archiveMs=performance.now()-at;
   at=performance.now();const important=new Set<string>(archive.importantIds),importantMs=performance.now()-at;at=performance.now();const trunk=projectFamilyTrunk(family.members,important),parentBridgeMs=performance.now()-at;at=performance.now();layoutFamilyArchive(trunk,new Set());const layoutMs=performance.now()-at;
   const model=modelApi.prepareFamilyTree?.(coldFamily,month);direct.push({repeat,listSummaryMs,archiveMs,importantMs,parentBridgeMs,layoutMs,cardModel:model?.timing,retainedNodes:trunk.members.length,registeredNodes:family.members.length,cache:api.familyArchiveReadingDiagnostics?.()});
   hydrateWorldSave(core,structuredClone(base));api.resetFamilyArchiveReading?.();const visibleFamilies=Military.getFamilies().filter(f=>familyIds.includes(f.familyId)),name=visibleFamilies.find(f=>f.familyId===chosenId)!.members[0].name;
   const render=()=>root.render(<Provider store={store}><Profiler id="family" onRender={(_id,_phase,ms)=>commits.push(ms)}><MilitaryFamilyBrowser families={visibleFamilies} worldMonth={month} onClose={()=>root.render(null)}/></Profiler></Provider>);
   await measure(`list-open-${repeat}`,render);await measure(`all-houses-${repeat}`,()=>button('全部世家').click());await measure(`family-open-${repeat}`,()=>openFamily(name).click());
   const founder=dialog().querySelector<HTMLButtonElement>('[data-genealogy-card]')!;await measure(`select-person-${repeat}`,()=>founder.click());await measure(`zoom-${repeat}`,()=>dialog().querySelector<HTMLButtonElement>('[aria-label="放大宗谱"]')!.click());await measure(`fit-${repeat}`,()=>button('适应窗口').click());await measure(`locate-founder-${repeat}`,()=>button('定位始祖').click());
   await measure(`return-${repeat}`,()=>button('返回').click());if(button('全部世家'))await measure(`all-after-return-${repeat}`,()=>button('全部世家').click());
   if(secondId){const next=visibleFamilies.find(f=>f.familyId===secondId)!;await measure(`switch-family-${repeat}`,()=>openFamily(next.members[0].name).click());}
   await measure(`close-${repeat}`,()=>root.render(null));await measure(`reopen-${repeat}`,render);await measure(`close-again-${repeat}`,()=>root.render(null));
   if(!diffCanonicalWorldSave(base,exportWorldSave(core)).matched)throw Error('Family UI changed canonical world, population, history or RNG');
  }
  const after=exportWorldSave(core);return {seed,worldMonth:base.world.worldMonth,viewport:{width:innerWidth,height:innerHeight},families:Military.getFamilies().length,associatedFamilies:familyIds.length,members:Military.getFamilies().reduce((n,f)=>n+f.members.length,0),maxFamilyMembers:Math.max(...Military.getFamilies().map(f=>f.members.length)),events:(base.worldHistory.events as unknown[]).length,people:Military.getPeople().length,direct,phases,legacyModelPhases:(globalThis as any).__wanguojiFamilyPhases,longTasksSupported:supported,allLongTasks:allTasks,heapBytes:(performance as any).memory?.usedJSHeapSize,cache:api.familyArchiveReadingDiagnostics?.(),beforeHash:initialHash,afterHash:await hash(after),unchanged:diffCanonicalWorldSave(base,after).matched,scope:'Three repetitions on the same real hydrated saved world; actual React commits, DOM budget and controls. Isolated API timings overlap and are not summed. No screenshot or human visual Gate.'};
 }finally{observer?.disconnect();flushSync(()=>root.unmount());host.remove();game.destroy(true);}
}
async function hash(save:ReturnType<typeof exportWorldSave>){const canonical:any=canonicalWorldSaveProjection(save);delete canonical.appVersion;const ordered=(v:any):any=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(ordered(canonical))));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}
