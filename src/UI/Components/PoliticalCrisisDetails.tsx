import {Typography} from '@mui/material';
import type {WorldEvent} from '../../History/WorldHistory';
import {readPoliticalCrisis} from '../../Politics/PoliticalEventNarrative';
import {formatWorldDate} from '../../Simulation/WorldTime';
export default function PoliticalCrisisDetails({event}:{event:WorldEvent}){
 const s=readPoliticalCrisis(event);if(!s)return null;
 return <details onClick={e=>e.stopPropagation()} style={{fontSize:'.75rem',overflowWrap:'anywhere'}}><summary>史料依据（事变当时）</summary>
  <Typography fontSize=".75rem">{formatWorldDate(s.worldMonth)} · {s.countryName} · 城邑{s.cityCount} · 稳定度{s.stability} · 国都{s.capitalCityName??'无实际国都'}</Typography>
  {s.facts.map(f=><Typography key={f.eventId} fontSize=".75rem">{formatWorldDate(f.worldMonth)} · {f.cityName??'本国'} · {f.type} · 原事件 {f.eventId} · 事务 {f.groupId}</Typography>)}
  {s.successorOffice&&<Typography fontSize=".75rem">继位前军职依据：{s.successorOffice.eventId} · 编组 {s.successorOffice.commandId} · 人物 {s.successorOffice.personId}</Typography>}
 </details>;
}
