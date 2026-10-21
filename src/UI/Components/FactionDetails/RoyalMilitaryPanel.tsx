import {useState} from "react";
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
 const rank={PIJIANG:0,JIANGJUN:1,SHANGJIANGJUN:2};
 const highest=appointments.flatMap(a=>a.officeHistory??[]).sort((a,b)=>rank[b.office]-rank[a.office])[0];
 return <Box sx={{fontSize:"0.8rem",my:.5}} data-royal-military-person={p.personId}>
  <Typography fontSize="0.8rem">{p.personalName} · {ruler.reignOrdinal!==undefined?"已继位":"宗室军旅"} · {p.status==="ACTIVE"?"现役":p.status==="DEAD"?"已故":"已离任"}</Typography>
  <Typography fontSize="0.76rem">{parent?`${parent.houseName.replace(/氏$/,"")}${parent.givenName}之子`:""}{current&&current.id!==ruler.id&&d?` · ${formatRecordedKinship(ruler,current,d.rulers)}`:""}</Typography>
  {highest&&<Typography fontSize="0.76rem">最高实际军职：{MILITARY_OFFICE_NAMES[highest.office]} · 本国所部参与取城{career.capturedEventIds.filter(id=>History.getEvents().find(e=>e.id===id)?.actorFactionId===p.royalIdentity!.factionId).length}次</Typography>}
  {appointments.map(a=><Typography key={a.commandId} fontSize="0.76rem">{formatWorldDate(a.startMonth)}—{a.endMonth===undefined?"今":formatWorldDate(a.endMonth)} · {a.officeHistory?.map(g=>MILITARY_OFFICE_NAMES[g.office]).join(" → ")}</Typography>)}
  <button type="button" style={buttonStyle} onClick={()=>nav.open({kind:"MILITARY",factionId:p.appointments[0].factionId,id:p.personId})}>查看真实军旅档案</button>
  {onGenealogy&&<> · <button type="button" style={buttonStyle} onClick={onGenealogy}>查看亲属宗谱</button></>}
 </Box>;
}
export function RoyalMilitaryRoster({rulers,month,onGenealogy}:{rulers:Ruler[];month:number;onGenealogy?:()=>void}){
 const [expanded,setExpanded]=useState(false);
 const rows=rulers.filter(r=>{const p=r.militaryIdentity&&Military.getPerson(r.militaryIdentity.personId);return p?.royalIdentity?.rulerId===r.id;}).sort((a,b)=>{
  const pa=Military.getPerson(a.militaryIdentity!.personId)!,pb=Military.getPerson(b.militaryIdentity!.personId)!;
  const end=(p:typeof pa)=>Math.max(...p.appointments.map(a=>a.endMonth??month));
  return Number(pb.status==="ACTIVE")-Number(pa.status==="ACTIVE")||end(pb)-end(pa)||a.id.localeCompare(b.id);
 });
 if(!rows.length)return null;
 return <Box sx={{my:1}}><Typography fontWeight="bold" fontSize="0.9rem">宗室军旅</Typography><Typography fontSize="0.75rem">现役与历任军政宗室；继承资格另见上方储君与宗室候选。</Typography>
 {(expanded?rows:rows.slice(0,5)).map(r=><RoyalMilitaryPanel key={r.id} ruler={r} month={month} onGenealogy={onGenealogy}/>)}
 {rows.length>5&&<button type="button" style={buttonStyle} onClick={()=>setExpanded(!expanded)}>{expanded?"收起":`展开全部（${rows.length}人）`}</button>}</Box>;
}
export function MilitaryRoyalOrigin({personId}:{personId:string}){
 const nav=usePersonArchiveNavigation(),p=Military.getPerson(personId),link=p?.royalIdentity;
 if(!link)return null;
 const d=Dynasty.get(link.factionId),r=d?.rulers.find(r=>r.id===link.rulerId&&r.militaryIdentity?.personId===personId),parent=d?.rulers.find(parent=>parent.id===r?.parentId);
 if(!r)return null;
 return <Box sx={{fontSize:"0.8rem",my:.5}}>宗室身份：{r.houseName.replace(/氏$/,"")+r.givenName}{parent?`，${parent.houseName.replace(/氏$/,"")+parent.givenName}之子`:""} · {r.reignOrdinal!==undefined?"后来继位":"尚无登位记录"} · <button type="button" style={buttonStyle} onClick={()=>nav.open({kind:"RULER",factionId:link.factionId,id:r.id})}>查看王室与亲属宗谱</button></Box>;
}
