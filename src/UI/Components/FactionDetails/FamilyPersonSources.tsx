import Military from '../../../Politics/MilitaryCommandRegistry';
import {militaryCourtLabels} from '../../../Politics/MilitaryCourtStanding';
import {useState} from 'react';
import Game from '../../../Game/Game';
import {formatHistoryEventTitle} from '../../../History/HistoryRenderRules';
import {Button,Typography,Box} from '@mui/material';
import type {MilitaryFamily} from '../../../Politics/MilitaryFamily';
import {familyPersonSources} from '../../../Politics/FamilyPersonSources';
import {familyArchive,familyArchiveSource} from './FamilyArchiveSource';
import {FAMILY_NOBLE_NAMES} from '../../../Politics/FamilyNobleSuccession';
import {NOBLE_NAMES,nobleChronicle} from '../../../Politics/MilitaryNobility';
import {MILITARY_OFFICE_NAMES} from '../../../Politics/MilitaryOffice';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import {usePersonArchiveNavigation} from './PersonArchiveNavigation';
import HistoryEntityNavigation from '../HistoryScroll/HistoryEntityNavigation';
/** Compact personal sources, not a second family model or another tree. */
export default function FamilyPersonSources({family,memberId,month}:{family:MilitaryFamily;memberId:string;month:number}){
 const [technical,setTechnical]=useState(false),nav=usePersonArchiveNavigation(),sources=familyPersonSources(familyArchive(family,month),memberId,familyArchiveSource(month).source);if(!sources)return null;
 const standing=Military.getHereditaryAppointmentStanding(family.familyId,memberId,Game.Core?.teams??[],month),row=familyArchive(family,month).rows.get(memberId)!,ban=row.person&&militaryCourtLabels(row.person,family.factionId,month,family.epochFounderId).some(x=>x.includes('禁仕'));
 const parent=sources.parent?.member,source=familyArchiveSource(month).source,at=(eventId:string)=>source.events.find(e=>e.id===eventId),first=sources.appointments[0],office=sources.appointments.flatMap(a=>a.officeHistory??[]).filter(o=>o.month<=month).at(-1),firstEvent=first&&at(`military-appointment-${first.commandId}`),weight=Number(firstEvent?.metadata?.familyAppointmentWeight),factions=new Map((Game.Core?.teams??[]).map(t=>[t.name,t]));
 return <Box data-family-person-sources sx={{my:.7}}><Typography fontSize=".8rem">家族：{sources.surname}氏 · 第{sources.generation}代</Typography><Typography fontSize=".8rem">父亲：{parent?<><button type="button" onClick={()=>nav.open({kind:'FAMILY',factionId:family.factionId,id:family.familyId,memberId:parent.memberId})}>{parent.name}</button>{sources.parentHighest?`（最高曾封${NOBLE_NAMES[sources.parentHighest.rank]}）`:''}</>:'父系未载'}{parent?.militaryPersonId&&sources.parent?.person&&<Button size="small" onClick={()=>nav.open({kind:'MILITARY',factionId:sources.parent!.person!.appointments.at(-1)?.factionId??family.factionId,id:parent.militaryPersonId!})}>父亲军旅档案</Button>}</Typography>
 {standing&&<Typography fontSize=".78rem" data-appointment-standing>{standing.status}</Typography>}
 {ban&&row.inherited&&<Typography fontSize=".78rem">因谋逆罢官、禁仕；原袭爵位未被正式追夺。</Typography>}
 {firstEvent?.metadata?.appointmentSelection&&<Typography fontSize=".78rem">该次任官参与国家共享选拔{(()=>{try{return JSON.parse(String(firstEvent.metadata!.appointmentSelection)).rows.some((r:any)=>r.sourceUserId===row.member.sourceUserId&&r.titleEventId)?'，当时具有有效袭爵候选优势':'';}catch{return '';}})()}；实际初任校尉，不据此认定爵位保证录用。</Typography>}
 {sources.parentCharterNote&&<Typography fontSize=".76rem">{sources.parentCharterNote}</Typography>}
 {sources.inheritanceReview&&<Typography fontSize=".76rem">父辈承袭结算：{formatWorldDate(sources.inheritanceReview.act.month)}。{sources.inheritanceReview.text}{sources.inheritanceReview.lateEntry&&`${parent?.name}结算后，${formatWorldDate(sources.inheritanceReview.lateEntry.enteredMonth)}才首次入籍并登记本人的父系，不能补写过去的爵位。`}</Typography>}
 {first&&<Typography fontSize=".76rem">{formatWorldDate(first.startMonth)}初任校尉{office?` · 最后记录军职：${MILITARY_OFFICE_NAMES[office.office]}`:''}。</Typography>}
 {sources.inherited.map(({act,predecessor,effective,endedBy})=><Box key={act.eventId} sx={{mt:.4}}><Typography fontSize=".78rem">家族承袭：{formatWorldDate(act.month)}，承自{predecessor?.member.name??'原始史料未载'}的{FAMILY_NOBLE_NAMES[act.previousRank]}，本人袭{FAMILY_NOBLE_NAMES[act.rank!]} · {effective?'当前有效':endedBy?`${formatWorldDate(endedBy.month)}${endedBy.kind==='SUCCEEDED'?'本人身后已传下一任':'承袭终止'}`:sources.life==='DEAD'?'本人死亡后失效':'当前已失效'}。</Typography></Box>)}
 {sources.personal.map(({grant,effective,source:kind})=><Box key={grant.eventId} sx={{mt:.4}}><Typography fontSize=".78rem">{kind}：{formatWorldDate(grant.month)} · {grant.countryName} · {NOBLE_NAMES[grant.rank]} · {effective?'当前有效':'历史受封，非当前有效爵位'}。{nobleChronicle(grant)}</Typography></Box>)}
 <details onToggle={e=>setTechnical(e.currentTarget.open)}><summary>原始史料与技术依据</summary>{technical&&Number.isFinite(weight)&&<Typography fontSize=".74rem">原任命候选权重：{weight.toFixed(2)}</Typography>}{technical&&[...new Set([...(row.member.birth?[row.member.birth.eventId,...row.member.populationEnteredMonth!==undefined&&row.member.populationEnteredMonth<=month?[`${row.member.memberId}-population-entered`]:[]]:[]),...sources.inherited.map(x=>x.act.eventId),...sources.personal.flatMap(({grant:g})=>[g.eventId,...g.basis==='FOUNDING'?[g.foundingEventId,...g.foundingMeritEventIds??[]]:g.basis==='COURT'?[g.courtServiceEventId,g.courtCoupEventId]:g.captureEventIds])])].flatMap(id=>{const e=id&&at(id);return e?[<Box key={e.id}><Typography fontSize=".74rem">{formatWorldDate(e.monthIndex??e.year)} · {formatHistoryEventTitle(e,factions)}</Typography><HistoryEntityNavigation event={e}/></Box>]:[];})}</details>
 </Box>;
}
