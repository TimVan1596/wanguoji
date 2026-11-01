import {Typography} from '@mui/material';
import Military from '../../../Politics/MilitaryCommandRegistry';
import {familyStatus} from '../../../Politics/MilitaryFamily';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import {usePersonArchiveNavigation} from './PersonArchiveNavigation';
import HistoricalEventArchive from './HistoricalEventArchive';
export default function MilitaryFamilyPanel({personId}:{personId:string}){
 const nav=usePersonArchiveNavigation(),family=Military.getFamilies().find(f=>f.members.some(m=>m.militaryPersonId===personId));
 if(!family)return null;
 const people=Military.getPeople(),render=(m:typeof family.members[number])=>{
  const p=people.find(p=>p.personId===m.militaryPersonId),parent=family.members.find(p=>p.memberId===m.parentMemberId);
  return <Typography key={m.memberId} fontSize='.8rem'>{m.generation===0?'始祖':`第${m.generation+1}代`}：{p?<button type="button" onClick={()=>nav.open({kind:'MILITARY',factionId:p.factionId,id:p.personId})}>{m.name}</button>:m.name}{parent?`，${parent.name}之子`:''} · 生于{formatWorldDate(m.bornMonth)} · {m.deathMonth!==undefined?`卒于${formatWorldDate(m.deathMonth)}`:'在世'} · {p?(p.status==='ACTIVE'?'现役军政人物':'曾任军职'):'普通居民，尚无正式从军记录'}</Typography>;
 };
 return <details data-military-family={family.familyId}><summary>家族与后代 · {family.surname}氏 · {familyStatus(family,people)}</summary>{family.members.slice(0,5).map(render)}{family.members.length>5&&<HistoricalEventArchive title="其他家族成员" totalCount={family.members.length-5} entries={()=>family.members.slice(5).map(m=>({id:m.memberId,content:render(m)}))}/>}
 <details><summary>家族来源</summary><Typography fontSize='.74rem'>立家于{formatWorldDate(family.foundedMonth)}；功劳来源 {family.sourceEventId}。亲缘登记于居民入籍时，不是当月出生。荫补仅限合法初任候选，子代10%、孙代5%，不授军队或爵位。</Typography></details></details>;
}
