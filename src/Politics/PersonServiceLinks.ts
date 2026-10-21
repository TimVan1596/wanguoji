import type {Ruler} from "./Dynasty";
import type {MilitaryPerson,MilitaryFormation} from "./MilitaryCommandRegistry";
import type {WorldEvent} from "../History/WorldHistory";
import {deriveMilitaryCareer} from "./MilitaryCareerEvidence";
import {deriveMilitaryChronicle} from "./MilitaryChronicle";

/** Half-open political/appointment intervals; overlap is not personal patronage. */
export function personServiceLinks(factionId:string,rulers:Ruler[],people:MilitaryPerson[],formations:MilitaryFormation[],events:WorldEvent[],month:number){
 const byId=new Map(events.map(e=>[e.id,e]));
 return people.filter(p=>p.appointments.some(a=>a.factionId===factionId)).flatMap(person=>{
  const victories=deriveMilitaryCareer(person,formations,events,month).capturedEventIds.map(id=>byId.get(id)!);
  return person.appointments.filter(a=>a.factionId===factionId).flatMap(a=>rulers.flatMap(r=>{
   if(r.accessionYear===undefined||r.reignOrdinal===undefined)return [];
   const start=Math.max(a.startMonth,r.accessionYear),end=Math.min(a.endMonth??month+1,r.endYear??month+1,month+1);
   if(start>=end)return [];
   const grants=(a.officeHistory??[]).filter(g=>g.month>=start&&g.month<end).flatMap(g=>{
    const e=byId.get(g.eventId);
    return e?.type==="military-office-granted"&&(e.monthIndex??e.year)===g.month&&e.metadata?.office===g.office&&e.rulerId===r.id&&e.actorFactionId===factionId&&e.metadata?.personId===person.personId&&e.metadata?.commandId===a.commandId?[e]:[];
   });
   const history=a.officeHistory??[];
   const offices=[...history.filter(g=>g.month<=start).slice(-1),...history.filter(g=>g.month>start&&g.month<end)];
   return [{factionId,personId:person.personId,rulerId:r.id,startMonth:start,endMonth:end-1,
    offices:[...new Set(offices.map(g=>g.office))],personalGrantEventIds:grants.map(e=>e!.id),
    victoryEventIds:victories.filter(e=>e.actorFactionId===factionId&&e.metadata?.commandId===a.commandId&&(e.monthIndex??e.year)>=start&&(e.monthIndex??e.year)<end).map(e=>e.id)}];
  }));
 });
}

export function preAccessionMilitary(ruler:Ruler,people:MilitaryPerson[],formations:MilitaryFormation[],events:WorldEvent[]){
 const id=ruler.residentIdentity,person=id?.military?people.find(p=>p.personId===id.personId&&id.military!.personId===p.personId&&p.sourceUserId===id.sourceUserId&&p.name===id.sourceUserLabel&&p.politicalRulerId===ruler.id&&p.bornMonth===ruler.bornYear&&id.bornMonth===p.bornMonth&&p.appointments.some(a=>a.commandId===id.military!.commandId&&a.factionId===id.sourceFactionId&&a.endMonth===id.foundedMonth&&a.endReason==="TRANSFERRED")):undefined;
 if(!person||ruler.accessionYear===undefined)return undefined;
 const entries=deriveMilitaryChronicle(person,formations,events,ruler.accessionYear).filter(e=>e.worldMonth<ruler.accessionYear!);
 return {person,entries,representative:[...new Map([...entries.slice(0,2),...entries.filter(e=>e.victory).slice(-1),...entries.slice(-2)].map(e=>[e.eventId,e])).values()].sort((a,b)=>a.worldMonth-b.worldMonth).slice(0,5)};
}
