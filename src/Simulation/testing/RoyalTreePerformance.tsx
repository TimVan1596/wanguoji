import {Profiler} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import GenealogyBrowser from '../../UI/Components/FactionDetails/GenealogyBrowser';
import Dynasty from '../../Politics/Dynasty';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
/** Actual shared-tree React controls, not screenshots or human acceptance. */
export async function measureRoyalTree(core:any){
 const d=[...Dynasty.getAll()].sort((a,b)=>b.rulers.length-a.rulers.length||a.factionId.localeCompare(b.factionId))[0],team=core.teams.find((t:any)=>t.name===d.factionId),host=document.createElement('div'),root=createRoot(host),commits:number[]=[],rows:any[]=[];document.body.append(host);const base=exportWorldSave(core);
 const wait=()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));
 const measure=async(phase:string,work:()=>void)=>{commits.length=0;const start=performance.now();flushSync(work);const wallMs=performance.now()-start;await wait();rows.push({phase,wallMs,reactMs:commits.reduce((a,b)=>a+b,0),nodes:document.querySelectorAll('[data-genealogy-card]').length,dom:document.querySelector('[role="dialog"]')?.querySelectorAll('*').length??0});};
 try{for(let repeat=0;repeat<3;repeat++){
  await measure('open-'+repeat,()=>root.render(<Provider store={store}><Profiler id="royal-tree" onRender={(_id,_phase,ms)=>commits.push(ms)}><GenealogyBrowser key={repeat} open dynasty={d} team={team} worldMonth={base.world.worldMonth} onClose={()=>root.render(null)}/></Profiler></Provider>));
  await measure('select-'+repeat,()=>document.querySelector<HTMLButtonElement>('[data-genealogy-card]')!.click());
  await measure('zoom-'+repeat,()=>document.querySelector<HTMLButtonElement>('[aria-label="放大宗谱"]')!.click());
  await measure('fit-'+repeat,()=>Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(b=>b.textContent==='适应窗口')!.click());
  await measure('close-'+repeat,()=>root.render(null));
 }if(!diffCanonicalWorldSave(base,exportWorldSave(core)).matched)throw Error('Royal tree controls mutated canonical identity/history/RNG');return {factionId:d.factionId,registeredRoyalPeople:d.rulers.length,rows,unchanged:true};
 }finally{flushSync(()=>root.unmount());host.remove();}
}
