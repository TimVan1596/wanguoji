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
 return [...new Set([...Object.entries(event.metadata??{}).filter(([key])=>/rulerName|personName|personalName|commanderName|heirName|leaderName/i.test(key)).map(([,v])=>v)].filter((v):v is string=>typeof v==="string"&&v.length>1))];
}

/** Conservative narrative boundaries: a faction name inside an unlabelled personal name is not a link. */
export function standaloneFactionMention(text:string,start:number,length:number){
 const before=text.slice(0,start),after=text.slice(start+length);
 const han=/[\u3400-\u9fff]/;
 if(after&&han.test(after[0])&&!/^(国|朝|义军|军|王|皇帝|首领|政权|都城|攻|围|收复|陷|失|灭|覆|与|向|于|遭|被|由|在|自|以|遣|建立|更|复|宣布|册|降|归|并|分|接|继|战|迁|结束|领土|阵亡|俘)/.test(after))return false;
 if(before&&han.test(before.at(-1)!)&&!/(于|向|为|由|对|与|属|从|归|及|同|复|并|入|了|攻陷|收复|吞并|灭亡|册立|出自|来自|脱离)$/.test(before))return false;
 return true;
}
