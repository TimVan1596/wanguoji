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
 check(early&&early.entries.length>0&&early.entries.every(e=>e.worldMonth<ruler.accessionYear!||e.worldMonth===ruler.accessionYear&&e.source.startsWith("empire-split")&&!e.victory),"shared person has verified early career plus its non-victory founding boundary, without post-accession battle credit");
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
  check(!host.querySelector('[data-royal-evidence]'),'closed royal details construct no complete evidence document');
  const detail=Array.from(host.querySelectorAll('summary')).find(s=>s.textContent==='详细记录')!;flushSync(()=>detail.click());
  for(let i=0;i<40&&!host.querySelector('[data-royal-evidence]');i++)await pause();
  check(host.querySelector('[data-royal-evidence]')&&!host.querySelector('[data-royal-source-event]'),'opening evidence does not eagerly mount nested raw event archives');
  const raw=Array.from(host.querySelectorAll('[data-royal-evidence] summary')).find(s=>s.textContent?.startsWith('任期国家原始事件')) as HTMLElement;flushSync(()=>raw.click());await pause();
  check(host.querySelector('[data-royal-source-event]'),'explicitly opening the complete source archive exposes its original event IDs');
  flushSync(()=>detail.click());await pause();check(!host.querySelector('[data-royal-evidence]'),'closing evidence releases all raw records while keeping the public biography');
  const earlyLink=Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="查看登位前完整军旅档案")!;
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
