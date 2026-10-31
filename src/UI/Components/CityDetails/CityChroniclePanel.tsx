import {useMemo,useState} from 'react';
import {Box,Button,Typography} from '@mui/material';
import History from '../../../History/WorldHistory';
import {cityChronicle,cityChronicleText} from '../../../History/CityChronicle';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import MilitaryArchiveWindow from '../FactionDetails/MilitaryArchiveWindow';
import type {HistoryFactionLike} from '../../../History/HistoryRenderRules';
export default function CityChroniclePanel({cityId,month,factions,revision}:{cityId:string;month:number;factions:Map<string,HistoryFactionLike>;revision:number}){
 const [complete,setComplete]=useState(false),count=History.getEventCount();
 const sources=useMemo(()=>History.getEventsForCity(cityId),[cityId,revision,count]);
 const rows=useMemo(()=>cityChronicle(cityId,sources,month),[cityId,sources,month]),visible=complete?rows:rows.slice(0,12),byId=new Map(visible.map(e=>[e.id,e]));
 return <section data-city-chronicle={cityId}><Box sx={{display:'flex',justifyContent:'space-between'}}><Typography fontSize='.86rem' fontWeight='bold'>城市大事记</Typography><Button size='small' onClick={()=>setComplete(v=>!v)}>{complete?'精选记录':`完整记录（${rows.length}）`}</Button></Box>
  <MilitaryArchiveWindow ids={visible.map(e=>e.id)} estimateHeight={78} maxRows={24}>{id=>{const e=byId.get(id)!;return <Box data-city-chronicle-event={e.id} sx={{py:.6,borderBottom:'1px solid var(--gg-border)'}}><Typography fontSize='.8rem'>{formatWorldDate(e.monthIndex??e.year)} · {cityChronicleText(e,cityId,factions)}</Typography><details><summary style={{fontSize:'.72rem'}}>史料来源</summary><Typography fontSize='.72rem'>{e.type} · {e.metadata?.sourceEventIds??e.id}</Typography></details></Box>;}}</MilitaryArchiveWindow>
  {!rows.length&&<Typography fontSize='.8rem'>尚无可定位于此城的大事记录。</Typography>}
 </section>;
}
