import {Box,Typography} from '@mui/material';
import type {MilitaryPerson} from '../../../Politics/MilitaryCommandRegistry';
import {militaryHonorText} from '../../../Politics/MilitaryHonors';
import {nobleChronicle} from '../../../Politics/MilitaryNobility';
import {formatWorldDate} from '../../../Simulation/WorldTime';
export function NobleHistory({person,factionId,month}:{person:MilitaryPerson;factionId?:string;month:number}){
 const grants=(person.nobilityHistory??[]).filter(g=>(!factionId||g.factionId===factionId)&&g.month<=month);
 const honors=(person.honorHistory??[]).filter(h=>(!factionId||h.factionId===factionId)&&h.month<=month);
 return grants.length||honors.length?<Box sx={{my:.5}}><Typography fontSize='.8rem' fontWeight='bold'>正式封爵</Typography>{grants.map(g=><Typography key={g.eventId} fontSize='.78rem'>{formatWorldDate(g.month)} · {g.countryName} · {nobleChronicle(g)}</Typography>)}{honors.map(h=><Typography key={h.eventId} fontSize='.78rem'>{formatWorldDate(h.month)} · {h.countryName} · {militaryHonorText(h)}{h.deathMonth!==undefined?`（去世：${formatWorldDate(h.deathMonth)}；依据：${h.reason==='BATTLE_SERVICE'?'在本国军职期间战死及真实取城':'长期任职与重要攻城战果'}）`:''}</Typography>)}</Box>:null;
}
