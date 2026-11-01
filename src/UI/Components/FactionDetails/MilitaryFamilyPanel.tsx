import {useState} from 'react';
import {Typography} from '@mui/material';
import Military from '../../../Politics/MilitaryCommandRegistry';
import {familyStatus} from '../../../Politics/MilitaryFamily';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import {usePersonArchiveNavigation} from './PersonArchiveNavigation';
import HistoricalEventArchive from './HistoricalEventArchive';
export default function MilitaryFamilyPanel({personId}:{personId:string}){
 const [open,setOpen]=useState(false);
 const nav=usePersonArchiveNavigation(),family=Military.getFamilies().find(f=>f.members.some(m=>m.militaryPersonId===personId));
 if(!family)return null;
 const people=Military.getPeople();
 const timeline=()=>{
  const rows=[{id:family.familyId,month:family.foundedMonth,text:`${family.members[0].name}以功立家，${family.surname}氏始立。`}];
  for(const m of family.members){
   const parent=family.members.find(p=>p.memberId===m.parentMemberId),p=people.find(p=>p.personId===m.militaryPersonId),a=p?.appointments[0];
   if(parent)rows.push({id:`${m.memberId}-entered`,month:m.enteredMonth,text:`${parent.name}之子${m.name}入籍。`});
   if(m.generation>0&&a)rows.push({id:`${m.memberId}-enlisted`,month:a.startMonth,text:`${m.name}经正式任命从军，始任校尉。`});
   if(m.deathMonth!==undefined)rows.push({id:`${m.memberId}-death`,month:m.deathMonth,text:`${m.name}卒。`});
  }
  for(const renewal of family.renewals??[]){const m=family.members.find(m=>m.memberId===renewal.memberId)!;rows.push({id:renewal.sourceEventId,month:renewal.month,text:`${m.name}以本人新功续振家声。`});}
  return rows.sort((a,b)=>a.month-b.month||a.id.localeCompare(b.id)).map(r=>({id:r.id,content:<Typography fontSize='.78rem'>{formatWorldDate(r.month)}，{r.text}</Typography>}));
 };
 const timelineCount=1+family.members.filter(m=>m.parentMemberId).length+family.members.filter(m=>m.deathMonth!==undefined).length+family.members.filter(m=>m.generation>0&&m.militaryPersonId).length+(family.renewals?.length??0);
 const render=(m:typeof family.members[number])=>{
  const p=people.find(p=>p.personId===m.militaryPersonId),parent=family.members.find(p=>p.memberId===m.parentMemberId);
  return <Typography key={m.memberId} fontSize='.8rem'>{m.generation===0?'始祖':`第${m.generation+1}代`}：{p?<button type="button" onClick={()=>nav.open({kind:'MILITARY',factionId:p.appointments.at(-1)?.factionId??family.factionId,id:p.personId})}>{m.name}</button>:m.name}{parent?`，${parent.name}之子`:''} · 生于{formatWorldDate(m.bornMonth)} · {m.deathMonth!==undefined?`卒于${formatWorldDate(m.deathMonth)}`:m.exitMonth!==undefined?'生死未载':'在世'} · {p?(p.status==='ACTIVE'?'现役军政人物':'曾任军职'):'普通居民，尚无正式从军记录'}</Typography>;
 };
 return <details open={open} data-military-family={family.familyId} onToggle={e=>setOpen(e.currentTarget.open)}><summary>家族与后代 · {family.surname}氏 · {familyStatus(family,people)}</summary>{open&&<>{family.members.slice(0,5).map(render)}{family.members.length>5&&<HistoricalEventArchive title="其他家族成员" totalCount={family.members.length-5} entries={()=>family.members.slice(5).map(m=>({id:m.memberId,content:render(m)}))}/>}
 <HistoricalEventArchive title="家族沿革" totalCount={timelineCount} entries={timeline}/>
 <details><summary>家族来源</summary><Typography fontSize='.74rem'>立家于{formatWorldDate(family.foundedMonth)}；功劳来源 {family.sourceEventId}。亲缘登记于居民入籍时，不是当月出生。荫补仅限合法初任候选，按本世界保存的政策给予有限相对权重，不授军队或爵位。</Typography></details></>}</details>;
}
