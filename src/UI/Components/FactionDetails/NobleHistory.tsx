import {appanageText,appanageChanges} from '../../../Politics/MilitaryAppanage';
import History from '../../../History/WorldHistory';
import {Box,Typography} from '@mui/material';
import type {MilitaryPerson} from '../../../Politics/MilitaryCommandRegistry';
import {militaryHonorText} from '../../../Politics/MilitaryHonors';
import {nobleChronicle} from '../../../Politics/MilitaryNobility';
import {formatWorldDate} from '../../../Simulation/WorldTime';
export function NobleHistory({person,factionId,month}:{person:MilitaryPerson;factionId?:string;month:number}){
 const grants=(person.nobilityHistory??[]).filter(g=>(!factionId||g.factionId===factionId)&&g.month<=month);
 const honors=(person.honorHistory??[]).filter(h=>(!factionId||h.factionId===factionId)&&h.month<=month);
 const appanages=(person.appanageHistory??[]).filter(a=>(!factionId||a.factionId===factionId)&&a.month<=month);
 const last=appanages.at(-1),pending=last?appanageChanges(person,last,History.getEvents().reverse(),month):[],state=pending.at(-1)??last;
 return grants.length||honors.length||appanages.length?<Box sx={{my:.5}}><Typography fontSize='.8rem' fontWeight='bold'>爵位与身后评价</Typography>{grants.map(g=><Typography key={g.eventId} fontSize='.78rem'>{formatWorldDate(g.month)} · {g.countryName} · {nobleChronicle(g)}</Typography>)}{honors.map(h=><Typography key={h.eventId} fontSize='.78rem'>{formatWorldDate(h.month)} · {h.countryName} · {militaryHonorText(h)}{h.deathMonth!==undefined?`（去世：${formatWorldDate(h.deathMonth)}；依据：${h.reason==='BATTLE_SERVICE'?'在本国军职期间战死及真实取城':'长期任职与重要攻城战果'}）`:''}</Typography>)}{state&&<Typography fontSize='.78rem'>名义食邑：{state.cityName} · {state.kind==='LOST'?'失地':state.kind==='ENDED'?'已结束':'有效'}（王统内独占，不含人口、税收及控制权）</Typography>}{appanages.map(a=><Typography key={a.eventId} fontSize='.78rem'>{formatWorldDate(a.month)} · {appanageText(a)}</Typography>)}{pending.length>0&&<Typography fontSize='.76rem'>本月真实变化待月度结算：{pending.map(appanageText).join('')}</Typography>}</Box>:null;
}
