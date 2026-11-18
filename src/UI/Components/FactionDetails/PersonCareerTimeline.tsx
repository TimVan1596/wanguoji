import {mergeCourtCoupReading} from '../../../History/CourtCoupReading';
import {Typography} from '@mui/material';
import type {WorldEvent} from '../../../History/WorldHistory';
import {formatWorldDate} from '../../../Simulation/WorldTime';
/** Read projection only. Saved insertion order breaks ties within an actual month. */
export function personCareerEvents(events:readonly WorldEvent[],personId:string,month:number){
 return events.map((event,order)=>({event,order})).filter(({event:e})=>(e.monthIndex??e.year)<=month&&[e.metadata?.personId,e.metadata?.commanderPersonId,e.metadata?.militaryPersonId].includes(personId)).sort((a,b)=>(a.event.monthIndex??a.event.year)-(b.event.monthIndex??b.event.year)||a.order-b.order).map(({event})=>event);
}
export function personCareerMilestones(events:readonly WorldEvent[],personId:string,month:number,military:readonly {eventId:string;worldMonth:number;text:string}[]=[]){
 const text=new Map(military.map(e=>[e.eventId,e.text])),order=new Map(events.map((e,i)=>[e.id,i])),byId=new Map(events.map(e=>[e.id,e]));
 const principal=new Set(personCareerEvents(events,personId,month).map(e=>e.id));for(const e of military)if(e.worldMonth<=month)principal.add(e.eventId);
 const merged=mergeCourtCoupReading(events.filter(e=>(e.monthIndex??e.year)<=month)),hidden=new Set<string>();
 for(const e of merged)if(e.metadata?.courtReadingKind==='COURT_COUP')for(const id of String(e.metadata.sourceEventIds).split(','))if(id!==e.id)hidden.add(id);
 const rows=merged.filter(e=>principal.has(e.id)||e.metadata?.courtReadingKind==='COURT_COUP'&&String(e.metadata.sourceEventIds).split(',').some(id=>principal.has(id))).map(e=>({id:e.id,month:e.monthIndex??e.year,text:e.metadata?.courtReadingKind==='COURT_COUP'?e.title:text.get(e.id)??e.title,sources:e.metadata?.courtReadingKind==='COURT_COUP'?String(e.metadata.sourceEventIds).split(','):[]}));
 const seen=new Set(rows.map(r=>r.id));for(const e of military)if(!seen.has(e.eventId)&&!hidden.has(e.eventId)&&e.worldMonth<=month){seen.add(e.eventId);rows.push({id:e.eventId,month:e.worldMonth,text:e.text,sources:[]});}
 return rows.sort((a,b)=>a.month-b.month||(order.get(a.id)??Infinity)-(order.get(b.id)??Infinity)).map(e=>({id:e.id,content:<><Typography fontSize=".82rem">{formatWorldDate(e.month)} · {e.text}</Typography>{e.sources.length>1&&<details><summary>相关变化与原始史事（{e.sources.length}）</summary>{e.sources.map(id=>{const source=byId.get(id);return source?<Typography key={id} fontSize=".76rem">{formatWorldDate(source.monthIndex??source.year)} · {source.title}<small>（{source.id}）</small></Typography>:null;})}</details>}</>}));
}
