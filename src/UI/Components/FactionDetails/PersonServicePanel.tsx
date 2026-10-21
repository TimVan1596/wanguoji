import Game from "../../../Game/Game";
import {getFactionDisplayNameAtMonth} from "../../../Simulation/FactionIdentity";
import {Box,Typography} from "@mui/material";
import type {Ruler} from "../../../Politics/Dynasty";
import Dynasty from "../../../Politics/Dynasty";
import Military from "../../../Politics/MilitaryCommandRegistry";
import {personServiceLinks,preAccessionMilitary} from "../../../Politics/PersonServiceLinks";
import {MILITARY_OFFICE_NAMES} from "../../../Politics/MilitaryOffice";
import History from "../../../History/WorldHistory";
import {formatWorldDate} from "../../../Simulation/WorldTime";
import {ChronicleSection} from "./PersonChronicleLayout";
import {usePersonArchiveNavigation} from "./PersonArchiveNavigation";
import {getMilitaryPersonDisplayName} from "../../../Politics/MilitaryPersonIdentity";

const countryAt=(id:string,month:number)=>{const t=Game.Core?.teams.find(t=>t.name===id);return t?getFactionDisplayNameAtMonth(t,month):id;};
const style={border:0,padding:0,background:"none",color:"inherit",font:"inherit",textDecoration:"underline",cursor:"pointer"} as const;
export function RulerServicePanel({ruler,factionId,month}:{ruler:Ruler;factionId:string;month:number}){
 const nav=usePersonArchiveNavigation(),people=Military.getPeople(),events=History.getEvents();
 const earlier=preAccessionMilitary(ruler,people,Military.getFormations(),events);
 const rows=personServiceLinks(factionId,[ruler],people,Military.getFormations(),events,month);
 return <>
  {earlier&&<ChronicleSection title="早年与登位前经历">
   {earlier.representative.map(e=><Typography key={e.eventId} fontSize="0.82rem">{formatWorldDate(e.worldMonth)} · {countryAt(e.factionId,e.worldMonth)} · {e.text}</Typography>)}
   <button type="button" style={style} onClick={()=>nav.open({kind:"MILITARY",factionId:ruler.residentIdentity!.sourceFactionId,id:earlier.person.personId})}>查看起事前完整军旅档案</button>
  </ChronicleSection>}
  {rows.length>0&&<ChronicleSection title="任内军政人物"><Typography fontSize="0.74rem">以下为任期交集，不等于君主亲自任命。</Typography>
   <ServiceRows rows={rows} label={id=>getMilitaryPersonDisplayName(people.find(p=>p.personId===id)!)} onOpen={id=>nav.open({kind:"MILITARY",factionId,id})}/>
  </ChronicleSection>}
 </>;
}
export function MilitaryServicePanel({personId,month}:{personId:string;month:number}){
 const nav=usePersonArchiveNavigation(),person=Military.getPerson(personId);if(!person)return null;
 const rows=Dynasty.getAll().filter(d=>person.appointments.some(a=>a.factionId===d.factionId)).flatMap(d=>personServiceLinks(d.factionId,d.rulers,[person],Military.getFormations(),History.getEvents(),month));
 return rows.length>0?<ChronicleSection title="历任所事君主"><Typography fontSize="0.74rem">按真实任职与在位交集排列；仅有原始授职事件时注明本人授职。</Typography>
  <ServiceRows rows={rows} ruler label={id=>{const r=Dynasty.getAll().flatMap(d=>d.rulers).find(r=>r.id===id)!;return r.houseName.replace(/氏$/,"")+r.givenName;}} onOpen={(id,factionId)=>nav.open({kind:"RULER",id,factionId})}/>
 </ChronicleSection>:null;
}
function ServiceRows({rows,label,onOpen,ruler=false}:{rows:ReturnType<typeof personServiceLinks>;label:(id:string)=>string;onOpen:(id:string,faction:string)=>void;ruler?:boolean}){
 const render=(xs:typeof rows)=>xs.map((r,i)=><Box key={`${r.personId}:${r.rulerId}:${r.startMonth}:${i}`} sx={{fontSize:"0.8rem",mt:.4,overflowWrap:"anywhere"}}>
  <button type="button" style={style} onClick={()=>onOpen(ruler?r.rulerId:r.personId,r.factionId)}>{label(ruler?r.rulerId:r.personId)}</button> · {countryAt(r.factionId,r.startMonth)} · {formatWorldDate(r.startMonth)}—{formatWorldDate(r.endMonth)} · {r.offices.map(o=>MILITARY_OFFICE_NAMES[o]).join("／")||"军职未载"} · 核验战果{r.victoryEventIds.length}次{r.personalGrantEventIds.length?" · 有本人授职原事件":""}
 </Box>);
 return <>{render(rows.slice(0,5))}{rows.length>5&&<details><summary>查看其余{rows.length-5}项任职交集</summary>{render(rows.slice(5))}</details>}</>;
}
