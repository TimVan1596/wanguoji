import {Box,Typography} from "@mui/material";
import Dynasty,{type Ruler} from "../../../Politics/Dynasty";
import Military from "../../../Politics/MilitaryCommandRegistry";
import History from "../../../History/WorldHistory";
import {militaryMilestones,selectMilitaryMilestones} from "../../../Politics/MilitaryChroniclePresentation";
import {MILITARY_OFFICE_NAMES} from "../../../Politics/MilitaryOffice";
import {formatWorldDate} from "../../../Simulation/WorldTime";
import {usePersonArchiveNavigation} from "./PersonArchiveNavigation";

const buttonStyle={border:0,padding:0,background:"none",font:"inherit",color:"inherit",textDecoration:"underline",cursor:"pointer"} as const;
export function RoyalMilitaryPanel({ruler,month,onGenealogy}:{ruler:Ruler;month:number;onGenealogy?:()=>void}){
 const nav=usePersonArchiveNavigation(),i=ruler.militaryIdentity,p=i&&Military.getPerson(i.personId);
 if(!p||p.royalIdentity?.rulerId!==ruler.id)return null;
 const events=History.getEvents(),readable=militaryMilestones(p,Military.getChronicle(p,month),events);
 return <Box sx={{fontSize:"0.8rem",my:.5}} data-royal-military-person={p.personId}>
  <Typography fontSize="0.8rem">{p.personalName} · {ruler.reignOrdinal!==undefined?"已继位":"宗室军旅"} · {p.status==="ACTIVE"?"现役":p.status==="DEAD"?"已故":"已离任"}</Typography>
  {p.appointments.map(a=><Typography key={a.commandId} fontSize="0.76rem">{formatWorldDate(a.startMonth)}—{a.endMonth===undefined?"今":formatWorldDate(a.endMonth)} · {a.officeHistory?.map(g=>MILITARY_OFFICE_NAMES[g.office]).join(" → ")}</Typography>)}
  {selectMilitaryMilestones(readable,events,3).map(e=><Typography key={e.eventId} fontSize="0.76rem">{formatWorldDate(e.worldMonth)} · {e.text}</Typography>)}
  <button type="button" style={buttonStyle} onClick={()=>nav.open({kind:"MILITARY",factionId:p.appointments[0].factionId,id:p.personId})}>查看真实军旅档案</button>
  {onGenealogy&&<> · <button type="button" style={buttonStyle} onClick={onGenealogy}>查看亲属宗谱</button></>}
 </Box>;
}
export function MilitaryRoyalOrigin({personId}:{personId:string}){
 const nav=usePersonArchiveNavigation(),p=Military.getPerson(personId),link=p?.royalIdentity;
 if(!link)return null;
 const d=Dynasty.get(link.factionId),r=d?.rulers.find(r=>r.id===link.rulerId&&r.militaryIdentity?.personId===personId),parent=d?.rulers.find(parent=>parent.id===r?.parentId);
 if(!r)return null;
 return <Box sx={{fontSize:"0.8rem",my:.5}}>宗室身份：{r.houseName.replace(/氏$/,"")+r.givenName}{parent?`，${parent.houseName.replace(/氏$/,"")+parent.givenName}之子`:""} · {r.reignOrdinal!==undefined?"后来继位":"尚无登位记录"} · <button type="button" style={buttonStyle} onClick={()=>nav.open({kind:"RULER",factionId:link.factionId,id:r.id})}>查看王室与亲属宗谱</button></Box>;
}
