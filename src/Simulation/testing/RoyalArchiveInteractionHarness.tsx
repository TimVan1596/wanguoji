import {formatWorldDate} from "../WorldTime";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {Provider} from "react-redux";
import {store} from "../../store";
import {setTeams,setWorldYear,setSelectedFactionName,setFactionDetailTab} from "../../store/rootSlice";
import FactionDetails from "../../UI/Components/FactionDetails";
import type Core from "../../Game/Core";
import {exportWorldSave} from "../../Persistence/WorldSaveExporter";
import random from "../WorldRandom";

/** Actual DOM navigation only. Visual acceptance remains the user's Chrome Gate. */
export async function checkRoyalArchiveInteraction(core:Core,factionId:string,personId:string,check:(ok:unknown,label:string)=>void){
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
 const pause=()=>new Promise(r=>setTimeout(r,50));
 const before=exportWorldSave(core),rng=JSON.stringify(random.exportState());
 try{
  flushSync(()=>{store.dispatch(setTeams([...core.teams]));store.dispatch(setWorldYear(core.simulator!.year));store.dispatch(setSelectedFactionName(factionId));store.dispatch(setFactionDetailTab("house"));root.render(<Provider store={store}><FactionDetails/></Provider>);});
  const summary=host.querySelector<HTMLButtonElement>('[data-royal-military-roster] button[aria-expanded]')!;
  check(summary&&summary.getAttribute('aria-expanded')==='false'&&!host.querySelector('[data-royal-military-roster] [data-royal-military-person]'),'royal military defaults to exactly the collapsed summary without person shortcuts');
  flushSync(()=>summary.click());await pause();
  check(summary.getAttribute('aria-expanded')==='true'&&host.querySelector('[data-royal-military-roster] [role="list"]'),'one summary click exposes the real roster without pagination or an inner scroller');
  flushSync(()=>summary.click());check(!host.querySelector('[data-royal-military-roster] [role="list"]'),'second summary click unmounts all roster rows');
  flushSync(()=>summary.click());await pause();
  const card=host.querySelector(`[data-royal-military-person="${personId}"]`);
  check(card&&host.textContent?.includes("宗室军旅：累计"),"royal summary retains a direct archive entry for the serving person");
  flushSync(()=>(card!.querySelector("button") as HTMLButtonElement).click());await pause();await pause();
  check(store.getState().root.factionDetailTab==="military"&&host.textContent?.includes("宗室身份：")&&host.textContent.includes("之子"),"royal-to-military navigation opens the same real identity and recorded parentage");
  const reverse=Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="查看王室与亲属宗谱")!;
  check(reverse,"military page provides the matching royal archive link");
  const badge=Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="宗室将领")!;check(badge,"real royal badge is an actionable genealogy entry");
  const {default:MilitaryBefore}=await import("../../Politics/MilitaryCommandRegistry");
  const birthday="出生："+formatWorldDate(MilitaryBefore.getPerson(personId)!.bornMonth);
  check(host.textContent?.includes(birthday),"military identity shows the actual canonical birth month");
  flushSync(()=>badge.click());await pause();
  const {default:Military}=await import("../../Politics/MilitaryCommandRegistry");
  const royalId=Military.getPerson(personId)!.royalIdentity!.rulerId;
  const focus=Array.from(document.querySelectorAll('[data-ruler-id]')).find(n=>n.getAttribute("data-ruler-id")===royalId);
  check(store.getState().root.factionDetailTab==="house"&&focus,"reverse navigation focuses the actual unenthroned royal in genealogy");
  flushSync(()=>(focus!.querySelector("[data-genealogy-card]") as HTMLButtonElement).click());
  check(document.querySelector("[data-genealogy-person]")?.textContent?.includes(birthday),"genealogy and military birth months agree after direct navigation");
  check(focus?.querySelector('[data-genealogy-theme="neutral"]'),"military-only royal remains neutral in actual tree");
  const close=Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="关闭")!;flushSync(()=>close.click());await pause();
 }finally{flushSync(()=>root.unmount());host.remove();}
 const after=exportWorldSave(core);
 check(JSON.stringify(random.exportState())===rng&&["dynasties","registries","users","worldHistory"].every(k=>JSON.stringify((before as any)[k])===JSON.stringify((after as any)[k])),"royal archive reading changes no identity, history, command or random state");
}

/** Real React/MUI/Redux interaction; no map or visual claims. */
export async function checkHistoryFactionNavigation(core:Core,check:(ok:unknown,label:string)=>void){
 const {HistoryFactionNavigation,MentionContext}=await import("../../UI/Components/HistoryScroll/HistoryFactionNavigation");
 const {EventText}=await import("../../UI/Components/HistoryScroll/HistoryEventDetails");
 const {historyFactionMentions}=await import("../../History/HistoryFactionMentions");
 const target=core.teams[0],id=target.name,alias="历史旧国号",view=new Map([[id,{...target,displayName:alias,nameHistory:[{name:alias,startMonth:0}]} as typeof target]]);
 const event:any={id:"link-test",year:0,type:"faction-extinct",targetFactionId:id};
 const ids=historyFactionMentions(event,view,[]),textTeams=new Map([[alias,view.get(id)!]]);
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host),before=JSON.stringify(exportWorldSave(core));
 let toggles=0,renders=0;const Sibling=()=>{renders++;return null;};
 try{
  flushSync(()=>root.render(<Provider store={store}><HistoryFactionNavigation factions={view}><Sibling/><MentionContext.Provider value={{ids,protectedNames:["历史旧国号使者"]}}><div onClick={()=>toggles++}><EventText text={`${alias}灭亡；历史旧国号使者`} teamByName={textTeams} factionNames={[alias]} cityNames={[]}/></div></MentionContext.Provider></HistoryFactionNavigation></Provider>));
  check(host.querySelectorAll("button").length===1&&host.querySelector("button")?.tabIndex===0,"only unambiguous faction phrase is a keyboard-focusable button; person substring stays plain");
  for(const [label,tab]of [["势力概览","overview"],["王室","house"],["军政人物","military"]]){
   const count=renders;flushSync(()=>host.querySelector("button")!.click());await new Promise(r=>setTimeout(r,30));
   check(toggles===0&&renders===count,"opening one shared faction menu preserves card expansion and sibling render boundary");
   const item=Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(e=>e.textContent===label)!;
   check(!!item,`history faction menu offers ${label}`);flushSync(()=>item.click());
   check(store.getState().root.selectedFactionName===id&&store.getState().root.factionDetailTab===tab&&store.getState().root.rightPanelTab==="faction",`history ${alias} routes by original faction ID to ${tab}`);
  }
  check(JSON.stringify(exportWorldSave(core))===before,"history navigation does not alter canonical world or RNG");
 }finally{flushSync(()=>root.unmount());host.remove();}
}

/** Size fixtures exercise the real renderer; they do not simulate history. */
export async function checkGenealogyRendering(core:Core,check:(ok:unknown,label:string)=>void){
 const {default:Browser}=await import("../../UI/Components/FactionDetails/GenealogyBrowser");
 const before=JSON.stringify(exportWorldSave(core)),samples:any[]=[];
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
 try{
  {
   const rulers:any[]=Array.from({length:20},(_,i)=>({id:"trunk-"+i,houseName:"测氏",givenName:"宗"+i,bornYear:i-1000,status:i===19?"ruling":"dead",deathMonth:i===19?undefined:i+1,reignOrdinal:i+1,accessionYear:i,parentId:i?"trunk-"+(i-1):undefined}));
   rulers.push(...["side-a","side-b"].map(id=>({id,houseName:"测氏",givenName:id,bornYear:-500,status:"kin",parentId:"trunk-0"})));
   let closeSource="";
   const dynasty:any={factionId:"simple-tree",rulers,heirIds:["side-a","side-b"],currentRulerId:"trunk-19"},team:any={...core.teams[0],name:"simple-tree"};
   flushSync(()=>root.render(<Provider store={store}><Browser open onClose={source=>{closeSource=source;}} dynasty={dynasty} team={team} worldMonth={100}/></Provider>));await new Promise(r=>setTimeout(r,20));
   check(document.querySelector('[data-ruler-id="trunk-0"]')&&!document.querySelector('[data-genealogy-person]'),"default tree opens at founder without a large selected-person panel");
   const toggle=()=>Array.from(document.querySelectorAll("button")).find(b=>b.textContent?.includes("旁系"))!;
   check(!document.querySelector('[data-ruler-id="side-a"]'),"ordinary collateral is folded beside the continuous royal trunk");
   flushSync(()=>toggle().click());check(document.querySelector('[data-ruler-id="side-a"]')&&document.querySelector('path[data-child-id="side-a"]'),"expanding collateral mounts its true connected siblings");
   flushSync(()=>toggle().click());check(!document.querySelector('[data-ruler-id="side-a"]')&&!document.querySelector('path[data-child-id="side-a"]'),"folding collateral removes its cards and connectors together");
   const viewport=document.querySelector<HTMLElement>('.MuiDialogContent-root')!,seen=new Set<string>();
   for(let y=0;y<=viewport.scrollHeight;y+=Math.max(100,viewport.clientHeight-100)){
    viewport.scrollTo({top:y});await new Promise(r=>setTimeout(r,20));flushSync(()=>viewport.dispatchEvent(new Event("scroll")));
    for(const n of Array.from(document.querySelectorAll('[data-ruler-id]')))seen.add(n.getAttribute("data-ruler-id")!);
   }
   check(rulers.slice(0,20).every(r=>seen.has(r.id)),"all twenty monarch generations remain naturally reachable by scrolling without branch buttons: "+JSON.stringify({missing:rulers.slice(0,20).filter(r=>!seen.has(r.id)).map(r=>r.id),height:viewport.clientHeight,scrollHeight:viewport.scrollHeight,scrollTop:viewport.scrollTop,seen:[...seen]}));
   const fit=Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="适应窗口")!;flushSync(()=>fit.click());check(viewport.scrollTop===0,"fit control returns to the tree origin even at unchanged scale");
   const plus=Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="＋")!;flushSync(()=>plus.click());
   let connected=0;for(const edge of Array.from(document.querySelectorAll('path[data-parent-id]'))){
    const parent=document.querySelector(`[data-ruler-id="${edge.getAttribute('data-parent-id')}"] [data-genealogy-card]`),child=document.querySelector(`[data-ruler-id="${edge.getAttribute('data-child-id')}"] [data-genealogy-card]`);if(!parent||!child)continue;
    const bounds=parent.getBoundingClientRect(),ratio=bounds.width/160,tree=document.querySelector('[role="tree"]')!.getBoundingClientRect();
    check(Math.abs(tree.top+Number(edge.getAttribute("data-y1"))*ratio-bounds.bottom)<1&&Math.abs(tree.top+Number(edge.getAttribute("data-y2"))*ratio-child.getBoundingClientRect().top)<1,"zoom preserves exact card and connector geometry");connected++;
   }check(connected>0,"zoom check examines actual mounted parent-child connectors");
   document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));check(closeSource==="ESCAPE","ESC reaches the existing close action");
   flushSync(()=>root.render(<></>));await new Promise(r=>setTimeout(r,10));
  }
  // Display-only size fixtures reuse a real verified person's presentation data;
  // no fixture is inserted into a simulation registry or asserted as historical fact.
  const [{RoyalMilitaryList},{default:MilitaryRoster}]=await Promise.all([import('../../UI/Components/FactionDetails/RoyalMilitaryPanel'),import('../../Politics/MilitaryCommandRegistry')]);
  const source=MilitaryRoster.getPeople().find(p=>p.royalIdentity)!;
  check(source,'roster rendering benchmark starts from an actual military royal');
  for(const size of [150,1000,10000]){
   const rows:Array<[string,typeof source]>=Array.from({length:size},(_,i)=>['display-'+i,{...source,personId:'display-'+i}]);
   const start=performance.now();
   flushSync(()=>root.render(<Provider store={store}><div data-main-sidebar style={{height:300,overflowY:'auto'}}><RoyalMilitaryList rows={rows} rulers={[]} month={core.simulator!.year} factionId={source.royalIdentity!.factionId}/></div></Provider>));
   await new Promise(r=>setTimeout(r,30));const sidebar=host.querySelector<HTMLElement>('[data-main-sidebar]')!,list=sidebar.querySelector<HTMLElement>('[role="list"]')!;
   check(sidebar.querySelectorAll('[role="listitem"]').length<=80&&getComputedStyle(list).overflowY!=='auto'&&getComputedStyle(list).overflowY!=='scroll',size+': real roster renderer uses bounded rows and only the main sidebar scroll');
   sidebar.scrollTop=sidebar.scrollHeight;sidebar.dispatchEvent(new Event('scroll'));
   // Scroll virtualization settles on requestAnimationFrame; wait for its actual
   // DOM result instead of assuming a heavily loaded test machine renders in 50ms.
   for(let frame=0;frame<40&&!sidebar.querySelector(`[data-royal-military-person="display-${size-1}"]`);frame++)await new Promise(r=>setTimeout(r,25));
   check(sidebar.querySelector(`[data-royal-military-person="display-${size-1}"]`),size+': main sidebar scrolling reaches the last real-renderer row without paging');
   samples.push({size,shape:'military-roster',mountedNodes:sidebar.querySelectorAll('[role="listitem"]').length,mountAndScrollMs:performance.now()-start});
   flushSync(()=>root.render(<></>));
  }
  for(const size of [150,1000,10000])for(const shape of ["deep","wide"]){
   const rulers=Array.from({length:size},(_,i)=>({id:"bench-"+i,houseName:"测氏",givenName:"宗"+i,bornYear:i-10000,naturalDeathYear:20000,status:"dead",deathMonth:i+100,deathReason:"去世",accessionYear:i,reignOrdinal:i+1,parentId:i?"bench-"+(shape==="deep"?i-1:0):undefined}));
   const dynasty:any={factionId:"render-bench",houseName:"测氏",rulers,heirIds:[],currentRulerId:"bench-"+(size-1)};
   const team:any={...core.teams[0],name:"render-bench",status:"EXTINCT"},target=shape==="wide"?"bench-0":"bench-"+(size-1);
   const heapBefore=(performance as any).memory?.usedJSHeapSize,start=performance.now();
   flushSync(()=>root.render(<Provider store={store}><Browser key={size+shape} open onClose={()=>{}} dynasty={dynasty} team={team} worldMonth={20000} targetId={target}/></Provider>));await new Promise(r=>setTimeout(r,20));
   check(!document.querySelector('[role="dialog"] input')&&!document.querySelector('[role="dialog"]')?.textContent?.includes('查找人物')&&!document.querySelector('[role="dialog"]')?.textContent?.includes("查看此支")&&!document.querySelector('[role="dialog"]')?.textContent?.includes("浏览全部人物"),"default tree is simple, with secondary search closed");
   const rows=document.querySelectorAll('[role="treeitem"]'),elapsed=performance.now()-start;
   check(rows.length<=150&&rows.length>0,size+" "+shape+": actual React tree mounts bounded nodes");
   check(Array.from(rows).some(r=>r.getAttribute("data-ruler-id")===target),size+" "+shape+": requested permanent ID is mounted");
   for(const edge of Array.from(document.querySelectorAll('path[data-parent-id]'))){
    const parent=document.querySelector<HTMLElement>(`[data-ruler-id="${edge.getAttribute('data-parent-id')}"]`)!,child=document.querySelector<HTMLElement>(`[data-ruler-id="${edge.getAttribute('data-child-id')}"]`)!;
    if(!parent||!child)continue;
    const p=parent.querySelector("[data-genealogy-card]")!.getBoundingClientRect(),c=child.querySelector("[data-genealogy-card]")!.getBoundingClientRect(),tree=document.querySelector('[role="tree"]')!.getBoundingClientRect();
    check(Math.abs(tree.top+Number(edge.getAttribute("data-y1"))-p.bottom)<1&&Math.abs(tree.top+Number(edge.getAttribute("data-y2"))-c.top)<1,size+" "+shape+": line touches actual card boundaries");
    check(parent.getBoundingClientRect().top<child.getBoundingClientRect().top,size+" "+shape+": real parent DOM is above child");
   }
   const siblingGroups=new Map<string,HTMLElement[]>();for(const edge of Array.from(document.querySelectorAll('path[data-parent-id]'))){const id=edge.getAttribute('data-parent-id')!,child=document.querySelector<HTMLElement>(`[data-ruler-id="${edge.getAttribute('data-child-id')}"]`)!;if(child)siblingGroups.set(id,[...(siblingGroups.get(id)??[]),child]);}
   for(const siblings of siblingGroups.values())if(siblings.length>1){const a=siblings[0].getBoundingClientRect(),b=siblings[1].getBoundingClientRect();check(a.top===b.top&&a.left!==b.left,size+" "+shape+": actual sibling DOM shares a horizontal generation");}
   const focused=document.querySelector<HTMLElement>('[data-genealogy-focused="true"]')!,visible=focused.closest('.MuiDialogContent-root')!.getBoundingClientRect(),rect=focused.getBoundingClientRect();
   check(rect.bottom>visible.top&&rect.top<visible.bottom&&rect.right>visible.left&&rect.left<visible.right,size+" "+shape+": focused real node is inside the visible viewport");
   check(document.querySelector('[role="tree"]')!.getBoundingClientRect().width<=2000,size+" "+shape+": bounded tree canvas width");
   const locate=Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="定位当今君主")!;flushSync(()=>locate.click());
   check(Array.from(document.querySelectorAll('[data-ruler-id]')).some(r=>r.getAttribute("data-ruler-id")==="bench-"+(size-1)),size+" "+shape+": current-ruler control locates tail");
   samples.push({size,shape,mountedNodes:rows.length,mountMs:elapsed,heapDelta:(performance as any).memory?.usedJSHeapSize-heapBefore});
   if(elapsed>3000)throw Error("Genealogy render exceeded 3000ms: "+size+"/"+shape+"/"+elapsed);
   flushSync(()=>root.render(<></>));await new Promise(r=>setTimeout(r,10));
   check(!document.querySelector('[role="treeitem"]'),size+" "+shape+": closing removes genealogy nodes");
  }
 }finally{flushSync(()=>root.unmount());host.remove();}
 check(JSON.stringify(exportWorldSave(core))===before,"large genealogy rendering consumes no RNG, population or canonical state");return samples;
}

export async function checkRoyalGenealogyRecord(core:Core,factionId:string,personId:string,check:(ok:unknown,label:string)=>void){
 const [{default:Browser},{default:Dynasty},{default:Military}]=await Promise.all([import("../../UI/Components/FactionDetails/GenealogyBrowser"),import("../../Politics/Dynasty"),import("../../Politics/MilitaryCommandRegistry")]);
 const d=Dynasty.get(factionId)!,p=Military.getPerson(personId)!,r=d.rulers.find(r=>r.id===p.royalIdentity!.rulerId)!;
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
 try{
  flushSync(()=>root.render(<Provider store={store}><Browser open onClose={()=>{}} dynasty={d} team={core.teams.find(t=>t.name===factionId)!} worldMonth={core.simulator!.year}/></Provider>));
  await new Promise(resolve=>setTimeout(resolve,20));
  check(document.querySelector(`[data-ruler-id="${r.id}"]`),p.status+': verified military royal is visible by default without target navigation');
  if(r.parentId)check(document.querySelector(`path[data-child-id="${r.id}"][data-parent-id="${r.parentId}"]`),'default military collateral keeps the true parent connector');
  const nodes=Array.from(document.querySelectorAll('[data-ruler-id]')).filter(n=>n.getAttribute("data-ruler-id")===r.id);
  check(nodes.length===1,p.status+": actual genealogy retains one permanent royal node");
  flushSync(()=>(nodes[0].querySelector("[data-genealogy-card]") as HTMLButtonElement).click());
  check(document.querySelector('[data-genealogy-person]')?.textContent?.includes("出生："+formatWorldDate(p.bornMonth)),p.status+": genealogy retains original birth month");
  if(p.deathMonth!==undefined)check(document.querySelector('[data-genealogy-person]')?.textContent?.includes("死亡："+formatWorldDate(p.deathMonth)),"actual deceased royal genealogy shows the one death month");
  if(r.reignOrdinal!==undefined)check(!nodes[0].querySelector('[data-genealogy-theme="neutral"]'),"actual ascended royal uses a monarch theme on the one node");
 }finally{flushSync(()=>root.unmount());host.remove();}
}

export async function checkMilitaryAccessionNavigation(core:Core,factionId:string,personId:string,check:(ok:unknown,label:string)=>void){
 const [{default:Military},{default:Dynasty},{default:History},{militaryPoliticalLife}]=await Promise.all([import('../../Politics/MilitaryCommandRegistry'),import('../../Politics/Dynasty'),import('../../History/WorldHistory'),import('../../Politics/MilitaryPoliticalLife')]);
 const p=Military.getPerson(personId)!,fact=militaryPoliticalLife(p,Dynasty.getAll(),History.getEvents(),new Map(core.teams.map(t=>[t.name,t])),core.simulator!.year)!;
 check(fact&&fact.rulerId===p.politicalRulerId,'actual accession transaction resolves the one permanent military/royal identity');
 const before=JSON.stringify(exportWorldSave(core)),host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  flushSync(()=>{store.dispatch(setTeams([...core.teams]));store.dispatch(setWorldYear(core.simulator!.year));store.dispatch(setSelectedFactionName(factionId));store.dispatch(setFactionDetailTab('military'));root.render(<Provider store={store}><FactionDetails/></Provider>);});
  const heading=Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')).find(b=>b.textContent?.includes(p.personalName!))!;check(heading,'former general is present in the real military list');if(heading.getAttribute('aria-expanded')!=='true')flushSync(()=>heading.click());
  check(host.textContent?.includes(fact.entry.text)&&host.textContent.includes(formatWorldDate(fact.entry.worldMonth)),'military archive shows the actual accession month and historical polity title');
  const link=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='查看对应王室本纪')!;check(link,'accession fact links to the real royal chronicle');flushSync(()=>link.click());await new Promise(r=>setTimeout(r,30));
  check(store.getState().root.selectedFactionName===fact.factionId&&store.getState().root.factionDetailTab==='house','accession archive link opens the correct historical faction and royal tab');
 }finally{flushSync(()=>root.unmount());host.remove();}
 check(JSON.stringify(exportWorldSave(core))===before,'political life display and navigation consume no RNG or canonical state');
}
