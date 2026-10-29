import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import MilitaryArchiveWindow from '../../UI/Components/FactionDetails/MilitaryArchiveWindow';
import PersonArchiveCard from '../../UI/Components/FactionDetails/PersonArchiveCard';
export async function runMilitaryArchiveCore(){
 const checks:string[]=[],metrics:any[]=[];const check=(v:unknown,s:string)=>{if(!v)throw Error(s);checks.push(s);},wait=()=>new Promise(r=>setTimeout(r,80));
 for(const count of [100,500,1000]){
  const host=document.createElement('div');host.setAttribute('data-faction-scroll','');host.style.cssText='height:600px;width:440px;overflow:auto;position:absolute;top:0;';document.body.append(host);const root=createRoot(host),ids=Array.from({length:count},(_,i)=>`archive-ui-fixture-${i}`);let setTarget:(id:string)=>void=()=>{};
  function Fixture(){const [target,targetState]=useState<string>(),[expanded,select]=useState<string>();setTarget=targetState;return <MilitaryArchiveWindow ids={ids} targetId={target}>{id=><div style={{height:expanded===id?560:160}}><PersonArchiveCard heading={id} expanded={expanded===id} onSelect={()=>select(expanded===id?undefined:id)}><div>expanded historical record</div></PersonArchiveCard></div>}</MilitaryArchiveWindow>;}
  try{const start=performance.now();flushSync(()=>root.render(<Fixture/>));await wait();const enter=performance.now()-start;
   check(host.querySelectorAll('[data-military-person]').length<=24,`${count}: actual initial DOM is bounded`);
   host.scrollTop=host.scrollHeight;host.dispatchEvent(new Event('scroll'));await wait();check(!!host.querySelector(`[data-military-person="${ids.at(-1)}"]`),`${count}: last historical row accessible by outer sidebar scroll`);
   flushSync(()=>setTarget(ids[55]));await wait();const row=host.querySelector<HTMLElement>(`[data-military-person="${ids[55]}"]`)!;check(!!row,`${count}: direct archive target mounts the exact old person`);
   const rect=row.getBoundingClientRect(),viewport=host.getBoundingClientRect();check(rect.bottom>viewport.top&&rect.top<viewport.bottom,`${count}: target is actually in the viewport`);
   flushSync(()=>row.querySelector<HTMLButtonElement>('button')!.click());await wait();check(row.textContent?.includes('expanded historical record'),`${count}: lazy historical details expand`);flushSync(()=>row.querySelector<HTMLButtonElement>('button')!.click());await wait();check(!row.textContent?.includes('expanded historical record'),`${count}: details unmount when collapsed`);
   check(host.querySelectorAll('[data-military-person]').length<=24,`${count}: variable height and targeting retain the mount bound`);metrics.push({people:count,enterIncluding80msWait:enter,rowsMounted:host.querySelectorAll('[data-military-person]').length,dom:host.querySelectorAll('*').length});
  }finally{flushSync(()=>root.unmount());host.remove();}
 }
 return {checks,metrics,scope:'real React DOM virtual-list scale fixtures, not invented simulation persons; natural-world timings tested separately'};
}

/** Real provisional polity / real appointed commander; never substitute a kingdom for this check. */
export async function checkRebelMilitaryView(core:any,rebel:any,person:any,check:(v:unknown,s:string)=>void){
 const {Provider}=await import('react-redux'),{store}=await import('../../store'),actions=await import('../../store/rootSlice'),{default:FactionDetails}=await import('../../UI/Components/FactionDetails');
 const host=document.createElement('div');host.style.cssText='width:440px;height:800px';document.body.append(host);const root=createRoot(host);
 try{flushSync(()=>{store.dispatch(actions.setTeams([...core.teams]));store.dispatch(actions.setWorldYear(core.simulator.year));store.dispatch(actions.setSelectedFactionName(rebel.name));store.dispatch(actions.setFactionDetailTab('overview'));root.render(<Provider store={store}><FactionDetails/></Provider>);});
  const tab=Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent==='军政人物');check(tab,'actual rebel exposes the military navigation tab');flushSync(()=>tab!.click());
  check(store.getState().root.selectedFactionName===rebel.name&&store.getState().root.factionDetailTab==='military','clicking rebel military retains the exact provisional faction ID');
  check(host.textContent?.includes(person.personalName)&&host.textContent.includes('校尉')&&host.textContent.includes('统兵1人'),'real rebel archive displays its actual one-body colonel and service details');
 }finally{flushSync(()=>root.unmount());host.remove();}
}

export async function checkMilitaryProjectionCache(core:any,saved:any,id:string,check:(v:unknown,s:string)=>void){
 const {default:Military}=await import('../../Politics/MilitaryCommandRegistry'),{default:History}=await import('../../History/WorldHistory'),{default:Dynasty}=await import('../../Politics/Dynasty'),{hydrateWorldSave}=await import('../../Persistence/WorldSaveHydrator'),{default:Projection}=await import('../../UI/Components/FactionDetails/MilitaryDetailProjection');
 core.setWorldRunning(false);hydrateWorldSave(core,structuredClone(saved));let person=Military.getPerson(id)!;Military.endPersonCommands(id,saved.world.worldMonth,'DISMISSED');const retired=(await import('../../Persistence/WorldSaveExporter')).exportWorldSave(core);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),method=Military.getChronicle;let calls=0;Military.getChronicle=function(...args){calls++;return method.apply(this,args);};
 const render=(month:number)=>flushSync(()=>root.render(<Projection person={person} factionId={person.factionId} month={month} events={History.getEvents()} dynasties={Dynasty.getAll()} formations={Military.getFormations()} factions={new Map(core.teams.map((t:any)=>[t.name,t]))}>{v=><div>{v.entries.map(e=>e.text).join('')}</div>}</Projection>));
 try{render(saved.world.worldMonth);const once=calls;render(saved.world.worldMonth+1);check(calls===once,'closed historical projection survives monthly UI refresh without scanning its complete career again');
  hydrateWorldSave(core,structuredClone(retired));person=Military.getPerson(id)!;render(saved.world.worldMonth);check(calls===once+1,'hydration with identical IDs and values still invalidates the old historical cache');
  const g=person.appanageHistory![0],city=core.allCities.find((c:any)=>c.id===g.cityId)!,enemy=core.teams.find((t:any)=>t.name!==g.factionId&&t.status==='ACTIVE')!;const at=saved.world.worldMonth+1;core.simulator.clock.importState({worldMonth:at,elapsedMs:0,running:false});city.capture(enemy,at);Military.updateAppanages(at,core.teams,Dynasty.getAll(),core.allCities);render(at);
  check(calls===once+2&&host.textContent?.includes('食邑失效'),'a real new ownership/appanage fact invalidates the cache and appears immediately in the person’s history');
 }finally{Military.getChronicle=method;flushSync(()=>root.unmount());host.remove();hydrateWorldSave(core,structuredClone(saved));}
}
