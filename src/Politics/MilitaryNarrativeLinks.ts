import type {WorldEvent} from '../History/WorldHistory';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
const month=(e:WorldEvent)=>e.monthIndex??e.year;
const read=(v:unknown)=>{try{return typeof v==='string'?JSON.parse(v):undefined;}catch{return;}};
/** Explicit causal links plus immutable identity, never merely the same month/name. */
export function militaryNarrativeLinks(person:MilitaryPerson,events:readonly WorldEvent[]){
 const byId=new Map(events.map(e=>[e.id,e])),hidden=new Set<string>(),sources=new Map<string,string[]>();
 const hide=(anchor:string,other:string)=>{hidden.add(other);sources.set(anchor,[...(sources.get(anchor)??[]),other]);};
 for(const e of events){
  const m=e.metadata??{};
  if(['city-captured','city-recovered','capital-fallen'].includes(e.type)&&m.commanderPersonId===person.personId&&typeof m.siegeEndedEventId==='string'){
   const end=byId.get(m.siegeEndedEventId);
   if(end?.type==='siege-ended'&&end.metadata?.reason==='CAPTURED'&&end.metadata.battleId===m.battleId&&typeof m.battleId==='string'&&end.metadata.commandId===m.commandId&&end.metadata.personId===person.personId&&end.cityId===e.cityId&&end.actorFactionId===e.actorFactionId&&end.targetFactionId===(e.previousOwnerFactionId??e.targetFactionId)&&month(end)===month(e))hide(e.id,end.id);
  }
  if(e.type==='empire-split'&&m.militaryPersonId===person.personId&&m.foundingRulerId===person.politicalRulerId){
   const proof=read(m.militarySplitEvidence);
   if(proof?.personId===person.personId&&proof.worldMonth===month(e)&&proof.cityId===e.cityId&&proof.sourceFactionId===e.targetFactionId)
    for(const end of events)if(end.type==='military-command-ended'&&end.metadata?.personId===person.personId&&end.metadata.commandId===proof.commandId&&end.metadata.endReason==='TRANSFERRED'&&end.actorFactionId===proof.sourceFactionId&&month(end)===month(e))hide(e.id,end.id);
  }
  if(e.type==='dynasty-usurped'&&m.militaryUsurperPersonId===person.personId&&e.rulerId===person.politicalRulerId){const proof=read(m.militaryUsurperIdentity);for(const end of events)if(proof?.personId===person.personId&&end.type==='military-command-ended'&&end.metadata?.personId===person.personId&&end.metadata.commandId===proof.commandId&&end.metadata.endReason==='DISMISSED'&&month(end)===month(e))hide(e.id,end.id);}
  if(e.type==='military-person-died'&&m.personId===person.personId){
   for(const end of events)if(end.type==='military-command-ended'&&end.metadata?.personId===person.personId&&end.metadata.endReason==='DEATH'&&end.actorFactionId===e.actorFactionId&&month(end)===month(e)&&person.appointments.some(a=>a.commandId===end.metadata?.commandId&&a.factionId===e.actorFactionId&&a.endMonth===month(e)&&a.endReason==='DEATH'))hide(e.id,end.id);
   for(const other of events){
    const a=other.type==='military-appanage'?read(other.metadata?.appanage):undefined;
    if(a?.kind==='ENDED'&&a.reason==='DEATH'&&a.sourceEventId===e.id&&a.personId===person.personId&&a.eventId===other.id&&other.metadata?.personId===person.personId&&a.month===month(other))hide(e.id,other.id);
    const end=typeof other.metadata?.commandEndEventId==='string'?byId.get(other.metadata.commandEndEventId):undefined;
    if(other.type==='siege-ended'&&(other.metadata?.reason==='COMMAND_ENDED'||other.metadata?.reason==='REPULSED'&&other.metadata?.attackers===0)&&end?.type==='military-command-ended'&&end.metadata?.personId===person.personId&&end.metadata.endReason==='DEATH'&&end.metadata.commandId===other.metadata.commandId&&month(end)===month(e)&&month(other)>=month(e)&&other.metadata.personId===person.personId&&other.actorFactionId===e.actorFactionId)hide(e.id,other.id);
   }
  }
 }
 return {hidden,sources};
}
