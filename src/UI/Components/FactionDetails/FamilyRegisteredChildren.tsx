import {useState} from 'react';
import {Box,Button,Typography} from '@mui/material';
import type {MilitaryFamily} from '../../../Politics/MilitaryFamily';
import {familyArchive} from './FamilyArchiveSource';
import {familyMemberServiceStatus} from '../../../Politics/FamilyMemberServiceStatus';
import {familyMemberNobleLabel,familyMemberMeritLabel} from './FamilyNoblePanel';
import {formatWorldDate} from '../../../Simulation/WorldTime';
/** Direct registered children only. Selecting a hidden civilian adds one requested node, not an entire branch. */
export default function FamilyRegisteredChildren({family,memberId,month,onLocate}:{family:MilitaryFamily;memberId:string;month:number;onLocate:(id:string)=>void}){
 const [limit,setLimit]=useState(6),archive=familyArchive(family,month),ids=archive.childrenByParent.get(memberId)??[];
 return <Box data-registered-children={memberId}><Typography fontSize=".8rem">已登记子嗣（{ids.length}）</Typography>{!ids.length&&<Typography fontSize=".76rem">未见当时已登记子嗣。</Typography>}{ids.slice(0,limit).map(id=>{const row=archive.rows.get(id)!,m=row.member,status=!row.political&&!row.appointments.length&&!row.inheritedHistory.length&&!row.personalHistory.length?'未见正式军职':familyMemberServiceStatus(row,month),death=m.deathMonth!==undefined&&m.deathMonth<=month?formatWorldDate(m.deathMonth):row.life==='ALIVE'?'在世':row.life==='DEAD'?'已故':'生死未载';return <Typography key={id} fontSize=".76rem"><button type="button" data-family-child={id} onClick={()=>onLocate(id)}>{m.name}</button>（推定生于{formatWorldDate(m.bornMonth)}—{death}） · {[familyMemberNobleLabel(family,m,month),familyMemberMeritLabel(family,m,month),status].filter(Boolean).join(' · ')}</Typography>;})}{ids.length>limit&&<Button size="small" onClick={()=>setLimit(n=>n+6)}>查看更多子嗣</Button>}</Box>;
}
