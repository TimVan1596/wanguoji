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
 const rank={PIJIANG:0,JIANGJUN:1,SHANGJIANGJUN:2};
 const highest=appointments.flatMap(a=>a.officeHistory??[]).sort((a,b)=>rank[b.office]-rank[a.office])[0];
 return <Box sx={{fontSize:"0.8rem",my:.5}} data-royal-military-person={p.personId}>
  <PersonLifeDates bornMonth={p.bornMonth} deathMonth={p.deathMonth}/><Typography fontSize="0.8rem">{p.personalName} · {ruler.reignOrdinal!==undefined?"已继位":"宗室军旅"} · {p.status==="ACTIVE"?"现役":p.status==="DEAD"?"已故":"已离任"}</Typography>
  <Typography fontSize="0.76rem">{parent?`${parent.houseName.replace(/氏$/,"")}${parent.givenName}之子`:""}{current&&current.id!==ruler.id&&d?` · ${formatRecordedKinship(ruler,current,d.rulers)}`:""}</Typography>
  {highest&&<Typography fontSize="0.76rem">最高实际军职：{MILITARY_OFFICE_NAMES[highest.office]} · 本国所部参与取城{career.capturedEventIds.filter(id=>History.getEvents().find(e=>e.id===id)?.actorFactionId===p.royalIdentity!.factionId).length}次</Typography>}
  {appointments.map(a=><Typography key={a.commandId} fontSize="0.76rem">{formatWorldDate(a.startMonth)}—{a.endMonth===undefined?"今":formatWorldDate(a.endMonth)} · {a.officeHistory?.map(g=>MILITARY_OFFICE_NAMES[g.office]).join(" → ")}</Typography>)}
  <button type="button" style={buttonStyle} onClick={()=>nav.open({kind:"MILITARY",factionId:p.appointments[0].factionId,id:p.personId})}>查看真实军旅档案</button>
  {onGenealogy&&<> · <button type="button" style={buttonStyle} onClick={onGenealogy}>查看亲属宗谱</button></>}
 </Box>;
}
export function RoyalMilitaryRoster({rulers,month,onGenealogy,factionId}:{rulers:Ruler[];factionId:string;month:number;onGenealogy?:(id?:string)=>void}){
 const nav=usePersonArchiveNavigation();
 const faction=factionId;
 const rows=faction?royalMilitaryArchive({factionId:faction,rulers},Military.getPeople(),History.getEvents()):new Map();
 const active=[...rows.values()].filter(p=>p.status==="ACTIVE").length;
 if(!rows.size)return null;
 return <Box sx={{my:1}}><Typography fontWeight="bold" fontSize="0.85rem">宗室军旅：累计{rows.size}人，现役{active}人，历任{rows.size-active}人</Typography>
 <button type="button" style={buttonStyle} onClick={()=>onGenealogy?.()}>查看完整宗谱</button>
 {[...rows].sort((a,b)=>Number(b[1].status==="ACTIVE")-Number(a[1].status==="ACTIVE")).slice(0,2).map(([id,p])=><Box key={id} data-royal-military-person={p.personId} fontSize="0.76rem">{p.personalName} · {royalMilitaryOfficeLabel(p,month)} · <button type="button" style={buttonStyle} onClick={()=>nav.open({kind:"MILITARY",factionId:faction!,id:p.personId})}>查看真实军旅档案</button> · <button type="button" style={buttonStyle} onClick={()=>onGenealogy?.(id)}>定位宗室将领</button></Box>)}
 </Box>;
}
export function MilitaryRoyalOrigin({personId}:{personId:string}){
 const nav=usePersonArchiveNavigation(),p=Military.getPerson(personId),link=p?.royalIdentity;
 if(!link)return null;
 const d=Dynasty.get(link.factionId),r=d?.rulers.find(r=>r.id===link.rulerId&&r.militaryIdentity?.personId===personId),parent=d?.rulers.find(parent=>parent.id===r?.parentId);
 if(!r)return null;
 return <Box sx={{fontSize:"0.8rem",my:.5}}>宗室身份：{r.houseName.replace(/氏$/,"")+r.givenName}{parent?`，${parent.houseName.replace(/氏$/,"")+parent.givenName}之子`:""} · {r.reignOrdinal!==undefined?"后来继位":"尚无登位记录"} · <button type="button" style={buttonStyle} onClick={()=>nav.open({kind:"GENEALOGY",factionId:link.factionId,id:r.id})}>查看王室与亲属宗谱</button></Box>;
}
