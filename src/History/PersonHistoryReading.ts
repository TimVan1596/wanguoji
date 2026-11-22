import type {WorldEvent} from './WorldHistory';
/** Projection only. Exact IDs and identity evidence, never shared names/months, join one process. */
export function personHistoryReading(events:readonly WorldEvent[]){
 const byId=new Map(events.map(e=>[e.id,e])),hidden=new Set<string>(),sources=new Map<string,string[]>(),order=new Map(events.map((e,i)=>[e.id,i]));
 const appointmentKey=(e:WorldEvent)=>JSON.stringify([e.metadata?.personId,e.metadata?.commandId,e.monthIndex??e.year]);
 const projected=new Map<string,WorldEvent>();
 const civilEndByPersonMonth=new Map<string,WorldEvent[]>();
 for(const e of events)if(e.type==='civil-governor-ended'&&typeof e.metadata?.personId==='string'){const key=JSON.stringify([e.metadata.personId,e.monthIndex??e.year]),rows=civilEndByPersonMonth.get(key)??[];rows.push(e);civilEndByPersonMonth.set(key,rows);}
 const initialAppointments=new Map<string,WorldEvent>();for(const e of events)if(e.type==='military-appointment')initialAppointments.set(appointmentKey(e),e);
 for(const e of events){
  if(['military-order-issued','leader-command-order','civil-governor-effect'].includes(e.type))hidden.add(e.id);
  if(e.type==='city-captured'&&typeof e.metadata?.siegeEndedEventId==='string'){
   const end=byId.get(e.metadata.siegeEndedEventId);
   if(end?.type==='siege-ended'&&end.metadata?.reason==='CAPTURED'&&end.cityId===e.cityId&&(end.monthIndex??end.year)===(e.monthIndex??e.year)&&end.actorFactionId===e.actorFactionId&&end.metadata?.commandId===e.metadata.commandId&&(end.metadata?.personId??end.metadata?.commanderPersonId)===e.metadata.commanderPersonId&&end.metadata?.battleId===e.metadata.battleId&&typeof e.metadata.battleId==='string'){
    hidden.add(end.id);sources.set(e.id,[end.id,e.id].sort((a,b)=>order.get(a)!-order.get(b)!));
   }
  }
  if(e.type==='civil-governor-appointed'&&typeof e.metadata?.term==='string'){
   try{const t=JSON.parse(e.metadata.term),from=t.promotion?.fromAssignmentId??t.transfer?.fromAssignmentId,end=civilEndByPersonMonth.get(JSON.stringify([t.personId,e.monthIndex??e.year]))?.find(old=>old.metadata?.assignmentId===from&&old.actorFactionId===e.actorFactionId&&['PROMOTED','TRANSFERRED'].includes(String(old.metadata?.endReason)));
    if(end&&(order.get(end.id)??Infinity)<order.get(e.id)!){hidden.add(end.id);sources.set(e.id,[end.id,e.id]);}
   }catch{/* Invalid technical payload remains visible; strict persistence rejects it. */}
  }
  if(e.type==='military-person-died'&&typeof e.metadata?.personId==='string'){
   const ends=civilEndByPersonMonth.get(JSON.stringify([e.metadata.personId,e.monthIndex??e.year]))?.filter(old=>old.metadata?.endReason==='DEATH')??[];
   if(ends.length===1){const end=ends[0];hidden.add(e.id);sources.set(end.id,[e.id,end.id].sort((a,b)=>order.get(a)!-order.get(b)!));projected.set(end.id,{...end,title:end.title.replace('卒，离任','卒于') .replace(/。$/,'任内。')});}
  }
  if(e.type==='military-office-granted'){
   const initial=typeof e.metadata?.personId==='string'&&typeof e.metadata?.commandId==='string'?initialAppointments.get(appointmentKey(e)):undefined;
   if(initial){hidden.add(initial.id);sources.set(e.id,[initial.id,e.id].sort((a,b)=>order.get(a)!-order.get(b)!));}
  }
 }
 const visible:WorldEvent[]=[];for(const e of events)if(!hidden.has(e.id))visible.push(projected.get(e.id)??e);return {hidden,sources,events:visible};
}
