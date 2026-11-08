import {Box,Typography} from '@mui/material';
import Military,{type MilitaryPerson} from '../../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../../Politics/Dynasty';
import History from '../../../History/WorldHistory';
import Game from '../../../Game/Game';
import {posthumousPeerage} from '../../../Politics/PosthumousPeerage';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import {familyNobleReading} from '../../../History/FamilyNobleReading';
import HistoryEntityNavigation from '../HistoryScroll/HistoryEntityNavigation';
export default function PosthumousPeeragePanel({person,month}:{person:MilitaryPerson;month:number}){
 if(person.deathMonth===undefined||person.deathMonth>month)return null;
 const rows=posthumousPeerage(person,Military.getFamilies(),Dynasty.getAll(),History.getRecordedEvents(),month);if(!rows.length)return null;
 const factions=new Map((Game.Core?.teams??[]).map(t=>[t.name,t]));
 return <Box data-posthumous-peerage><Typography fontSize=".82rem" fontWeight="bold">身后爵位传承</Typography>{rows.map(e=><Box key={e.id}><Typography fontSize=".78rem">{formatWorldDate(e.monthIndex??e.year)} · {familyNobleReading(e,factions)??e.title}</Typography><HistoryEntityNavigation event={e}/></Box>)}</Box>;
}
