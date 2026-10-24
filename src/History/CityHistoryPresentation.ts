import type {CityHistoryEvent} from '../Components/City';
import type {WorldEvent} from './WorldHistory';

/** Read-only folding. Ambiguous or incomplete evidence always remains visible. */
export function importantCityHistory(history:readonly CityHistoryEvent[],events:readonly WorldEvent[],cityId:string){
 const sources=events.filter(e=>e.cityId===cityId&&['siege-started','siege-ended'].includes(e.type));
 const hidden=new Set<WorldEvent>(),byBattle=new Map<string,WorldEvent[]>(),byRow=new Map<string,WorldEvent[]>();
 const key=(type:string,month:number,title:string)=>JSON.stringify([type,month,title]);
 for(const e of sources){const k=key(e.type,e.monthIndex??e.year,e.title);byRow.set(k,[...(byRow.get(k)??[]),e]);if(e.type==='siege-started'&&typeof e.metadata?.battleId==='string'){const id=e.metadata.battleId;byBattle.set(id,[...(byBattle.get(id)??[]),e]);}}
 for(const end of sources){
  const m=end.metadata;if(end.type!=='siege-ended'||m?.reason!=='CONTACT_ENDED'||typeof m.battleId!=='string')continue;
  const starts=byBattle.get(m.battleId)??[];
  if(starts.length!==1)continue;
  const start=starts[0],duration=(end.monthIndex??end.year)-(start.monthIndex??start.year)+1;
  if(duration<1||duration>=6||start.actorFactionId!==end.actorFactionId||start.targetFactionId!==end.targetFactionId||start.metadata?.commandId!==m.commandId)continue;
  hidden.add(start);hidden.add(end);
 }
 return history.filter(h=>{
  const matches=byRow.get(key(h.type,h.year,h.title))??[];
  return matches.length!==1||!hidden.has(matches[0]);
 });
}
