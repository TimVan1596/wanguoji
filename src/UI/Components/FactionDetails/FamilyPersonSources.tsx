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
 const nav=usePersonArchiveNavigation(),sources=familyPersonSources(familyArchive(family,month),memberId);if(!sources)return null;
 const parent=sources.parent?.member,source=familyArchiveSource(month).source,at=(eventId:string)=>source.events.find(e=>e.id===eventId),first=sources.appointments[0],office=sources.appointments.flatMap(a=>a.officeHistory??[]).filter(o=>o.month<=month).at(-1);
 return <Box data-family-person-sources sx={{my:.7}}><Typography fontSize=".8rem">家族：{sources.surname}氏 · 第{sources.generation}代</Typography><Typography fontSize=".8rem">父亲：{parent?<><button type="button" onClick={()=>nav.open({kind:'FAMILY',factionId:family.factionId,id:family.familyId,memberId:parent.memberId})}>{parent.name}</button>{sources.parentHighest?`（最高曾封${NOBLE_NAMES[sources.parentHighest.rank]}）`:''}</>:'父系未载'}{parent?.militaryPersonId&&sources.parent?.person&&<Button size="small" onClick={()=>nav.open({kind:'MILITARY',factionId:sources.parent!.person!.appointments.at(-1)?.factionId??family.factionId,id:parent.militaryPersonId!})}>父亲军旅档案</Button>}</Typography>
 {first&&<Typography fontSize=".76rem">{formatWorldDate(first.startMonth)}初任校尉{office?` · 最后记录军职：${MILITARY_OFFICE_NAMES[office.office]}`:''}；任官依据以原任命记录为准。</Typography>}
 {sources.inherited.map(({act,predecessor,effective,endedBy})=><Box key={act.eventId} sx={{mt:.4}}><Typography fontSize=".78rem">家族承袭：{formatWorldDate(act.month)}，承自{predecessor?.member.name??'原始史料未载'}的{FAMILY_NOBLE_NAMES[act.previousRank]}，本人袭{FAMILY_NOBLE_NAMES[act.rank!]} · {effective?'当前有效':endedBy?`${formatWorldDate(endedBy.month)}${endedBy.kind==='SUCCEEDED'?'本人身后已传下一任':'承袭终止'}`:sources.life==='DEAD'?'本人死亡后失效':'当前已失效'}。</Typography>{at(act.eventId)&&<details><summary>承袭史料与跳转</summary><HistoryEntityNavigation event={at(act.eventId)!}/></details>}</Box>)}
 {sources.personal.map(({grant,effective,source:kind})=><Box key={grant.eventId} sx={{mt:.4}}><Typography fontSize=".78rem">{kind}：{formatWorldDate(grant.month)} · {grant.countryName} · {NOBLE_NAMES[grant.rank]} · {effective?'当前有效':'历史受封，非当前有效爵位'}。{nobleChronicle(grant)}</Typography>{at(grant.eventId)&&<details><summary>授爵史料与跳转</summary><HistoryEntityNavigation event={at(grant.eventId)!}/></details>}</Box>)}
 </Box>;
}
