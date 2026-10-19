import type {MilitaryPerson} from "../../../Politics/MilitaryCommandRegistry";
import type {MilitaryChronicleEntry} from "../../../Politics/MilitaryChronicle";
import type {WorldEvent} from "../../../History/WorldHistory";
import {getMilitaryPersonDisplayName} from "../../../Politics/MilitaryPersonIdentity";
import {MILITARY_OFFICE_NAMES} from "../../../Politics/MilitaryOffice";

/** Only changes the reading view. Full entries and canonical events remain available for audit and promotion. */
export function militaryMilestones(person:MilitaryPerson,entries:MilitaryChronicleEntry[],events:WorldEvent[]){
  const byId=new Map(events.map(e=>[e.id,e])),name=getMilitaryPersonDisplayName(person);
  return entries.flatMap(entry=>{
    const type=entry.source.split(" · ")[0],event=byId.get(entry.eventId);
    if(type==="military-order-issued"&&event?.importance!=="major")return [];
    if(type==="military-order-issued")return [{...entry,text:`${name}奉命以${event?.cityName??"城邑"}为进军目标。`}];
    if(type==="military-appointment"&&entries.some(e=>e.commandId===entry.commandId&&e.worldMonth===entry.worldMonth&&e.source.startsWith("military-office-granted")))return [];
    let text=entry.text;
    if(entry.victory&&event)text=`${name}所部参与${event.type==="city-recovered"?"收复":"攻取"}${event.cityName??"城邑"}${event.metadata?.wasCapital===1?"，时为敌都":""}。`;
    if(type==="military-office-granted"){
      const grant=person.appointments.flatMap(a=>a.officeHistory??[]).find(g=>g.eventId===entry.eventId);
      if(grant)text=`${name}${grant.office==="PIJIANG"?"授":"晋"}${MILITARY_OFFICE_NAMES[grant.office]}。`;
    }
    if(type==="military-person-died")text=`${name}${person.deathCause==="NATURAL_DEATH"?"自然去世":person.deathCause==="SIEGE_LOSS"?"在战乱中去世":person.deathCause==="BATTLE_DEATH"?"在战乱中去世":"去世"}。`;
    if(type==="military-command-ended")text=event?.metadata?.endReason==="AGE_RETIREMENT"?`${name}年老退职。`:`${name}离任。`;
    if(type==="ruler-deposed"||type==="dynasty-usurped")text=text.replace("，军事参与者并非新君","");
    return [{...entry,text}];
  });
}
