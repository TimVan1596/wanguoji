import {Box,Typography} from '@mui/material';
import {formatWorldDate} from '../../../Simulation/WorldTime';
/** Shared reading surface; every value comes from the one canonical person/population. */
export default function PersonCareerIdentity({personId,name,bornMonth,deathMonth}:{personId:string;name:string;bornMonth:number;deathMonth?:number}){
 return <Box data-person-career-identity={personId}><Typography fontSize=".82rem">姓名：{name}</Typography><Typography fontSize=".76rem">出生：{formatWorldDate(bornMonth)}{deathMonth===undefined?'':` · 卒于${formatWorldDate(deathMonth)}`}</Typography></Box>;
}
