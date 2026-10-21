import type {WorldEvent} from "./WorldHistory";
import {getEventFactionIds,resolveFactionHistoricalName,type HistoryFactionLike} from "./HistoryRenderRules";

/** Event-local aliases only. Duplicate names and city collisions never choose a faction by luck. */
export function historyFactionMentions(event:WorldEvent,factions:Map<string,HistoryFactionLike>,cities:readonly string[]){
 const aliases=new Map<string,Set<string>>(),at=event.monthIndex??event.year;
 const add=(name:string,id:string)=>{if(!name||!factions.has(id)||cities.includes(name))return;const ids=aliases.get(name)??new Set();ids.add(id);aliases.set(name,ids);};
 const ids=[...getEventFactionIds(event),event.metadata?.commonThreatFactionId].filter((id):id is string=>typeof id==="string"&&factions.has(id));
 for(const id of ids)add(resolveFactionHistoricalName(factions,id,at),id);
 if(event.type==="dynasty-usurped"&&event.actorFactionId)for(const key of ["oldStateName","newStateName"])if(typeof event.metadata?.[key]==="string")add(String(event.metadata[key]),event.actorFactionId);
 return new Map([...aliases].flatMap(([name,ids])=>ids.size===1?[[name,[...ids][0]] as const]:[]));
}
/** Long personal names suppress substring links, including a one-character state matching a surname. */
export function historyProtectedNames(event:WorldEvent){
 return [...new Set([event.rulerName,...Object.entries(event.metadata??{}).filter(([key])=>/rulerName|personName|personalName|commanderName|heirName|leaderName/i.test(key)).map(([,v])=>v)].filter((v):v is string=>typeof v==="string"&&v.length>1))];
}
