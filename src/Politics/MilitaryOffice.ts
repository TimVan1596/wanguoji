import type {MilitaryAppointment,MilitaryPerson} from "./MilitaryCommandRegistry";
import type {MilitaryChronicleEntry} from "./MilitaryChronicle";
export const MILITARY_OFFICES=["PIJIANG","JIANGJUN","SHANGJIANGJUN"] as const;
export type MilitaryOffice=typeof MILITARY_OFFICES[number];
export interface MilitaryOfficeGrant {office:MilitaryOffice;month:number;eventId:string;serviceMonths:number;captureEventIds:string[];}
export const MILITARY_OFFICE_NAMES:Record<MilitaryOffice,string>={PIJIANG:"裨将",JIANGJUN:"将军",SHANGJIANGJUN:"上将军"};
export const MILITARY_FORMATION_CAPACITY:Record<MilitaryOffice,number>={PIJIANG:2,JIANGJUN:3,SHANGJIANGJUN:4};
export const MILITARY_OFFICE_RULES={JIANGJUN:{serviceMonths:60,captures:2,intervalMonths:0},SHANGJIANGJUN:{serviceMonths:120,captures:3,intervalMonths:36}};
/** Only the current country's current appointment is eligible; the same victory is never spent twice. */
export function getOfficePromotion(appointment:MilitaryAppointment,entries:MilitaryChronicleEntry[],month:number){
  const grants=appointment.officeHistory??[],previous=grants.at(-1);
  if(!previous||appointment.endMonth!==undefined)return undefined;
  const next=MILITARY_OFFICES[MILITARY_OFFICES.indexOf(previous.office)+1];
  if(!next||next==="PIJIANG")return undefined;
  const rule=MILITARY_OFFICE_RULES[next],serviceMonths=month-appointment.startMonth;
  if(serviceMonths<rule.serviceMonths||month-previous.month<rule.intervalMonths)return undefined;
  const used=new Set(grants.flatMap(g=>g.captureEventIds));
  const victories=entries.filter(e=>e.victory&&e.commandId===appointment.commandId&&e.factionId===appointment.factionId&&e.worldMonth<=month&&e.worldMonth>=appointment.startMonth&&
    (next!=="SHANGJIANGJUN"||e.worldMonth>previous.month)&&!used.has(e.eventId));
  if(victories.length<rule.captures)return undefined;
  return {office:next,month,serviceMonths,captureEventIds:victories.slice(0,rule.captures).map(e=>e.eventId)};
}
export function describeMilitaryOffice(person:MilitaryPerson,factionId:string){
  const appointments=person.appointments.filter(a=>a.factionId===factionId),active=appointments.find(a=>a.endMonth===undefined);
  const current=person.status==="ACTIVE"&&person.factionId===factionId?active?.officeHistory?.at(-1):undefined;
  if(current)return `现任${MILITARY_OFFICE_NAMES[current.office]}`;
  const highest=appointments.flatMap(a=>a.officeHistory??[]).sort((a,b)=>MILITARY_OFFICES.indexOf(b.office)-MILITARY_OFFICES.indexOf(a.office))[0];
  return highest?`原任${MILITARY_OFFICE_NAMES[highest.office]}（本国历史最高职务）`:"本国尚无正式军职记录";
}
