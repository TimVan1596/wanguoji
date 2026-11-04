import type {MilitaryFormation} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
/** A newly created command cannot fight before its start, or end before its
 * same-month actions. Other same-month facts retain their existing order. */
export function insurgentChronicleOrder(a:WorldEvent,b:WorldEvent){const priority=(e:WorldEvent)=>e.type==='leader-command-started'?-1:e.type==='leader-command-ended'?1:0;return (a.monthIndex??a.year)-(b.monthIndex??b.year)||priority(a)-priority(b);}
/** Read only. A political title alone proves no personal military command. */
export function insurgentChronicle(rulerId:string,formations:readonly MilitaryFormation[],events:readonly WorldEvent[],month:number){
 const byId=new Map(events.map(e=>[e.id,e])),rows=new Map<string,WorldEvent>();
 for(const f of formations){const d=f.leaderDuty;if(!d||d.rulerId!==rulerId||f.createdMonth>month)continue;
  const start=byId.get(`leader-command-${f.commandId}`),name=start?.metadata?.leaderName;
  if(!start||start.type!=='leader-command-started'||start.rulerId!==rulerId||start.metadata?.personId!==d.personId||typeof name!=='string')continue;
  rows.set(start.id,{...start,title:`${name}率本势力原有${d.initialMembers.length}人（含本人）成军，承担义军统帅职责。`});
  for(const e of events){const at=e.monthIndex??e.year,m=e.metadata;if(at<f.createdMonth||at>Math.min(month,d.endMonth??Infinity)||e.actorFactionId!==f.factionId||m?.commandId!==f.commandId)continue;
   if(e.type==='leader-command-ended'&&m.rulerId===rulerId&&d.endMonth===at)rows.set(e.id,{...e,title:`${name}结束直接统帅职责。`});
   else if(m?.commanderPersonId===d.personId||m?.personId===d.personId){
    if(e.type==='siege-started')rows.set(e.id,{...e,title:`${name}所率义军开始围攻${e.cityName??'原记城邑'}。`});
    else if(e.type==='siege-ended')rows.set(e.id,{...e,title:`${name}所率义军结束围攻${e.cityName??'原记城邑'}${m.reason==='REPULSED'?'，攻势受阻':m.reason==='TRUCE'?'，因停战撤围':''}。`});
    else if(f.captures.some(c=>c.eventId===e.id))rows.set(e.id,{...e,title:`${name}所率义军参与${e.type==='city-recovered'?'收复':'攻取'}${e.cityName??'原记城邑'}。`});
   }
  }
 }
 return [...rows.values()].sort(insurgentChronicleOrder);
}
