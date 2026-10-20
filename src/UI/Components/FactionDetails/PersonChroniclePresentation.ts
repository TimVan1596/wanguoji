import type {MilitaryPerson} from "../../../Politics/MilitaryCommandRegistry";
import {selectChronicleHighlights} from "../../../Politics/ChronicleHighlights";
import {formatMilitaryVictorySource,type MilitaryHistoryContext} from "../../../Politics/MilitaryChronicle";
import {getHistoricalFactionIdentity} from "../../../History/HistoricalFactionIdentity";
import type {MilitaryChronicleEntry} from "../../../Politics/MilitaryChronicle";
import type {WorldEvent} from "../../../History/WorldHistory";
import {getMilitaryPersonDisplayName} from "../../../Politics/MilitaryPersonIdentity";
import {MILITARY_OFFICE_NAMES} from "../../../Politics/MilitaryOffice";

/** Only changes the reading view. Full entries and canonical events remain available for audit and promotion. */
export function militaryMilestones(person:MilitaryPerson,entries:MilitaryChronicleEntry[],events:WorldEvent[],context:MilitaryHistoryContext={}){
  const byId=new Map(events.map(e=>[e.id,e])),name=getMilitaryPersonDisplayName(person);
  return entries.flatMap(entry=>{
    const type=entry.source.split(" · ")[0],event=byId.get(entry.eventId);
    if(type==="military-order-issued"&&event?.importance!=="major")return [];
    if(type==="military-order-issued")return [{...entry,text:`${name}奉命以${event?.cityName??"城邑"}为进军目标。`}];
    if(type==="military-appointment"&&entries.some(e=>e.commandId===entry.commandId&&e.worldMonth===entry.worldMonth&&e.source.startsWith("military-office-granted")))return [];
    let text=entry.text;
    if(entry.victory&&event)text=`${formatMilitaryVictorySource(event,{...context,people:[person],events})??entry.text.replace(/。$/,"")}。`;
    if(type==="military-office-granted"){
      const grant=person.appointments.flatMap(a=>a.officeHistory??[]).find(g=>g.eventId===entry.eventId);
      if(grant){
        const faction=context.factions?.get(entry.factionId),country=faction?getHistoricalFactionIdentity(faction,entry.worldMonth).name:entry.factionId;
        const issuer=event?.rulerId&&typeof event.metadata?.authorizingRulerTitle==="string"?event.metadata.authorizingRulerTitle:undefined;
        text=grant.office==="PIJIANG"?`${issuer?`${issuer}在位时，`:`${country}授职，`}${name}获授${MILITARY_OFFICE_NAMES[grant.office]}。`:`${country}${name}晋${MILITARY_OFFICE_NAMES[grant.office]}。`;
      }
    }
    if(type==="military-person-died")text=`${name}${person.deathCause==="NATURAL_DEATH"?"自然去世":person.deathCause==="SIEGE_LOSS"?"在战乱中去世":person.deathCause==="BATTLE_DEATH"?"在战乱中去世":"去世"}。`;
    if(type==="military-command-ended")text=event?.metadata?.endReason==="AGE_RETIREMENT"?`${name}年老退职。`:`${name}离任。`;
    if(type==="ruler-deposed"||type==="dynasty-usurped")text=text.replace("，军事参与者并非新君","");
    return [{...entry,text}];
  });
}


export function selectMilitaryMilestones(entries:MilitaryChronicleEntry[],events:WorldEvent[],limit=8){
  const byId=new Map(events.map(e=>[e.id,e]));
  const firstGrant=[...entries].sort((a,b)=>a.worldMonth-b.worldMonth||a.eventId.localeCompare(b.eventId)).find(e=>e.source.startsWith("military-office-granted")||e.source.startsWith("military-appointment"));
  const candidates=entries.filter(e=>!(e.source.startsWith("military-command-ended")&&byId.get(e.eventId)?.metadata?.endReason==="DEATH"&&entries.some(d=>d.worldMonth===e.worldMonth&&d.source.startsWith("military-person-died"))));
  return selectChronicleHighlights(candidates,limit,e=>{
    const event=byId.get(e.eventId),type=event?.type??e.source.split(" · ")[0];
    const priority=type==="military-person-died"?1200:e===firstGrant?1100:type==="ruler-deposed"||type==="dynasty-usurped"?1000:
      type==="military-office-granted"?950:type==="military-command-ended"?900:e.victory&&event?.metadata?.wasCapital===1?700:
      e.victory&&type==="city-recovered"?650:e.victory?400:200;
    return {id:e.eventId,month:e.worldMonth,priority,cityId:e.victory?event?.cityId:undefined};
  });
}
