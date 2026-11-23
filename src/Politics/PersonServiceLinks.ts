import {civilOfficeTitle} from './CivilOffice';
import {MILITARY_OFFICE_NAMES} from './MilitaryOffice';
import {createMilitaryEvidenceIndex} from './MilitaryEvidenceIndex';
import {militaryMilestones,selectMilitaryMilestones} from "./MilitaryChroniclePresentation";
import type {Ruler} from "./Dynasty";
import type {MilitaryPerson,MilitaryFormation} from "./MilitaryCommandRegistry";
import type {WorldEvent} from "../History/WorldHistory";
import {deriveMilitaryCareer} from "./MilitaryCareerEvidence";
import {type MilitaryHistoryContext,deriveMilitaryChronicle} from "./MilitaryChronicle";

/** Half-open political/appointment intervals; overlap is not personal patronage. */
export function personServiceLinks(factionId:string,rulers:Ruler[],people:MilitaryPerson[],formations:MilitaryFormation[],events:WorldEvent[],month:number){
 const byId=new Map(events.map(e=>[e.id,e]));
 const overlapping=people.filter(p=>p.appointments.some(a=>a.factionId===factionId&&rulers.some(r=>r.reignOrdinal!==undefined&&r.accessionYear!==undefined&&Math.max(a.startMonth,r.accessionYear)<Math.min(a.endMonth??month+1,r.endYear??month+1,month+1))));
 if(!overlapping.length)return [];
 const evidence=createMilitaryEvidenceIndex(events,formations);
 return overlapping.flatMap(person=>{
  const victories=deriveMilitaryCareer(person,formations,events,month,evidence).capturedEventIds.map(id=>byId.get(id)!);
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

export function preAccessionMilitary(ruler:Ruler,people:MilitaryPerson[],formations:MilitaryFormation[],events:WorldEvent[],context:MilitaryHistoryContext={}){
 const id=ruler.residentIdentity,founder=id?.military?people.find(p=>p.personId===id.personId&&id.military!.personId===p.personId&&p.sourceUserId===id.sourceUserId&&p.name===id.sourceUserLabel&&p.politicalRulerId===ruler.id&&p.bornMonth===ruler.bornYear&&id.bornMonth===p.bornMonth&&p.appointments.some(a=>a.commandId===id.military!.commandId&&a.factionId===id.sourceFactionId&&a.endMonth===id.foundedMonth&&a.endReason==="TRANSFERRED")):undefined;
 const royal=ruler.militaryIdentity;
 const usurper=ruler.militaryUsurperIdentity,officer=usurper?people.find(p=>p.personId===usurper.personId&&p.sourceUserId===usurper.sourceUserId&&p.bornMonth===ruler.bornYear&&p.politicalRulerId===ruler.id):undefined;
 const person=officer??founder??(royal?people.find(p=>p.personId===royal.personId&&p.royalIdentity?.rulerId===ruler.id&&p.sourceUserId===royal.sourceUserId&&p.name===royal.sourceUserLabel&&p.bornMonth===ruler.bornYear&&p.politicalRulerId===ruler.id):undefined);
 if(!person||ruler.accessionYear===undefined)return undefined;
 const raw=deriveMilitaryChronicle(person,formations,events,ruler.accessionYear).filter(e=>e.worldMonth<ruler.accessionYear!||e.worldMonth===ruler.accessionYear&&(e.source.startsWith("empire-split")||e.source.startsWith("dynasty-usurped")||e.source.startsWith("military-ennobled")));
 const entries=militaryMilestones(person,raw,events,context);
 const representative=selectMilitaryMilestones(entries,events,5);
 return {person,entries,representative};
}

/** One public service chronology over real civil and military appointments. No patronage inferred. */
export function unifiedPersonServiceLinks(personId:string,terms:readonly import('./CivilAdministrationSchema').CivilGovernorTerm[],people:readonly MilitaryPerson[],dynasties:readonly import('./Dynasty').Dynasty[],events:readonly WorldEvent[],month:number){
 const lifeByFaction=new Map<string,WorldEvent[]>();for(const e of events){const id=e.type==='faction-restored'?e.actorFactionId:['faction-exiled','faction-extinct'].includes(e.type)?e.targetFactionId:undefined;if(id){const list=lifeByFaction.get(id)??[];list.push(e);lifeByFaction.set(id,list);}}
 const person=people.find(p=>p.personId===personId),byId=new Map(events.map(e=>[e.id,e]));
 const appointments=[...(person?.appointments??[]).filter(a=>a.startMonth<=month).map(a=>({factionId:a.factionId,start:a.startMonth,end:Math.min(a.endMonth??month+1,month+1),officeNames:(a.officeHistory??[]).filter(g=>g.month<=month).map(g=>({month:g.month,name:MILITARY_OFFICE_NAMES[g.office]})),sourceIds:[`military-appointment-${a.commandId}`,...(a.officeHistory??[]).map(g=>g.eventId)],appointedBy:undefined as string|undefined})),...terms.filter(t=>t.personId===personId&&t.startMonth<=month).map(t=>({factionId:t.factionId,start:t.startMonth,end:Math.min(t.endMonth??month+1,month+1),officeNames:[{month:t.startMonth,name:civilOfficeTitle(t)}],sourceIds:[t.appointEventId],appointedBy:t.rulerId}))];
 const rows=appointments.flatMap(a=>{const d=dynasties.find(d=>d.factionId===a.factionId);return (d?.rulers??[]).flatMap(r=>{
  if(r.accessionYear===undefined||r.reignOrdinal===undefined||r.accessionYear>month)return [];
  const start=Math.max(a.start,r.accessionYear),end=Math.min(a.end,r.endYear??r.deathMonth??month+1,month+1);if(start>=end)return [];
  let exiled=false,cursor=start;const periods:Array<[number,number]>=[],seen=new Set<string>();
  for(const e of lifeByFaction.get(a.factionId)??[]){const m=e.monthIndex??e.year,isExile=e.type==='faction-exiled'&&e.targetFactionId===a.factionId,isRestore=e.type==='faction-restored'&&e.actorFactionId===a.factionId,isEnd=e.type==='faction-extinct'&&e.targetFactionId===a.factionId;if(!isExile&&!isRestore&&!isEnd||m>end)continue;const key=`${e.type}/${e.historyGroupId??e.id}`;if(seen.has(key))continue;seen.add(key);
   if(m<=start){exiled=isExile||isEnd;continue;}if((isExile||isEnd)&&!exiled){periods.push([cursor,m]);exiled=true;}else if(isRestore&&exiled){cursor=m;exiled=false;}
  }
  if(!exiled)periods.push([cursor,end]);
  return periods.filter(([s,e])=>s<e).map(([s,e])=>({factionId:a.factionId,rulerId:r.id,startMonth:s,endMonth:e-1,offices:[...new Set([...a.officeNames.filter(o=>o.month<=s).slice(-1),...a.officeNames.filter(o=>o.month>s&&o.month<e)].map(o=>o.name))],sourceIds:a.sourceIds.filter(id=>{const event=byId.get(id);return event&&(event.monthIndex??event.year)<e;}),appointing:a.appointedBy===r.id}));
 });}).sort((a,b)=>a.startMonth-b.startMonth||a.factionId.localeCompare(b.factionId)||a.rulerId.localeCompare(b.rulerId));
 const merged:typeof rows=[];for(const row of rows){const old=merged.at(-1);if(old&&old.factionId===row.factionId&&old.rulerId===row.rulerId&&old.endMonth+1===row.startMonth){old.endMonth=row.endMonth;old.offices=[...new Set([...old.offices,...row.offices])];old.sourceIds=[...new Set([...old.sourceIds,...row.sourceIds])];old.appointing ||=row.appointing;}else merged.push({...row});}return merged;
}
