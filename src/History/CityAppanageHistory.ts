import type {MilitaryPerson} from '../Politics/MilitaryCommandRegistry';
import {appanageChanges,type MilitaryAppanage} from '../Politics/MilitaryAppanage';
import type {WorldEvent} from './WorldHistory';
/** Read-only cityId projection. A title promotion is not another appanage grant. */
export function cityAppanageHistory(cityId:string,people:MilitaryPerson[],events:WorldEvent[],month:number){
 const byId=new Map(events.map((event,index)=>[event.id,{event,index}])),seen=new Set<string>();
 const entries:Array<{person:MilitaryPerson;record:MilitaryAppanage;rank:MilitaryAppanage['rank'];sourceOrder:number;recordOrder:number}>=[];
 for(const person of people){
  const records=(person.appanageHistory??[]).filter(a=>a.cityId===cityId&&a.month<=month&&a.personId===person.personId).filter(a=>{const e=byId.get(a.eventId)?.event;return e?.type==='military-appanage'&&e.actorFactionId===a.factionId&&e.cityId===cityId&&e.metadata?.personId===person.personId&&e.metadata?.appanage===JSON.stringify(a)&&(e.monthIndex??e.year)===a.month;});
  const grants=new Map(records.filter(a=>a.kind==='GRANTED'&&a.grantEventId===a.eventId).map(a=>[a.eventId,a]));
  for(const record of records){
   const grant=grants.get(record.grantEventId);if(!byId.has(record.sourceEventId)||(byId.get(record.sourceEventId)!.event.monthIndex??byId.get(record.sourceEventId)!.event.year)>record.month||!grant||seen.has(record.eventId)||grant.factionId!==record.factionId||grant.epochFounderId!==record.epochFounderId)continue;
   const first=person.nobilityHistory?.find(g=>g.eventId===grant.nobleGrantEventId),firstRef=first&&byId.get(first.eventId);if(!first||first.personId!==person.personId||firstRef?.event.type!=='military-ennobled'||firstRef.event.metadata?.nobility!==JSON.stringify(first))continue;
   const ordinal=byId.get(record.eventId)!.index;
   const titles=(person.nobilityHistory??[]).filter(g=>g.factionId===record.factionId&&g.epochFounderId===record.epochFounderId&&g.month<=record.month&&!!byId.get(g.eventId)&&byId.get(g.eventId)!.index<ordinal&&byId.get(g.eventId)!.event.type==='military-ennobled'&&byId.get(g.eventId)!.event.metadata?.nobility===JSON.stringify(g)).sort((a,b)=>a.month-b.month||byId.get(a.eventId)!.index-byId.get(b.eventId)!.index);
   if(!titles.length)continue;seen.add(record.eventId);entries.push({person,record,rank:titles.at(-1)!.rank,sourceOrder:byId.get(record.sourceEventId)?.index??ordinal,recordOrder:ordinal});
  }
 }
 entries.sort((a,b)=>a.record.month-b.record.month||a.sourceOrder-b.sourceOrder||a.recordOrder-b.recordOrder);
 const grants=entries.filter(e=>e.record.kind==='GRANTED'),latest=new Map<string,typeof entries[number]>();for(const e of entries)latest.set(e.record.grantEventId,e);
 const current=[...latest.values()].filter(e=>{const last=appanageChanges(e.person,e.record,events,month).at(-1)??e.record;return last.kind==='GRANTED'||last.kind==='RESTORED';});
 return {entries,grants:grants.length,people:new Set(grants.map(g=>g.person.personId)).size,current};
}
