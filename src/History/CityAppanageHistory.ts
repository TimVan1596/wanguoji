import {readMilitaryParticipation} from '../Politics/MilitaryPoliticalInfluence';
import type {MilitaryPerson} from '../Politics/MilitaryCommandRegistry';
import {appanageChanges,type MilitaryAppanage} from '../Politics/MilitaryAppanage';
import type {WorldEvent} from './WorldHistory';
/** One shared read index, retaining original transaction order for loss/recovery ties. */
export function prepareAppanageHistory(events:WorldEvent[]){
 const byId=new Map(events.map((event,index)=>[event.id,{event,index}])),cities=new Map<string,WorldEvent[]>(),persons=new Map<string,WorldEvent[]>(),rulers=new Map<string,WorldEvent[]>(),states=new Map<string,WorldEvent[]>();
 const add=(map:Map<string,WorldEvent[]>,id:unknown,e:WorldEvent)=>{if(typeof id!=='string')return;const rows=map.get(id)??[];rows.push(e);map.set(id,rows);};
 for(const e of events){add(cities,e.cityId,e);for(const id of new Set([e.metadata?.personId,e.metadata?.commanderPersonId,e.metadata?.militaryPersonId,e.metadata?.militaryUsurperPersonId,readMilitaryParticipation(e)?.participant.personId]))add(persons,id,e);for(const id of new Set([e.rulerId,e.metadata?.nextRulerId]))add(rulers,id,e);if(['dynasty-usurped','faction-exiled','faction-extinct','faction-submitted','faction-merged'].includes(e.type))for(const id of new Set([e.actorFactionId,e.targetFactionId]))add(states,id,e);}
 return {events,byId,personEvents(id:string){return persons.get(id)??[];},related(person:MilitaryPerson,record:MilitaryAppanage){return [...new Set([...(cities.get(record.cityId)??[]),...(persons.get(person.personId)??[]),...(rulers.get(person.politicalRulerId??'')??[]),...(rulers.get(person.royalIdentity?.rulerId??'')??[]),...(states.get(record.factionId)??[])])].sort((a,b)=>byId.get(a.id)!.index-byId.get(b.id)!.index);}};
}
/** Read-only cityId projection. A title promotion is not another appanage grant. */
export function cityAppanageHistory(cityId:string,people:MilitaryPerson[],events:WorldEvent[],month:number,prepared=prepareAppanageHistory(events)){
 const byId=prepared.byId,seen=new Set<string>();
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
 const relations=grants.map(grant=>{const timeline=entries.filter(e=>e.record.grantEventId===grant.record.eventId),lastEntry=latest.get(grant.record.eventId)!,last=appanageChanges(grant.person,lastEntry.record,prepared.related(grant.person,lastEntry.record),month).at(-1)??lastEntry.record;return {grant,timeline,last,state:last.kind==='ENDED'?'ENDED' as const:last.kind==='LOST'?'LOST' as const:'ACTIVE' as const,endMonth:last.kind==='ENDED'?last.month:undefined};});
 const current=relations.filter(r=>r.state==='ACTIVE').map(r=>latest.get(r.grant.record.eventId)!);
 return {prepared,entries,relations,grants:grants.length,people:new Set(grants.map(g=>g.person.personId)).size,current};
}

export type AppanageHistoryIndex=ReturnType<typeof prepareAppanageHistory>;
