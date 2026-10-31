import {militaryLifePairs} from '../../../Politics/MilitaryLifePresentation';
import {store} from '../../../store';
import {setSelectedCityId,setRightPanelTab} from '../../../store/rootSlice';
import {appanageReadingText,appanageChanges} from '../../../Politics/MilitaryAppanage';
import History from '../../../History/WorldHistory';
import {Box,Typography} from '@mui/material';
import type {MilitaryPerson} from '../../../Politics/MilitaryCommandRegistry';
import {militaryHonorText} from '../../../Politics/MilitaryHonors';
import {nobleChronicle} from '../../../Politics/MilitaryNobility';
import {formatWorldDate} from '../../../Simulation/WorldTime';
export function NobleHistory({person,factionId,month}:{person:MilitaryPerson;factionId?:string;month:number}){
 const dispatch=store.dispatch;
 const grants=(person.nobilityHistory??[]).filter(g=>(!factionId||g.factionId===factionId)&&g.month<=month);
 const honors=(person.honorHistory??[]).filter(h=>(!factionId||h.factionId===factionId)&&h.month<=month);
 const appanages=(person.appanageHistory??[]).filter(a=>(!factionId||a.factionId===factionId)&&a.month<=month);
 const last=appanages.at(-1),pending=last?appanageChanges(person,last,History.getRecordedEvents(),month):[],state=pending.at(-1)??last;
 const ids=new Set([...grants,...honors,...appanages].map(x=>x.eventId)),pairs=militaryLifePairs(History.getRecordedEvents().filter(e=>ids.has(e.id))),merged=new Map(pairs.map(p=>[p.anchor.id,p.text])),hidden=new Set(pairs.map(p=>p.other.id));
 return grants.length||honors.length||appanages.length?<Box sx={{my:.5}}><Typography fontSize='.8rem' fontWeight='bold'>爵位与身后评价</Typography>{grants.map(g=><Typography key={g.eventId} fontSize='.78rem'>{formatWorldDate(g.month)} · {g.countryName} · {merged.get(g.eventId)??nobleChronicle(g)}</Typography>)}{honors.map(h=><Typography key={h.eventId} fontSize='.78rem'>{formatWorldDate(h.month)} · {h.countryName} · {militaryHonorText(h)}</Typography>)}{state&&<Typography fontSize='.78rem'>食邑：<button type='button' style={{border:0,background:'none',font:'inherit',color:'inherit',textDecoration:'underline',cursor:'pointer'}} onClick={()=>{dispatch(setSelectedCityId(state.cityId));dispatch(setRightPanelTab('city'));}}>{state.cityName}</button> · {state.kind==='LOST'?'失地':state.kind==='ENDED'?'已终止':'有效'}</Typography>}{appanages.filter(a=>!hidden.has(a.eventId)).map(a=><Typography key={a.eventId} fontSize='.78rem'>{formatWorldDate(a.month)} · {appanageReadingText(a)}</Typography>)}{pending.map(a=><Typography key={a.eventId} fontSize='.78rem'>{formatWorldDate(a.month)} · {appanageReadingText(a)}</Typography>)}<details><summary>史料考证</summary><Typography fontSize='.76rem'>食邑是王统内的名义授封，不含人口、税收、城池控制权或军权；失地不自动撤爵。原授封与各次变化均保留。</Typography>{[...grants,...honors,...appanages].map(a=><Typography key={a.eventId} fontSize='.72rem'>{a.eventId}{'sourceEventId' in a?` · 来源：${a.sourceEventId}`:''}{'reason' in a?` · 原因：${a.reason??'—'}`:''}{'deathMonth' in a&&a.deathMonth!==undefined?` · 去世：${formatWorldDate(a.deathMonth)}`:''}</Typography>)}</details></Box>:null;
}
