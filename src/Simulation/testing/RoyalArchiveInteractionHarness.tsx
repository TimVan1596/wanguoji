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
  const card=host.querySelector(`[data-royal-military-person="${personId}"]`);
  check(card?.textContent?.includes("宗室军旅"),"royal page shows the actual unenthroned serving person");
  flushSync(()=>(card!.querySelector("button") as HTMLButtonElement).click());await pause();await pause();
  check(store.getState().root.factionDetailTab==="military"&&host.textContent?.includes("宗室身份：")&&host.textContent.includes("之子"),"royal-to-military navigation opens the same real identity and recorded parentage");
  const reverse=Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="查看王室与亲属宗谱")!;
  check(reverse,"military page provides the matching royal archive link");
  flushSync(()=>reverse.click());await pause();
  check(store.getState().root.factionDetailTab==="house"&&host.querySelector(`[data-royal-military-person="${personId}"]`),"reverse navigation finds the unenthroned royal without inventing a reign");
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
