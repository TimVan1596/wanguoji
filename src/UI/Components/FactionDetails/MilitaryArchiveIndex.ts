import type {WorldEvent} from '../../../History/WorldHistory';
/** One immutable event snapshot per UI revision; no simulation state or cross-world cache. */
export function createMilitaryArchiveIndex(events:WorldEvent[]){
 const factions=new Map<string,WorldEvent[]>(),order=new Map<string,number>();
 events.forEach((e,i)=>{order.set(e.id,i);for(const id of new Set([...(e.factionIds??[]),e.actorFactionId,e.targetFactionId].filter((s):s is string=>!!s))){const list=factions.get(id)??[];list.push(e);factions.set(id,list);}});
 return {factions,related(countries:Set<string>){const rows=new Map<string,WorldEvent>();for(const id of countries)for(const e of factions.get(id)??[])rows.set(e.id,e);return [...rows.values()].sort((a,b)=>order.get(a.id)!-order.get(b.id)!);}};
}
