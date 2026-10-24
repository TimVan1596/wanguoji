import {getHistoricalFactionIdentity} from "../History/HistoricalFactionIdentity";
import type {HistoryFactionLike} from "../History/HistoryRenderRules";
import {MILITARY_OFFICES,MILITARY_OFFICE_NAMES} from "./MilitaryOffice";
import type { WorldEvent } from "../History/WorldHistory";
import type { MilitaryFormation, MilitaryPerson } from "./MilitaryCommandRegistry";
import { deriveMilitaryCareer } from "./MilitaryCareerEvidence";
import { getMilitaryPersonDisplayName } from "./MilitaryPersonIdentity";
import { readMilitaryParticipation } from "./MilitaryPoliticalInfluence";

export interface MilitaryChronicleEntry {
  eventId: string;
  cityId?:string;
  worldMonth: number;
  factionId: string;
  commandId?: string;
  text: string;
  source: string;
  victory: boolean;
  activityKind?:import("./MilitaryExperience").MilitaryActivity["kind"];
}

/** Frozen at event creation after validating the live command. No current-map inference. */
export interface MilitaryHistoryContext {factions?:ReadonlyMap<string,HistoryFactionLike>;people?:readonly MilitaryPerson[];events?:readonly WorldEvent[];}

/** Same-month promotions are ordered by canonical events, never backdated into earlier battles. */
export function getMilitaryOfficeAtEvent(event:WorldEvent,context:MilitaryHistoryContext={}){
  const m=event.metadata,month=event.monthIndex??event.year;
  if(MILITARY_OFFICES.includes(m?.commanderOffice as any))return m!.commanderOffice as typeof MILITARY_OFFICES[number];
  const person=context.people?.find(p=>p.personId===m?.commanderPersonId);
  const appointment=person?.appointments.find(a=>a.commandId===m?.commandId&&a.factionId===event.actorFactionId&&a.startMonth<=month&&month<=(a.endMonth??month));
  const history=context.events??[],eventIndex=history.findIndex(e=>e.id===event.id);
  return appointment?.officeHistory?.filter(g=>g.month<month||g.month===month&&eventIndex>=0&&history.findIndex(e=>e.id===g.eventId)>=0&&history.findIndex(e=>e.id===g.eventId)<eventIndex).at(-1)?.office;
}

export function formatMilitaryVictorySource(event: WorldEvent,context:MilitaryHistoryContext={}) {
  const m = event.metadata;
  if (!["city-captured", "city-recovered", "capital-fallen"].includes(event.type) ||
      typeof m?.commanderPersonId !== "string" || typeof m.commandId !== "string" ||
      typeof m.commanderPersonalName !== "string" || !m.commanderPersonalName.trim() || !event.cityId || !event.actorFactionId) return undefined;
  const month=event.monthIndex??event.year;
  const country=(id:string|undefined)=>id?(context.factions?.get(id)?getHistoricalFactionIdentity({...context.factions.get(id)!,displayName:id},month).name:id):"";
    const office=getMilitaryOfficeAtEvent(event,context),actor=typeof m.attackerNameAtEvent==="string"&&m.attackerNameAtEvent.trim()?m.attackerNameAtEvent:country(event.actorFactionId);
  const defenderId=event.previousOwnerFactionId&&event.targetFactionId&&event.previousOwnerFactionId!==event.targetFactionId?undefined:event.previousOwnerFactionId??event.targetFactionId;
  const defender=defenderId?(typeof m.defenderNameAtEvent==="string"&&m.defenderNameAtEvent.trim()?m.defenderNameAtEvent:country(defenderId)):"";
  const participant=`${actor}${office?MILITARY_OFFICE_NAMES[office]:"将领"}${m.commanderPersonalName}所部参战`;
  const city=event.cityName??"城邑";
  if(event.type==="city-recovered")return `${actor}收复${defender?`${defender}所据的`:""}${m.founderCapital===1?"故都":m.wasCapital===1?"都城":""}${city}，${participant}`;
  return `${actor}攻克${defender}${m.wasCapital===1?(defender?"都":"敌都"):defender?"城":""}${city}，${participant}`;
}

export function formatRulerMilitaryEvent(event: WorldEvent, ruler: { accessionYear: number; endYear?: number }, factionId: string, worldMonth: number,context:MilitaryHistoryContext={}) {
  const month = event.monthIndex ?? event.year;
  if (event.actorFactionId !== factionId || month < ruler.accessionYear || month > Math.min(ruler.endYear ?? worldMonth, worldMonth)) return undefined;
  const source = formatMilitaryVictorySource(event,context);
  return source ? `其治下，${source}` : undefined;
}

/** One projection of the existing events. No new history facts or military score. */
export function deriveMilitaryChronicle(person: MilitaryPerson, formations: MilitaryFormation[], events: WorldEvent[], worldMonth: number, factionId?: string) {
  const career=deriveMilitaryCareer(person,formations,events,worldMonth),captures=new Set(career.capturedEventIds),activities=new Map(career.activities.map(a=>[a.eventId,a.kind]));
  const byId = new Map(events.map(e => [e.id, e]));
  const groups = new Set<string>();
  const entries: MilitaryChronicleEntry[] = [];
  const name = getMilitaryPersonDisplayName(person);
  for (const e of [...byId.values()].sort((a, b) => (a.monthIndex ?? a.year) - (b.monthIndex ?? b.year))) {
    const month = e.monthIndex ?? e.year;
    const secession=e.type==="empire-split"&&e.metadata?.militaryPersonId===person.personId&&person.politicalRulerId===e.metadata?.foundingRulerId;
    if (month > worldMonth || person.deathMonth !== undefined && month > person.deathMonth || factionId && e.actorFactionId !== factionId&&!(secession&&e.targetFactionId===factionId)) continue;
    const m = e.metadata ?? {};
    const political = readMilitaryParticipation(e);
    const commandId = String(political?.participant.commandId ?? m.commandId ?? "");
    const appointment = person.appointments.find(a => a.commandId === commandId && a.factionId === e.actorFactionId &&
      month >= a.startMonth && month <= (a.endMonth ?? worldMonth));
    const formation = formations.find(f => f.commandId === commandId && f.commanderPersonId === person.personId && f.factionId === e.actorFactionId);
    const served = Boolean(appointment && formation);
    let text: string | undefined;
    let victory = false;
    if(secession&&person.appointments.some(a=>a.commandId===(()=>{try{return JSON.parse(String(e.metadata?.militarySplitEvidence)).commandId;}catch{return "";}})()&&a.factionId===e.targetFactionId&&a.endMonth===month&&a.endReason==="TRANSFERRED")){
      let count=0;try{count=JSON.parse(String(e.metadata?.militarySplitEvidence)).participants.length-1;}catch{}
      text=`${name}率${count}名旧部于${e.cityName??e.metadata?.splitCoreCityName??"当地"}起事，脱离${e.metadata?.leaderOriginalFactionName??e.targetFactionId}，建立${e.actorFactionId}并成为首领。`;
    } else if (captures.has(e.id) && served) {
      const key = e.historyGroupId ?? e.id;
      if (groups.has(key)) continue;
      groups.add(key);
      victory = true;
      text = `作为${e.actorFactionId}军事指挥官，${name}所属编组参与${e.type === "city-recovered" ? "收复" : "攻陷"}${e.cityName ?? e.cityId}${m.wasCapital === 1 ? "（当时敌都）" : m.wasCapital === 0 ? "（普通城市）" : "（当时都城属性未记录）"}。`;
    } else if (m.personId === person.personId) {
      if(served&&e.type==="military-office-granted"){
        const grant=appointment?.officeHistory?.find(g=>g.eventId===e.id&&g.month===month&&g.office===m.office);
        if(grant)text=`${name}${m.previousOffice==="NONE"?"获授":"晋任"}${MILITARY_OFFICE_NAMES[grant.office]}；据本次任职${grant.serviceMonths}个月${grant.captureEventIds.length?`及${grant.captureEventIds.length}条核验战果`:""}。`;
      }
      if (served && e.type === "military-appointment" && month === appointment?.startMonth) text = `${name}获任${e.actorFactionId}军事指挥官。`;
      if(served&&e.type==="siege-defended")text=`${name}所部参与守住${e.cityName??e.cityId}，实际围攻者受阻撤离。`;
      if(served&&e.type==="siege-started")text=`${name}所部开始围攻${e.cityName??e.cityId}。`;
      if(served&&e.type==="siege-ended")text=`${name}所部${m.reason==="CAPTURED"?"围攻结束，城市易主":m.reason==="REPULSED"?"攻势受阻，撤围休整":m.reason==="TRUCE"?"因停战结束围攻":"因实际接触或指挥中断结束围攻"}（${e.cityName??e.cityId}）。`;
      if (served && e.type === "military-order-issued") text = `${name}所属编组接令以${e.cityName ?? e.cityId}为目标；军令不代表攻陷。`;
      if (served && e.type === "military-command-ended" && month === appointment?.endMonth && m.endReason === appointment.endReason)
        text = m.endReason === "AGE_RETIREMENT" ? `${name}年老退役。` : `${name}结束在${e.actorFactionId}的军事任职。`;
      if (e.type === "military-person-died" && person.status === "DEAD" && month === person.deathMonth && e.actorFactionId === person.factionId && m.deathCause === person.deathCause)
        text = `${name}${person.deathCause === "NATURAL_DEATH" ? "自然去世" : "去世"}。`;
    } else if (served && political?.participant.personId === person.personId && political.participant.sourceUserId === person.sourceUserId) {
      text = `${name}统兵参与${political.kind === "DEPOSITION" ? "宗室废立" : "继统政治压力"}，军事参与者并非新君。`;
    }
    if (text) entries.push({ eventId: e.id,cityId:e.cityId, worldMonth: month, factionId: secession?e.targetFactionId!:e.actorFactionId!, commandId: commandId || undefined, text,
      source: `${e.type} · ${e.id}`, activityKind:activities.get(e.id),victory });
  }
  return entries;
}
