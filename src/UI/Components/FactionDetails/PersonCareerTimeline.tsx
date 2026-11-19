import {mergeCourtCoupReading} from '../../../History/CourtCoupReading';
import {Typography} from '@mui/material';
import type {WorldEvent} from '../../../History/WorldHistory';
import {formatWorldDate} from '../../../Simulation/WorldTime';
/** One read-only index for the caller's immutable world/revision/month window. Never trusted by simulation. */
export function createPersonCareerIndex(events:readonly WorldEvent[]){
 const byId=new Map(events.map(e=>[e.id,e])),order=new Map(events.map((e,i)=>[e.id,i])),principal=new Map<string,Set<string>>();
 for(const e of events)for(const id of [e.metadata?.personId,e.metadata?.commanderPersonId,e.metadata?.militaryPersonId])if(typeof id==='string'){const rows=principal.get(id)??new Set<string>();rows.add(e.id);principal.set(id,rows);}
 const visible=mergeCourtCoupReading(events),shown=new Map(visible.map(e=>[e.id,e])),groupBySource=new Map<string,WorldEvent>();
 for(const e of visible)if(e.metadata?.courtReadingKind==='COURT_COUP')for(const id of String(e.metadata.sourceEventIds).split(','))groupBySource.set(id,e);
 return {events,byId,order,principal,shown,groupBySource};
}
export type PersonCareerIndex=ReturnType<typeof createPersonCareerIndex>;
/** Saved insertion order breaks ties within an actual month; names and shared dates never define identity. */
export function personCareerEvents(events:readonly WorldEvent[],personId:string,month:number){
 return events.map((event,order)=>({event,order})).filter(({event:e})=>(e.monthIndex??e.year)<=month&&[e.metadata?.personId,e.metadata?.commanderPersonId,e.metadata?.militaryPersonId].includes(personId)).sort((a,b)=>(a.event.monthIndex??a.event.year)-(b.event.monthIndex??b.event.year)||a.order-b.order).map(({event})=>event);
}
export function personCareerMilestones(events:readonly WorldEvent[],personId:string,month:number,military:readonly {eventId:string;worldMonth:number;text:string}[]=[],index=createPersonCareerIndex(events)){
 const text=new Map(military.map(e=>[e.eventId,e.text])),ids=new Set(index.principal.get(personId)??[]);for(const e of military)if(e.worldMonth<=month)ids.add(e.eventId);
 const rows:Array<{id:string;month:number;text:string;sources:string[]}>=[],seen=new Set<string>();
 for(const id of ids){const e=index.groupBySource.get(id)??index.shown.get(id);
  if(e){if(seen.has(e.id)||(e.monthIndex??e.year)>month)continue;seen.add(e.id);const grouped=e.metadata?.courtReadingKind==='COURT_COUP';rows.push({id:e.id,month:e.monthIndex??e.year,text:grouped?e.title:text.get(e.id)??e.title,sources:grouped?String(e.metadata?.sourceEventIds).split(','):[]});}
  else {const original=military.find(e=>e.eventId===id);if(original&&original.worldMonth<=month&&!seen.has(id)){seen.add(id);rows.push({id,month:original.worldMonth,text:original.text,sources:[]});}}
 }
 return rows.sort((a,b)=>a.month-b.month||(index.order.get(a.id)??Infinity)-(index.order.get(b.id)??Infinity)).map(e=>({id:e.id,content:<><Typography fontSize=".82rem">{formatWorldDate(e.month)} · {e.text}</Typography>{e.sources.length>1&&<details><summary>相关变化与原始史事（{e.sources.length}）</summary>{e.sources.map(id=>{const source=index.byId.get(id);return source?<Typography key={id} fontSize=".76rem">{formatWorldDate(source.monthIndex??source.year)} · {source.title}<small>（{source.id}）</small></Typography>:null;})}</details>}</>}));
}
