import {militaryDeathWording} from '../../../Politics/MilitaryLifePresentation';
import type {MilitaryPerson} from '../../../Politics/MilitaryCommandRegistry';
import type {CivilGovernorTerm} from '../../../Politics/CivilAdministration';
import {MILITARY_OFFICE_NAMES} from '../../../Politics/MilitaryOffice';
import {formatWorldDate,formatWorldDuration,getWorldYear} from '../../../Simulation/WorldTime';
import {describeMilitaryAppointmentEnd} from './MilitaryPeoplePresentation';
export const civilEndLabel=(reason:CivilGovernorTerm['endReason'])=>reason?({DEATH:'去世',CITY_LOST:'城池失守',FACTION_ENDED:'政权终结',REGIME_ENDED:'王统结束',POLITICAL_SANCTION:'政治禁仕',MILITARY_OFFICE:'转任武职',REPLACED:'职务更替',IDENTITY_ENDED:'在籍关系结束'})[reason]:'离任原因未载';
/** Read only actual local appointments. An absent resident is never proof of death. */
export function personOfficeSummary({person,terms,factionId,month,deathMonth,knownAlive=false}:{person?:MilitaryPerson;terms:readonly CivilGovernorTerm[];factionId:string;month:number;deathMonth?:number;knownAlive?:boolean}){
 const civil=terms.filter(t=>t.factionId===factionId&&t.startMonth<=month),military=person?.appointments.filter(a=>a.factionId===factionId&&a.startMonth<=month)??[],bornMonth=person?.bornMonth??civil[0]?.bornMonth;
 const death=deathMonth??person?.deathMonth,dead=death!==undefined&&death<=month;
 const spans=[...civil.map(t=>({kind:'文官' as const,start:t.startMonth,end:t.endMonth,office:`${t.cityName}郡守`,reason:civilEndLabel(t.endReason)})),...military.map(a=>({kind:'武官' as const,start:a.startMonth,end:a.endMonth,office:MILITARY_OFFICE_NAMES[a.officeHistory?.filter(h=>h.month<=Math.min(month,a.endMonth??month)).at(-1)?.office??'XIAOWEI'],reason:a.endMonth===undefined?'在任':a.endReason?describeMilitaryAppointmentEnd(a.endReason):'离任原因未载'}))].sort((a,b)=>a.start-b.start);
 const active=!dead?spans.filter(a=>a.end===undefined).at(-1):undefined,last=active??spans.at(-1),first=spans[0],at=dead?death!:month;
 const age=bornMonth===undefined?'生年未载':`${dead?'享年':knownAlive?'现年':'年龄未载 · 生于'}${dead||knownAlive?`${Math.max(0,Math.floor((at-bornMonth)/12))}岁 · 生于`:''}${formatWorldDate(bornMonth)}${dead?` · 卒于${formatWorldDate(death!)}`:''}`;
 const state=dead?militaryDeathWording(person?.deathCause):active?'在任':person?.factionId!==undefined&&person.factionId!==factionId?'已转属':last?.reason??'任职未载';
 const year=(m:number)=>getWorldYear(m)<0?`纪元前${-getWorldYear(m)}年`:`${getWorldYear(m)}年`;
 const compactAge=bornMonth===undefined?'生年未载':dead?`${year(bornMonth)}—${year(death!)} · 享年${Math.max(0,Math.floor((death!-bornMonth)/12))}岁`:`${year(bornMonth)}生 · ${knownAlive?`现年${Math.max(0,Math.floor((month-bornMonth)/12))}岁`:'生死未载'}`;
 const compactTenure=last?`${year(last.start)}—${last.end===undefined?active?'今':'止期未载':year(last.end)}任职${spans.length>1?`（本国${spans.length}段仕历）`:''} · ${state==='实际死亡'?militaryDeathWording(person?.deathCause):state}`:'任期未载';
 return {compactAge,compactTenure,officeLevel:military.at(-1)?.officeHistory?.at(-1)?.office,bornMonth,deathMonth:dead?death:undefined,kind:last?.kind,office:last?.office??'职务未载',active:!!active,age,state,tenure:last?`${formatWorldDate(last.start)}任${last.office} · ${active?`在任${formatWorldDuration(month-last.start)}`:last.end!==undefined?`${formatWorldDate(last.end)}${last.end===death?militaryDeathWording(person?.deathCause):last.reason} · 任职${formatWorldDuration(last.end-last.start)}`:'止期未载'}${first&&first!==last?` · ${formatWorldDate(first.start)}初任`:''}`:'任期未载'};
}
