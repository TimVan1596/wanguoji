import {Typography} from '@mui/material';
import type {WorldEvent} from '../../../History/WorldHistory';
import {formatWorldDate} from '../../../Simulation/WorldTime';
/** Read projection only. Saved insertion order breaks ties within an actual month. */
export function personCareerEvents(events:readonly WorldEvent[],personId:string,month:number){
 return events.map((event,order)=>({event,order})).filter(({event:e})=>(e.monthIndex??e.year)<=month&&[e.metadata?.personId,e.metadata?.commanderPersonId,e.metadata?.militaryPersonId].includes(personId)).sort((a,b)=>(a.event.monthIndex??a.event.year)-(b.event.monthIndex??b.event.year)||a.order-b.order).map(({event})=>event);
}
export function personCareerMilestones(events:readonly WorldEvent[],personId:string,month:number,military:readonly {eventId:string;worldMonth:number;text:string}[]=[]){
 const actual=personCareerEvents(events,personId,month),text=new Map(military.map(e=>[e.eventId,e.text])),order=new Map(events.map((e,i)=>[e.id,i]));
 const rows=actual.map(e=>({id:e.id,month:e.monthIndex??e.year,text:text.get(e.id)??e.title}));
 const seen=new Set(rows.map(r=>r.id));for(const e of military)if(!seen.has(e.eventId)&&e.worldMonth<=month){seen.add(e.eventId);rows.push({id:e.eventId,month:e.worldMonth,text:e.text});}
 return rows.sort((a,b)=>a.month-b.month||(order.get(a.id)??Infinity)-(order.get(b.id)??Infinity)).map(e=>({id:e.id,content:<Typography fontSize=".82rem">{formatWorldDate(e.month)} · {e.text}</Typography>}));
}
