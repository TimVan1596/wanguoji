import {NobleHistory} from "./MeritRoll";
import {useLayoutEffect,useRef,useState} from "react";
import {royalMilitaryArchive,royalMilitaryOfficeLabel} from "../../../Politics/RoyalArchiveIdentity";
import PersonLifeDates from "./PersonLifeDates";
import {formatRecordedKinship} from "../../../Politics/DynasticCandidateRules";
import {Box,Typography} from "@mui/material";
import Dynasty,{type Ruler} from "../../../Politics/Dynasty";
import Military from "../../../Politics/MilitaryCommandRegistry";
import History from "../../../History/WorldHistory";
import {deriveMilitaryCareer} from "../../../Politics/MilitaryCareerEvidence";
import {MILITARY_OFFICE_NAMES} from "../../../Politics/MilitaryOffice";
import {formatWorldDate} from "../../../Simulation/WorldTime";
import {usePersonArchiveNavigation} from "./PersonArchiveNavigation";

const buttonStyle={border:0,padding:0,background:"none",font:"inherit",color:"inherit",textDecoration:"underline",cursor:"pointer"} as const;
export function RoyalMilitaryPanel({ruler,month,onGenealogy}:{ruler:Ruler;month:number;onGenealogy?:()=>void}){
 const nav=usePersonArchiveNavigation(),i=ruler.militaryIdentity,p=i&&Military.getPerson(i.personId);
 if(!p||p.royalIdentity?.rulerId!==ruler.id)return null;
 const d=Dynasty.get(p.royalIdentity.factionId),current=d?.rulers.find(r=>r.id===d.currentRulerId),parent=d?.rulers.find(r=>r.id===ruler.parentId);
 const appointments=p.appointments.filter(a=>a.factionId===p.royalIdentity!.factionId),career=deriveMilitaryCareer(p,Military.getFormations(),History.getEvents(),month);
 const rank={XIAOWEI:0,PIJIANG:1,JIANGJUN:2,SHANGJIANGJUN:3};
 const highest=appointments.flatMap(a=>a.officeHistory??[]).sort((a,b)=>rank[b.office]-rank[a.office])[0];
 return <Box sx={{fontSize:"0.8rem",my:.5}} data-royal-military-person={p.personId}>
  <PersonLifeDates bornMonth={p.bornMonth} deathMonth={p.deathMonth}/><Typography fontSize="0.8rem">{p.personalName} · {ruler.reignOrdinal!==undefined?"已继位":"宗室军旅"} · {p.status==="ACTIVE"?"现役":p.status==="DEAD"?"已故":"已离任"}</Typography>
  <Typography fontSize="0.76rem">{parent?`${parent.houseName.replace(/氏$/,"")}${parent.givenName}之子`:""}{current&&current.id!==ruler.id&&d?` · ${formatRecordedKinship(ruler,current,d.rulers)}`:""}</Typography>
  {highest&&<Typography fontSize="0.76rem">最高实际军职：{MILITARY_OFFICE_NAMES[highest.office]} · 本国所部参与取城{career.capturedEventIds.filter(id=>History.getEvents().find(e=>e.id===id)?.actorFactionId===p.royalIdentity!.factionId).length}次</Typography>}
  {appointments.map(a=><Typography key={a.commandId} fontSize="0.76rem">{formatWorldDate(a.startMonth)}—{a.endMonth===undefined?"今":formatWorldDate(a.endMonth)} · {a.officeHistory?.map(g=>MILITARY_OFFICE_NAMES[g.office]).join(" → ")}</Typography>)}
  <NobleHistory person={p} month={month}/>
  <button type="button" style={buttonStyle} onClick={()=>nav.open({kind:"MILITARY",factionId:p.appointments[0].factionId,id:p.personId})}>查看真实军旅档案</button>
  {onGenealogy&&<> · <button type="button" style={buttonStyle} onClick={onGenealogy}>查看亲属宗谱</button></>}
 </Box>;
}
const ROSTER_ROW_HEIGHT=88;
const localActive=(p:ReturnType<typeof Military.getPeople>[number],factionId:string)=>p.status==="ACTIVE"&&p.factionId===factionId&&p.appointments.some(a=>a.factionId===factionId&&a.endMonth===undefined);
/** Local service status is separate from active service after transfer abroad. */
export function sortRoyalMilitaryRows(rows:Array<[string,ReturnType<typeof Military.getPeople>[number]]>,factionId:string){
 const lastEnd=(p:ReturnType<typeof Military.getPeople>[number])=>Math.max(-1,...p.appointments.filter(a=>a.factionId===factionId).map(a=>a.endMonth??-1));
 return [...rows].sort((a,b)=>Number(localActive(b[1],factionId))-Number(localActive(a[1],factionId))||lastEnd(b[1])-lastEnd(a[1])||a[0].localeCompare(b[0]));
}
export function RoyalMilitaryRoster({rulers,month,onGenealogy,factionId}:{rulers:Ruler[];factionId:string;month:number;onGenealogy?:(id?:string)=>void}){
 const [expanded,setExpanded]=useState(false),people=royalMilitaryArchive({factionId,rulers},Military.getPeople(),History.getEvents());
 const rows=sortRoyalMilitaryRows([...people],factionId);
 const active=rows.filter(([,p])=>localActive(p,factionId)).length;
 return <Box sx={{my:1}} data-royal-military-roster>
  <Box component="button" type="button" aria-expanded={expanded} disabled={!rows.length} onClick={()=>setExpanded(v=>!v)} sx={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',p:0,border:0,background:'none',font:'inherit',color:'inherit',cursor:'pointer',textAlign:'left'}}>
   <Typography component="span" fontWeight="bold" fontSize=".85rem">宗室军旅：累计{rows.length}人 · 现役{active}人 · 历任{rows.length-active}人</Typography><span aria-hidden="true">{expanded?'▾':'▸'}</span>
  </Box>
  {expanded&&<RoyalMilitaryList rows={rows} rulers={rulers} month={month} factionId={factionId} onGenealogy={onGenealogy}/>}
 </Box>;
}
export function RoyalMilitaryList({rows,rulers,month,factionId,onGenealogy}:{rows:Array<[string,ReturnType<typeof Military.getPeople>[number]]>;rulers:Ruler[];month:number;factionId:string;onGenealogy?:(id?:string)=>void}){
 const nav=usePersonArchiveNavigation(),host=useRef<HTMLDivElement>(null),[range,setRange]=useState({start:0,end:12});
 useLayoutEffect(()=>{
  const element=host.current;if(!element)return;let parent=element.parentElement;
  while(parent&&!['auto','scroll'].includes(getComputedStyle(parent).overflowY))parent=parent.parentElement;
  const scroll=parent??window;
  const update=()=>{const top=element.getBoundingClientRect().top,view=parent?.getBoundingClientRect(),height=parent?.clientHeight??window.innerHeight;
   const start=Math.min(Math.max(0,rows.length-1),Math.max(0,Math.floor(((view?.top??0)-top)/ROSTER_ROW_HEIGHT)-3)),end=Math.min(rows.length,start+Math.min(80,Math.ceil(height/ROSTER_ROW_HEIGHT)+7));
   setRange(old=>old.start===start&&old.end===end?old:{start,end});};
  let frame=0;const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;update();});};
  scroll.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);const observer=new ResizeObserver(schedule);observer.observe(parent??document.documentElement);update();
  return ()=>{scroll.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);observer.disconnect();cancelAnimationFrame(frame);};
 },[rows]);
 const events=History.getEvents(),byEvent=new Map(events.map(e=>[e.id,e])),byRuler=new Map(rulers.map(r=>[r.id,r]));
 const line={fontSize:'.76rem',lineHeight:'18px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'};
 return <Box ref={host} role="list" aria-label="宗室军旅人物" sx={{position:'relative',height:rows.length*ROSTER_ROW_HEIGHT}}>
  {rows.slice(range.start,range.end).map(([id,p],i)=>{const appointments=p.appointments.filter(a=>a.factionId===factionId),r=byRuler.get(id),parent=byRuler.get(r?.parentId??'');
   const victories=deriveMilitaryCareer(p,Military.getFormations(),events,month).capturedEventIds.filter(id=>byEvent.get(id)?.actorFactionId===factionId).length;
   return <Box key={id} role="listitem" aria-setsize={rows.length} aria-posinset={range.start+i+1} data-royal-military-person={p.personId} sx={{position:'absolute',top:(range.start+i)*ROSTER_ROW_HEIGHT,height:ROSTER_ROW_HEIGHT,width:'100%',boxSizing:'border-box',py:.75}}>
    <Box sx={{display:'flex',justifyContent:'space-between',gap:1}}><button type="button" style={buttonStyle} onClick={()=>nav.open({kind:'MILITARY',factionId,id:p.personId})}>{p.personalName}</button>{onGenealogy&&<button type="button" style={buttonStyle} onClick={()=>onGenealogy(id)}>宗谱</button>}</Box>
    <Typography sx={line}>{parent?`${parent.houseName.replace(/氏$/,'')}${parent.givenName}之子 · `:''}{localActive(p,factionId)?'现役':p.status==='DEAD'?'已故':'已离任'}{r?.reignOrdinal!==undefined?' · 后来继位':''} · {royalMilitaryOfficeLabel(p,month)}</Typography>
    <Typography sx={line}>{appointments.length?`${formatWorldDate(appointments[0].startMonth)}—${appointments.at(-1)?.endMonth===undefined?'今':formatWorldDate(appointments.at(-1)!.endMonth!)}`:'任期未载'} · 本国所部参与取城{victories}次</Typography>
    {p.deathMonth!==undefined&&<Typography sx={line}>死亡：{formatWorldDate(p.deathMonth)}</Typography>}
   </Box>;
  })}
 </Box>;
}
export function MilitaryRoyalOrigin({personId}:{personId:string}){
 const nav=usePersonArchiveNavigation(),p=Military.getPerson(personId),link=p?.royalIdentity;
 if(!link)return null;
 const d=Dynasty.get(link.factionId),r=d?.rulers.find(r=>r.id===link.rulerId&&r.militaryIdentity?.personId===personId),parent=d?.rulers.find(parent=>parent.id===r?.parentId);
 if(!r)return null;
 return <Box sx={{fontSize:"0.8rem",my:.5}}>宗室身份：{r.houseName.replace(/氏$/,"")+r.givenName}{parent?`，${parent.houseName.replace(/氏$/,"")+parent.givenName}之子`:""} · {r.reignOrdinal!==undefined?"后来继位":"尚无登位记录"} · <button type="button" style={buttonStyle} onClick={()=>nav.open({kind:"GENEALOGY",factionId:link.factionId,id:r.id})}>查看王室与亲属宗谱</button></Box>;
}
