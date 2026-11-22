import Civil from '../../../Politics/CivilAdministration';
import {unifiedPersonServiceLinks} from '../../../Politics/PersonServiceLinks';
import RoyalNoblePanel from './RoyalNoblePanel';
import {rulerFamilyOrigin} from '../../../Politics/RulerFamilyOrigin';
import {courtServiceReadings} from '../../../Politics/CourtServicePresentation';
import InsurgentCommandPanel from './InsurgentCommandPanel';
import MilitaryFamilyPanel from './MilitaryFamilyPanel';
import HistoricalEventArchive from './HistoricalEventArchive';
import {formatChronicleDate} from '../../../History/ChronicleReading';
import {militaryPoliticalLife} from "../../../Politics/MilitaryPoliticalLife";
import {MilitaryRoyalOrigin} from "./RoyalMilitaryPanel";
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
export function RulerServicePanel({ruler,factionId,month,reading}:{ruler:Ruler;factionId:string;month:number;reading?:{earlier:ReturnType<typeof preAccessionMilitary>;rows:ReturnType<typeof personServiceLinks>}}){
 const nav=usePersonArchiveNavigation(),people=Military.getPeople(),events=reading?[]:History.getEvents();
 const origin=rulerFamilyOrigin(ruler,Military.getFamilies(),people,month);
 const earlier=reading?reading.earlier:preAccessionMilitary(ruler,people,Military.getFormations(),events,{factions:new Map((Game.Core?.teams??[]).map(t=>[t.name,t]))});
 const rows=reading?reading.rows:personServiceLinks(factionId,[ruler],people,Military.getFormations(),events,month);
 return <>
  {Dynasty.get(factionId)&&<RoyalNoblePanel ruler={ruler} dynasty={Dynasty.get(factionId)!} month={month}/>}
  {origin&&<Typography fontSize=".8rem">原属{origin.family.surname}氏功臣家族 · <button type="button" style={style} onClick={()=>nav.open({kind:'FAMILY',factionId:origin.family.factionId,id:origin.family.familyId,memberId:origin.member.memberId})}>查看原家族宗谱并定位本人</button></Typography>}
  <InsurgentCommandPanel factionId={factionId} rulerId={ruler.id} month={month}/>
  {earlier&&<ChronicleSection title="早年与登位前经历">
   {earlier.representative.map(e=><Typography key={e.eventId} fontSize="0.82rem">{formatChronicleDate(e.worldMonth)}，{e.text}</Typography>)}
   <button type="button" style={style} onClick={()=>nav.open({kind:"MILITARY",factionId:ruler.militaryUsurperIdentity?.factionId??ruler.residentIdentity?.sourceFactionId??earlier.person.royalIdentity!.factionId,id:earlier.person.personId})}>查看登位前完整军旅档案</button>
  </ChronicleSection>}
  {rows.length>0&&<ChronicleSection title="任内军政人物">
   <ServiceRows rows={rows} label={id=>getMilitaryPersonDisplayName(people.find(p=>p.personId===id)!)} onOpen={id=>nav.open({kind:"MILITARY",factionId,id})}/>
  </ChronicleSection>}
 </>;
}
export function MilitaryServicePanel({personId,month,timelineOwnsPolitics=false,includeRulers=true}:{personId:string;month:number;timelineOwnsPolitics?:boolean;includeRulers?:boolean}){
 const nav=usePersonArchiveNavigation(),person=Military.getPerson(personId);if(!person)return null;

 const command=Military.getFormations().find(f=>f.status==="ACTIVE"&&f.commanderPersonId===personId),target=command?.targetCityId&&Game.Core?.allCities.find(c=>c.id===command.targetCityId);
 const politicalLife=militaryPoliticalLife(person,Dynasty.getAll(),History.getEvents(),new Map((Game.Core?.teams??[]).map(t=>[t.name,t])),month);
 return <>{!timelineOwnsPolitics&&courtServiceReadings(person,History.getEvents(),month).map(row=><Typography key={row.eventId} fontSize=".8rem">{formatWorldDate(row.month)} · {row.text}</Typography>)}{politicalLife?.foundingEventId&&<Typography fontSize=".8rem">{formatWorldDate(politicalLife.entry.worldMonth)}叛离旧主 · 原军职已终止</Typography>}<MilitaryFamilyPanel personId={personId} month={month}/><MilitaryRoyalOrigin personId={personId} month={month}/>{command&&<Typography fontSize=".8rem">当前行动：{(command.retreatUntilMonth??-1)>month?`撤围回防，休整至${formatWorldDate(command.retreatUntilMonth!)}`:target?`${target.siegeBattle?.attackerId===command.factionId?"实际围攻":"向目标行军"}：${target.name}`:"暂无进军目标"}</Typography>}{!timelineOwnsPolitics&&politicalLife&&<ChronicleSection title="政治生涯转折"><Typography fontSize=".8rem">{formatWorldDate(politicalLife.entry.worldMonth)} · {politicalLife.entry.text}</Typography><button type="button" style={style} onClick={()=>nav.open({kind:"RULER",factionId:politicalLife.factionId,id:politicalLife.rulerId})}>查看对应王室本纪</button></ChronicleSection>}{includeRulers&&<PersonRulersPanel personId={personId} month={month}/>}</>;
}
function ServiceRows({rows,label,onOpen,ruler=false}:{rows:ReturnType<typeof personServiceLinks>;label:(id:string)=>string;onOpen:(id:string,faction:string)=>void;ruler?:boolean}){
 const render=(xs:typeof rows)=>xs.map((r,i)=><Box key={`${r.personId}:${r.rulerId}:${r.startMonth}:${i}`} sx={{fontSize:"0.8rem",mt:.4,overflowWrap:"anywhere"}}>
  <button type="button" style={style} onClick={()=>onOpen(ruler?r.rulerId:r.personId,r.factionId)}>{label(ruler?r.rulerId:r.personId)}</button>{ruler?'在位期间，':'，'}{formatChronicleDate(r.startMonth)}至{formatChronicleDate(r.endMonth)}{r.offices.length>1?'历任':'任'}{countryAt(r.factionId,r.startMonth)}{r.offices.map(o=>MILITARY_OFFICE_NAMES[o]).join('、')||'军职（名称未载）'}{r.victoryEventIds.length?`；所部参战取城${r.victoryEventIds.length}次。`:'。'}
 </Box>);
 return <>{render(rows.slice(0,5))}{rows.length>5&&<HistoricalEventArchive title="其余任职经历" totalCount={rows.length-5} entries={()=>rows.slice(5).map((r,i)=>({id:String(i),content:render([r])}))}/>}
 <HistoricalEventArchive title="任职史料依据" totalCount={rows.length} entries={()=>rows.map((r,i)=>({id:String(i),content:<Typography fontSize=".74rem">{r.personId} / {r.rulerId} · 任职交集 {formatWorldDate(r.startMonth)}—{formatWorldDate(r.endMonth)} · 取城来源 {r.victoryEventIds.join('、')||'未记录'} · 授职来源 {r.personalGrantEventIds.join('、')||'未记录'}；授职与在位交集不等于君主亲命。</Typography>}))}/></>;
}

export function PersonRulersPanel({personId,month,technical=false}:{personId:string;month:number;technical?:boolean}){
 const nav=usePersonArchiveNavigation(),dynasties=Dynasty.getAll(),rows=unifiedPersonServiceLinks(personId,Civil.getByPerson(personId),Military.getPeople(),dynasties,History.getRecordedEvents(),month);
 if(!rows.length)return null;
 const name=(id:string)=>{const r=dynasties.flatMap(d=>d.rulers).find(r=>r.id===id);return r?`${r.houseName.replace(/氏$/,'')}${r.givenName}`:'君主姓名未载';};
 if(technical)return <HistoricalEventArchive title="历事君主交集依据" totalCount={rows.length} entries={()=>rows.map((r,i)=>({id:String(i),content:<Typography fontSize=".74rem">{name(r.rulerId)}：{formatWorldDate(r.startMonth)}—{formatWorldDate(r.endMonth)}；任职来源：{r.sourceIds.join('、')}。交集不等于君主亲命，流亡月份已排除。</Typography>}))}/>;
 const render=(xs:typeof rows)=>xs.map((r,i)=><Typography key={`${r.rulerId}/${r.startMonth}/${i}`} fontSize=".8rem"><button style={style} onClick={()=>nav.open({kind:'RULER',factionId:r.factionId,id:r.rulerId})}>{name(r.rulerId)}</button>：{formatWorldDate(r.startMonth)}—{formatWorldDate(r.endMonth)}，任{r.offices.join('、')}；{r.appointing?'有正式任命记录':'任职与君主在国执政期间相交'}。</Typography>);
 return <ChronicleSection title="历事君主">{render(rows.slice(0,5))}{rows.length>5&&<HistoricalEventArchive title="其余历事君主" totalCount={rows.length-5} entries={()=>rows.slice(5).map((r,i)=>({id:String(i),content:render([r])}))}/>}</ChronicleSection>;
}
