import {personHistoryReading} from '../../../History/PersonHistoryReading';
import {mergeCourtCoupReading} from '../../../History/CourtCoupReading';
import {Typography} from '@mui/material';
import type {WorldEvent} from '../../../History/WorldHistory';
import {formatWorldDate} from '../../../Simulation/WorldTime';
/** One read-only index for the caller's immutable world/revision/month window. Never trusted by simulation. */
export function createPersonCareerIndex(events:readonly WorldEvent[]){
 const byId=new Map(events.map(e=>[e.id,e])),order=new Map(events.map((e,i)=>[e.id,i])),principal=new Map<string,Set<string>>();
 for(const e of events)for(const id of [e.metadata?.personId,e.metadata?.commanderPersonId,e.metadata?.militaryPersonId])if(typeof id==='string'){const rows=principal.get(id)??new Set<string>();rows.add(e.id);principal.set(id,rows);}
 const reading=personHistoryReading(events),visible=mergeCourtCoupReading(reading.events),shown=new Map(visible.map(e=>[e.id,e])),groupBySource=new Map<string,WorldEvent>();
 for(const e of visible)if(e.metadata?.courtReadingKind==='COURT_COUP')for(const id of String(e.metadata.sourceEventIds).split(','))groupBySource.set(id,e);
 for(const [anchor,ids] of reading.sources){const event=shown.get(anchor);if(event)for(const id of ids)groupBySource.set(id,event);}
 return {events,byId,order,principal,shown,groupBySource,reading};
}
export type PersonCareerIndex=ReturnType<typeof createPersonCareerIndex>;
/** Saved insertion order breaks ties within an actual month; names and shared dates never define identity. */
export function personCareerEvents(events:readonly WorldEvent[],personId:string,month:number){
 return events.map((event,order)=>({event,order})).filter(({event:e})=>(e.monthIndex??e.year)<=month&&[e.metadata?.personId,e.metadata?.commanderPersonId,e.metadata?.militaryPersonId].includes(personId)).sort((a,b)=>(a.event.monthIndex??a.event.year)-(b.event.monthIndex??b.event.year)||a.order-b.order).map(({event})=>event);
}
export function personCareerMilestones(events:readonly WorldEvent[],personId:string,month:number,military:readonly {eventId:string;worldMonth:number;text:string}[]=[],index=createPersonCareerIndex(events)){
 const text=new Map(military.map(e=>[e.eventId,e.text])),ids=new Set(index.principal.get(personId)??[]);for(const e of military)if(e.worldMonth<=month)ids.add(e.eventId);
 const rows:Array<{id:string;month:number;text:string;sources:string[]}>=[],seen=new Set<string>();
 for(const id of ids){if(index.reading.hidden.has(id)&&!index.groupBySource.has(id))continue;const e=index.groupBySource.get(id)??index.shown.get(id);
  if(e){if(seen.has(e.id)||(e.monthIndex??e.year)>month)continue;seen.add(e.id);const grouped=e.metadata?.courtReadingKind==='COURT_COUP';rows.push({id:e.id,month:e.monthIndex??e.year,text:grouped?e.title:text.get(e.id)??e.title,sources:grouped?String(e.metadata?.sourceEventIds).split(','):index.reading.sources.get(e.id)??[]});}
  else {const original=military.find(e=>e.eventId===id);if(original&&original.worldMonth<=month&&!seen.has(id)){seen.add(id);rows.push({id,month:original.worldMonth,text:original.text,sources:[]});}}
 }
 return rows.sort((a,b)=>a.month-b.month||(index.order.get(a.id)??Infinity)-(index.order.get(b.id)??Infinity)).map(e=>({id:e.id,sourceIds:e.sources.length?e.sources:[e.id],content:<Typography fontSize=".82rem">{formatWorldDate(e.month)}，{e.text}</Typography>}));
}
