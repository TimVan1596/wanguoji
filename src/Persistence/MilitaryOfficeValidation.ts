import type {MilitaryCommandState} from "../Politics/MilitaryCommandRegistry";
import {deriveMilitaryChronicle} from "../Politics/MilitaryChronicle";
import {MILITARY_OFFICES,MILITARY_OFFICE_RULES} from "../Politics/MilitaryOffice";

/** V18 authoritative office chain and canonical event references, including ended appointments. */
export function validateMilitaryOffices(state:MilitaryCommandState,events:any[],worldMonth:number){
  const errors:string[]=[],byId=new Map(events.map(e=>[e.id,e])),referenced=new Set<string>();
  for(const p of state.people){
    if(!Array.isArray(p?.appointments))continue;
    const histories=p.appointments.map(a=>a?.officeHistory);
    if(histories.some(h=>!Array.isArray(h)||!h.length||h.length>3||h.some(g=>!g||!MILITARY_OFFICES.includes(g.office)||!Number.isSafeInteger(g.month)||!Number.isSafeInteger(g.serviceMonths)||typeof g.eventId!=="string"||!Array.isArray(g.captureEventIds)||g.captureEventIds.some(id=>typeof id!=="string")))){
      errors.push(`military office history shape invalid: ${p.personId}`);continue;
    }
    const entries=deriveMilitaryChronicle(p,state.formations,events,worldMonth);
    for(const a of p.appointments){
      const used=new Set<string>();
      for(const [index,g] of (a.officeHistory??[]).entries()){
        const previous=a.officeHistory?.[index-1],event=byId.get(g.eventId),m=event?.metadata;
        if(g.office!==MILITARY_OFFICES[index]||g.month<a.startMonth||g.month>Math.min(a.endMonth??worldMonth,p.deathMonth??worldMonth,worldMonth)||g.serviceMonths!==g.month-a.startMonth||
          referenced.has(g.eventId)||!event||event.type!=="military-office-granted"||event.actorFactionId!==a.factionId||!(event.factionIds??[]).includes(a.factionId)||
          (event.monthIndex??event.year)!==g.month||m?.personId!==p.personId||m.commandId!==a.commandId||m.sourceUserId!==p.sourceUserId||m.personalName!==p.personalName||m.office!==g.office||m.previousOffice!==(previous?.office??"NONE")||m.serviceMonths!==g.serviceMonths||m.captureEventIds!==JSON.stringify(g.captureEventIds))errors.push(`military office event/reference invalid: ${g.eventId}`);
        referenced.add(g.eventId);
        if(index===0){if(g.month!==a.startMonth||g.captureEventIds.length!==0)errors.push("initial military office must match appointment");continue;}
        const rule=MILITARY_OFFICE_RULES[g.office as "JIANGJUN"|"SHANGJIANGJUN"];
        const eligible=new Set(entries.filter(e=>e.victory&&e.commandId===a.commandId&&e.factionId===a.factionId&&e.worldMonth<=g.month&&e.worldMonth>=a.startMonth&&
          (g.office!=="SHANGJIANGJUN"||e.worldMonth>(previous?.month??Infinity))).map(e=>e.eventId));
        if(g.month%12!==0||!rule||!previous||g.serviceMonths<rule.serviceMonths||g.month-previous.month<rule.intervalMonths||g.captureEventIds.length!==rule.captures||new Set(g.captureEventIds).size!==g.captureEventIds.length||g.captureEventIds.some(id=>used.has(id)||!eligible.has(id)))errors.push(`military office lacks verified merit/service: ${g.eventId}`);
        g.captureEventIds.forEach(id=>used.add(id));
      }
    }
  }
  for(const e of events)if(e.type==="military-office-granted"&&!referenced.has(e.id))errors.push(`orphan military office event: ${e.id}`);
  return errors;
}
