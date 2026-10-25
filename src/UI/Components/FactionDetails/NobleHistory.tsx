import {Box,Typography} from '@mui/material';
import type {MilitaryPerson} from '../../../Politics/MilitaryCommandRegistry';
import {nobleChronicle} from '../../../Politics/MilitaryNobility';
import {formatWorldDate} from '../../../Simulation/WorldTime';
export function NobleHistory({person,factionId,month}:{person:MilitaryPerson;factionId?:string;month:number}){
 const grants=(person.nobilityHistory??[]).filter(g=>(!factionId||g.factionId===factionId)&&g.month<=month);
 return grants.length?<Box sx={{my:.5}}><Typography fontSize='.8rem' fontWeight='bold'>正式封爵</Typography>{grants.map(g=><Typography key={g.eventId} fontSize='.78rem'>{formatWorldDate(g.month)} · {g.countryName} · {nobleChronicle(g)}</Typography>)}</Box>:null;
}
