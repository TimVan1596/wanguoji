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
