import type {MilitaryPerson} from "./MilitaryCommandRegistry";
import {selectChronicleHighlights} from "./ChronicleHighlights";
import {formatMilitaryVictorySource,type MilitaryHistoryContext} from "./MilitaryChronicle";
import {getHistoricalFactionIdentity} from "../History/HistoricalFactionIdentity";
import type {MilitaryChronicleEntry} from "./MilitaryChronicle";
import type {WorldEvent} from "../History/WorldHistory";
import {getMilitaryPersonDisplayName} from "./MilitaryPersonIdentity";
import {MILITARY_OFFICE_NAMES} from "./MilitaryOffice";

/** Only changes the reading view. Full entries and canonical events remain available for audit and promotion. */
export function militaryMilestones(person:MilitaryPerson,entries:MilitaryChronicleEntry[],events:WorldEvent[],context:MilitaryHistoryContext={}){
  const byId=new Map(events.map(e=>[e.id,e])),name=getMilitaryPersonDisplayName(person);
  return entries.filter(e=>!(e.source.startsWith("military-command-ended")&&byId.get(e.eventId)?.metadata?.endReason==="DEATH"&&entries.some(d=>d.worldMonth===e.worldMonth&&d.source.startsWith("military-person-died")))).flatMap(entry=>{
    const type=entry.source.split(" · ")[0],event=byId.get(entry.eventId);
    if(type==="military-order-issued"&&event?.importance!=="major")return [];
    if(type==="military-order-issued")return [{...entry,text:`${name}奉命以${event?.cityName??"城邑"}为进军目标。`}];
    if(type==="military-appointment"&&entries.some(e=>e.commandId===entry.commandId&&e.worldMonth===entry.worldMonth&&e.source.startsWith("military-office-granted")))return [];
    let text=entry.text;
    if(type==="empire-split"&&event){
      const faction=event.actorFactionId&&context.factions?.get(event.actorFactionId);
      const polity=faction?getHistoricalFactionIdentity({...faction,displayName:event.actorFactionId!},entry.worldMonth).name:undefined;
      text=`${name}率旧部于${event.cityName??event.metadata?.splitCoreCityName??"当地"}起事，脱离${event.metadata?.leaderOriginalFactionName??event.targetFactionId}${polity?`，建立${polity}`:""}，成为首领。`;
    }
    if(entry.victory&&event)text=`${formatMilitaryVictorySource(event,{...context,people:[person],events})??entry.text.replace(/。$/,"")}。`;
    if(type==="military-office-granted"){
      const grant=person.appointments.flatMap(a=>a.officeHistory??[]).find(g=>g.eventId===entry.eventId);
      if(grant){
        const faction=context.factions?.get(entry.factionId),country=faction?getHistoricalFactionIdentity({...faction,displayName:entry.factionId},entry.worldMonth).name:entry.factionId;
        const issuer=event?.rulerId&&typeof event.metadata?.authorizingRulerTitle==="string"?event.metadata.authorizingRulerTitle:undefined;
        text=person.appointments.some(a=>a.officeHistory?.[0]?.eventId===entry.eventId)?`${issuer?`${issuer}在位时，${name}获授`:`${country}授${name}为`}${MILITARY_OFFICE_NAMES[grant.office]}。`:`${issuer?`${issuer}在位时，${name}`:`${name}于${country}`}晋为${MILITARY_OFFICE_NAMES[grant.office]}。`;
        if(grant.promotionBasis){
          const basis=grant.promotionBasis==='SERVICE'?'依服役资历':grant.promotionBasis==='ACTIVITY'?'因实际军旅经历':'凭实际取城战功';
          text=`${issuer?`${issuer}在位时，${name}`:`${name}于${country}`}${basis}晋为${MILITARY_OFFICE_NAMES[grant.office]}。`;
        }
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
    const priority=type==="military-person-died"?1200:e===firstGrant?1100:type==="ruler-deposed"||type==="dynasty-usurped"||type==="empire-split"||type==="ruler-acceded"||type==="ruler-succession"?1000:
      ["military-ennobled","military-posthumous","military-title-revoked"].includes(type)?970:type==="military-appanage"&&event?.importance==="major"?960:type==="military-office-granted"?950:type==="military-command-ended"?900:e.victory&&event?.metadata?.wasCapital===1?700:
      e.victory&&type==="city-recovered"?650:e.victory?400:200;
    return {id:e.eventId,month:e.worldMonth,priority,cityId:e.victory?event?.cityId:undefined};
  });
}
