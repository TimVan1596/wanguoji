import type {Dynasty} from "./Dynasty";
import type {MilitaryPerson} from "./MilitaryCommandRegistry";
import type {WorldEvent} from "../History/WorldHistory";
import {buildPoliticalGenealogy} from "./DynasticCandidateRules";
import {MILITARY_OFFICES,MILITARY_OFFICE_NAMES} from "./MilitaryOffice";

/** Permanent identity proof; retirement, death and dynasty replacement do not revoke an archive link. */
export function royalMilitaryArchive(dynasty:Pick<Dynasty,"factionId"|"rulers">,people:readonly MilitaryPerson[],events:readonly WorldEvent[]){
 const byPerson=new Map(people.map(p=>[p.personId,p])),appointments=new Map(events.filter(e=>e.type==="military-appointment").map(e=>[String(e.metadata?.commandId),e]));
 const result=new Map<string,MilitaryPerson>();
 for(const r of dynasty.rulers){
  const i=r.militaryIdentity,p=i&&byPerson.get(i.personId),a=p?.appointments[0],event=a&&appointments.get(a.commandId);
  if(i&&p&&p.royalIdentity?.rulerId===r.id&&p.royalIdentity.factionId===dynasty.factionId&&p.sourceUserId===i.sourceUserId&&p.name===i.sourceUserLabel&&p.bornMonth===r.bornYear&&p.royalIdentity.naturalDeathMonth===r.naturalDeathYear&&
   a?.factionId===dynasty.factionId&&a.startMonth===i.enteredMonth&&event?.actorFactionId===dynasty.factionId&&(event.monthIndex??event.year)===i.enteredMonth&&event.metadata?.personId===p.personId&&event.metadata?.royalRulerId===r.id&&event.metadata?.sourceUserId===p.sourceUserId)result.set(r.id,p);
 }
 return result;
}
/** Display inclusion only. These IDs never enter the simulation's succession candidate pool. */
export function buildRoyalArchiveGenealogy(dynasty:Dynasty,people:readonly MilitaryPerson[],events:readonly WorldEvent[]){
 const military=royalMilitaryArchive(dynasty,people,events);
 return buildPoliticalGenealogy(dynasty.rulers,dynasty.currentRulerId,dynasty.designatedHeirId,[...dynasty.heirIds,...military.keys()]);
}
export function royalMilitaryOfficeLabel(person:MilitaryPerson,month:number,factionId=person.royalIdentity?.factionId){
 const local=person.appointments.filter(a=>a.factionId===factionId&&a.startMonth<=month);
 const active=person.status==="ACTIVE"?local.find(a=>a.endMonth===undefined):undefined;
 const current=active?.officeHistory?.filter(g=>g.month<=month).at(-1);
 const highest=local.flatMap(a=>(a.officeHistory??[]).filter(g=>g.month<=month)).sort((a,b)=>MILITARY_OFFICES.indexOf(b.office)-MILITARY_OFFICES.indexOf(a.office))[0];
 return current?`现役${MILITARY_OFFICE_NAMES[current.office]}`:highest?`曾任${MILITARY_OFFICE_NAMES[highest.office]}`:undefined;
}
export function militaryIdentityLabels(person:MilitaryPerson,dynasties:readonly Dynasty[],events:readonly WorldEvent[],month:number){
 const labels:string[]=[];
 if(!person.royalIdentity&&!person.politicalRulerId)return labels;
 const origin=person.royalIdentity&&dynasties.find(d=>d.factionId===person.royalIdentity!.factionId);
 if(origin&&royalMilitaryArchive(origin,[person],events).has(person.royalIdentity!.rulerId))labels.push("宗室将领");
 const political=person.politicalRulerId?dynasties.flatMap(d=>d.rulers.map(r=>({d,r}))).find(({r})=>r.id===person.politicalRulerId&&r.bornYear===person.bornMonth&&
  (r.militaryIdentity?.personId===person.personId||r.residentIdentity?.personId===person.personId&&r.residentIdentity.sourceUserId===person.sourceUserId)):undefined;
 if(political&&political.r.accessionYear!==undefined&&political.r.accessionYear<=month){
  labels.push(political.d.currentRulerId===political.r.id&&(political.r.deathMonth===undefined||political.r.deathMonth>month)&&["ruling","exiled"].includes(political.r.status)?"现任君主":"曾任君主");
  if(person.royalIdentity)labels.push("后来继位");
  const source=political.r.residentIdentity;
  if(source?.military?.personId===person.personId&&source.bornMonth===person.bornMonth&&events.some(e=>e.type==="empire-split"&&e.actorFactionId===political.d.factionId&&e.metadata?.militaryPersonId===person.personId&&e.metadata?.foundingRulerId===political.r.id))labels.push("义军创立者");
 }
 return labels;
}
