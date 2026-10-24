import type {MilitaryAppointment,MilitaryPerson} from "./MilitaryCommandRegistry";
import type {MilitaryChronicleEntry} from "./MilitaryChronicle";
export const MILITARY_OFFICES=["XIAOWEI","PIJIANG","JIANGJUN","SHANGJIANGJUN"] as const;
export type MilitaryOffice=typeof MILITARY_OFFICES[number];
export interface MilitaryOfficeGrant {office:MilitaryOffice;month:number;eventId:string;serviceMonths:number;captureEventIds:string[];promotionBasis?:"SERVICE"|"ACTIVITY"|"CAPTURE";activityEventIds?:string[];}
export const MILITARY_OFFICE_NAMES:Record<MilitaryOffice,string>={XIAOWEI:"校尉",PIJIANG:"裨将",JIANGJUN:"将军",SHANGJIANGJUN:"上将军"};
export const MILITARY_FORMATION_CAPACITY:Record<MilitaryOffice,number>={XIAOWEI:1,PIJIANG:2,JIANGJUN:3,SHANGJIANGJUN:4};
export const MILITARY_OFFICE_RULES={PIJIANG:{serviceMonths:36,captures:0,intervalMonths:0},JIANGJUN:{serviceMonths:72,captures:1,intervalMonths:24},SHANGJIANGJUN:{serviceMonths:120,captures:2,intervalMonths:36}};
/** Only the current country's current appointment is eligible; the same victory is never spent twice. */
export function getOfficePromotion(appointment:MilitaryAppointment,entries:MilitaryChronicleEntry[],month:number){
  const grants=appointment.officeHistory??[],previous=grants.at(-1);
  if(!previous||appointment.endMonth!==undefined)return undefined;
  const next=MILITARY_OFFICES[MILITARY_OFFICES.indexOf(previous.office)+1];
  if(!next||next==="XIAOWEI")return undefined;
  const rule=MILITARY_OFFICE_RULES[next],serviceMonths=month-appointment.startMonth;
  if(serviceMonths<rule.serviceMonths||month-previous.month<rule.intervalMonths)return undefined;
  const used=new Set(grants.flatMap(g=>[...g.captureEventIds,...(g.activityEventIds??[])]));
  const eligible=[...new Map(entries.filter(e=>e.commandId===appointment.commandId&&e.factionId===appointment.factionId&&e.worldMonth<=month&&e.worldMonth>=appointment.startMonth&&!used.has(e.eventId)).map(e=>[e.eventId,e])).values()];
  if(next==='PIJIANG'){
    const activity=eligible.find(e=>e.victory||e.activityKind);
    if(activity)return {office:next,month,serviceMonths,captureEventIds:activity.victory?[activity.eventId]:[],activityEventIds:activity.victory?[]:[activity.eventId],promotionBasis:'ACTIVITY' as const};
    return serviceMonths>=60?{office:next,month,serviceMonths,captureEventIds:[],activityEventIds:[],promotionBasis:'SERVICE' as const}:undefined;
  }
  const victories=eligible.filter(e=>e.victory);
  let selected=victories.slice(0,1);
  if(next==='SHANGJIANGJUN'){
    const fresh=victories.find(e=>e.worldMonth>previous.month&&e.cityId);
    const other=fresh&&victories.find(e=>e.eventId!==fresh.eventId&&e.cityId&&e.cityId!==fresh.cityId);
    selected=fresh&&other?[fresh,other]:[];
  }
  if(selected.length<rule.captures)return undefined;
  return {office:next,month,serviceMonths,captureEventIds:selected.map(e=>e.eventId),activityEventIds:[],promotionBasis:'CAPTURE' as const};
}
export function describeMilitaryOffice(person:MilitaryPerson,factionId:string){
  const appointments=person.appointments.filter(a=>a.factionId===factionId),active=appointments.find(a=>a.endMonth===undefined);
  const current=person.status==="ACTIVE"&&person.factionId===factionId?active?.officeHistory?.at(-1):undefined;
  if(current)return `现任${MILITARY_OFFICE_NAMES[current.office]}`;
  const highest=appointments.flatMap(a=>a.officeHistory??[]).sort((a,b)=>MILITARY_OFFICES.indexOf(b.office)-MILITARY_OFFICES.indexOf(a.office))[0];
  return highest?`原任${MILITARY_OFFICE_NAMES[highest.office]}（本国历史最高职务）`:"本国尚无正式军职记录";
}
