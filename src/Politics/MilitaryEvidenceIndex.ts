import type {MilitaryPerson,MilitaryFormation} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
/** A read-only snapshot, scoped to one consumer. No global cache or canonical writes. */
export function createMilitaryEvidenceIndex(events:readonly WorldEvent[],formations:readonly MilitaryFormation[]){
 const byId=new Map<string,WorldEvent>(),allById=new Map<string,WorldEvent[]>(),byPerson=new Map<string,WorldEvent[]>(),starts=new Map<string,WorldEvent[]>(),ends=new Map<string,WorldEvent[]>(),byCommand=new Map<string,WorldEvent[]>(),formsByPerson=new Map<string,MilitaryFormation[]>();
 const add=<T,>(map:Map<string,T[]>,id:string,value:T)=>{const rows=map.get(id);if(rows)rows.push(value);else map.set(id,[value]);};
 for(const e of events){byId.set(e.id,e);add(allById,e.id,e);if(typeof e.metadata?.personId==='string')add(byPerson,e.metadata.personId,e);const battle=e.metadata?.battleId;if(typeof battle==='string'){if(e.type==='siege-started')add(starts,battle,e);if(e.type==='siege-ended')add(ends,battle,e);}}
 const sorted=[...events].sort((a,b)=>(a.monthIndex??a.year)-(b.monthIndex??b.year)),order=new Map(sorted.map((e,i)=>[e,i]));
 for(const e of sorted)add(byCommand,String(e.metadata?.commandId??''),e);
 for(const f of formations)add(formsByPerson,f.commanderPersonId,f);
 const commandEvents=(p:MilitaryPerson)=>[...new Set(p.appointments.map(a=>a.commandId))].flatMap(id=>byCommand.get(id)??[]).sort((a,b)=>order.get(a)!-order.get(b)!);
 return {byId,allById,byPerson,starts,ends,formsByPerson,commandEvents,dependencies(p:MilitaryPerson){
  const refs=new Set<WorldEvent>([...commandEvents(p),...(byPerson.get(p.personId)??[]),...p.capturedEventIds.flatMap(id=>allById.get(id)??[])]);
  for(const e of [...refs]){const id=e.metadata?.battleId;if(typeof id==='string'){for(const x of starts.get(id)??[])refs.add(x);for(const x of ends.get(id)??[])refs.add(x);}}
  return [...refs].sort((a,b)=>order.get(a)!-order.get(b)!);
 },eligibleCount(month:number){let a=0,b=sorted.length;while(a<b){const m=(a+b)>>>1;if((sorted[m].monthIndex??sorted[m].year)<=month)a=m+1;else b=m;}return a;}};
}
export type MilitaryEvidenceIndex=ReturnType<typeof createMilitaryEvidenceIndex>;
