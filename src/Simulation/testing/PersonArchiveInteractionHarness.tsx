import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {Provider} from "react-redux";
import {store} from "../../store";
import {setTeams,setWorldYear,setSelectedFactionName,setFactionDetailTab} from "../../store/rootSlice";
import FactionDetails from "../../UI/Components/FactionDetails";
import Dynasty from "../../Politics/Dynasty";
import Military from "../../Politics/MilitaryCommandRegistry";
import {preAccessionMilitary,personServiceLinks} from "../../Politics/PersonServiceLinks";
import History from "../../History/WorldHistory";
import random from "../WorldRandom";
import type Core from "../../Game/Core";
import {exportWorldSave} from "../../Persistence/WorldSaveExporter";

/** Real DOM events and production archive components; no screenshots/visual claims. */
export async function checkPersonArchiveInteraction(core:Core,factionId:string,personId:string,check:(ok:unknown,label:string)=>void){
 const ruler=Dynasty.getCurrentRuler(factionId)!,person=Military.getPerson(personId)!,month=core.simulator!.year;
 const early=preAccessionMilitary(ruler,Military.getPeople(),Military.getFormations(),History.getEvents());
 check(early&&early.entries.length>0&&early.entries.every(e=>e.worldMonth<ruler.accessionYear!),"shared person has real pre-accession military evidence without post-accession credit");
 const host=document.createElement("div");host.style.width="350px";document.body.append(host);const root=createRoot(host);
 const pause=()=>new Promise(r=>setTimeout(r,40));
 const before=exportWorldSave(core),rng=JSON.stringify(random.exportState());
 try{
  flushSync(()=>{store.dispatch(setTeams([...core.teams]));store.dispatch(setWorldYear(month));store.dispatch(setSelectedFactionName(factionId));store.dispatch(setFactionDetailTab("house"));root.render(<Provider store={store}><FactionDetails/></Provider>);});
  const portrait=host.querySelector(`svg[data-person-id="${personId}"]`)!;
  check(portrait,"political archive renders the identical permanent person's portrait");
  const heading=portrait.closest("button")!.nextElementSibling as HTMLButtonElement;
  flushSync(()=>heading.click());await pause();
  check(host.textContent?.includes("早年与登位前经历"),"opening real ruler details mounts verified early military history");
  const earlyLink=Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="查看起事前完整军旅档案")!;
  flushSync(()=>earlyLink.click());await pause();await pause();
  check(store.getState().root.selectedFactionName===ruler.residentIdentity!.sourceFactionId&&store.getState().root.factionDetailTab==="military","stable ID navigation changes country and military tab together");
  const militaryHeading=host.querySelector(`svg[data-person-id="${personId}"]`)!.closest("button")!.nextElementSibling;
  check(militaryHeading?.getAttribute("aria-expanded")==="true"&&host.textContent?.includes("历任所事君主"),"requested historical military person actually expands after one-shot navigation");
  const sourceId=ruler.residentIdentity!.sourceFactionId,source=Dynasty.get(sourceId)!;
  const service=personServiceLinks(sourceId,source.rulers,[person],Military.getFormations(),History.getEvents(),month)[0];
  const served=source.rulers.find(r=>r.id===service.rulerId)!,name=served.houseName.replace(/氏$/,"")+served.givenName;
  const rulerLink=Array.from(host.querySelectorAll("button")).find(b=>b.textContent===name)!;
  check(rulerLink,"military detail exposes a real served monarch link");
  flushSync(()=>rulerLink.click());await pause();
  check(store.getState().root.factionDetailTab==="house"&&host.querySelector('button[aria-expanded="true"]')?.textContent?.includes(name),"reverse navigation opens the historical monarch rather than just the list");
  const avatar=host.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
  flushSync(()=>avatar.click());await pause();
  const dialog=document.querySelector('[role="dialog"][aria-label$="人物摘要"]')!;
  check(dialog?.querySelector('svg[width="112"]')&&!host.querySelector("button button"),"portrait summary enlarges the same SVG without nested buttons");
  flushSync(()=>dialog.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})));
  await new Promise(r=>setTimeout(r,300));check(!document.querySelector('[role="dialog"][aria-label$="人物摘要"]'),"Escape closes the accessible portrait summary");
  check(JSON.stringify(random.exportState())===rng,"archive interaction consumes no world randomness");
 }finally{flushSync(()=>root.unmount());host.remove();}
 const after=exportWorldSave(core);
 for(const key of ["dynasties","registries","users","cities","worldHistory"] as const)check(JSON.stringify(before[key])===JSON.stringify(after[key]),`archive navigation does not rewrite ${key}`);
}
