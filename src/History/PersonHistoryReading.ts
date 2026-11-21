import type {WorldEvent} from './WorldHistory';
/** Projection only. Exact IDs and identity evidence, never shared names/months, join one process. */
export function personHistoryReading(events:readonly WorldEvent[]){
 const byId=new Map(events.map(e=>[e.id,e])),hidden=new Set<string>(),sources=new Map<string,string[]>(),order=new Map(events.map((e,i)=>[e.id,i]));
 const appointmentKey=(e:WorldEvent)=>JSON.stringify([e.metadata?.personId,e.metadata?.commandId,e.monthIndex??e.year]);
 const initialAppointments=new Map(events.filter(e=>e.type==='military-appointment').map(e=>[appointmentKey(e),e]));
 for(const e of events){
  if(['military-order-issued','leader-command-order','civil-governor-effect'].includes(e.type))hidden.add(e.id);
  if(e.type==='city-captured'&&typeof e.metadata?.siegeEndedEventId==='string'){
   const end=byId.get(e.metadata.siegeEndedEventId);
   if(end?.type==='siege-ended'&&end.metadata?.reason==='CAPTURED'&&end.cityId===e.cityId&&(end.monthIndex??end.year)===(e.monthIndex??e.year)&&end.metadata?.battleId===e.metadata.battleId&&typeof e.metadata.battleId==='string'){
    hidden.add(end.id);sources.set(e.id,[end.id,e.id].sort((a,b)=>order.get(a)!-order.get(b)!));
   }
  }
  if(e.type==='military-office-granted'){
   const initial=typeof e.metadata?.personId==='string'&&typeof e.metadata?.commandId==='string'?initialAppointments.get(appointmentKey(e)):undefined;
   if(initial){hidden.add(initial.id);sources.set(e.id,[initial.id,e.id].sort((a,b)=>order.get(a)!-order.get(b)!));}
  }
 }
 return {hidden,sources,events:events.filter(e=>!hidden.has(e.id))};
}
