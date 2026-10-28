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
