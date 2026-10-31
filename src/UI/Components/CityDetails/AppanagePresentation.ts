import {appanageEffectiveWindows} from '../../../History/AppanageCareer';
import type {cityAppanageHistory} from '../../../History/CityAppanageHistory';
import type {MilitaryPerson} from '../../../Politics/MilitaryCommandRegistry';
import type {MilitaryAppanage} from '../../../Politics/MilitaryAppanage';
import {getFactionColorAtMonth,type FactionColorHistoryEntry} from '../../../Simulation/FactionColorHistory';
import type {PortraitRole} from '../FactionDetails/PortraitPresentation';
export type AppanageRelation=ReturnType<typeof cityAppanageHistory>['relations'][number];
const reasons:Record<string,string>={DEATH:'本人去世',ACCESSION:'本人登位',TRANSFER:'本人转属',TITLE_REVOKED:'旧爵被追夺',DYNASTY_ENDED:'旧王统终结',STATE_ENDED:'原政权终结',CITY_DESTROYED:'城池毁灭'};
export const appanageStatus=(r:AppanageRelation)=>r.state==='ACTIVE'?'有效':r.state==='LOST'?'失地':'已终结';
export function appanageTimelineLabel(a:MilitaryAppanage){return a.kind==='GRANTED'?'授邑':a.kind==='LOST'?'失地':a.kind==='RESTORED'?'恢复':`终结 · ${reasons[a.reason??'']??'原身份终结'}`;}
export function appanageSummary(r:AppanageRelation){
 const kinds=r.timeline.map(e=>e.record.kind),loss=kinds.lastIndexOf('LOST'),back=kinds.lastIndexOf('RESTORED');
 const history=loss>=0&&back>=0?(back>loss?'曾失地，后恢复':'恢复后再失地'):loss>=0&&r.state==='ENDED'?'曾失地':undefined;
 return [history,r.state==='ENDED'?`${reasons[r.last.reason??'']??'原身份'}终结`.replace('终结终结','终结'):undefined].filter(Boolean).join(' · ');
}
/** The original grant period, even if the person later changed countries or became a monarch. */
export function appanagePortrait(person:MilitaryPerson,a:MilitaryAppanage,faction:{color:number;colorHistory?:FactionColorHistoryEntry[]}|undefined,worldMonth:number){
 const appt=person.appointments.filter(x=>x.factionId===a.factionId&&x.startMonth<=a.month).sort((x,y)=>x.startMonth-y.startMonth).at(-1);
 const office=appt?.officeHistory?.filter(g=>g.month<=a.month).at(-1)?.office;
 return {personId:person.personId,age:Math.max(0,Math.floor((a.month-person.bornMonth)/12)),role:(office??'UNKNOWN') as PortraitRole,nobleRank:a.rank,royalKin:!!person.royalIdentity,color:faction?getFactionColorAtMonth(faction,a.month):undefined,deceased:person.deathMonth!==undefined&&person.deathMonth<=a.month&&person.deathMonth<=worldMonth};
}

/** Ended/lost estates freeze at the last valid transaction, not a later foreign career. */
export function appanageLatestPortrait(r:AppanageRelation,faction:Parameters<typeof appanagePortrait>[2],month:number,index:import('../../../History/CityAppanageHistory').AppanageHistoryIndex){
 const windows=appanageEffectiveWindows(r,index,month),last=windows.at(-1),a=r.grant.record,p=r.grant.person;
 if(!last)return {...appanagePortrait(p,a,faction,a.month),month:a.month,rank:a.rank};
 const at=last.endMonth,order=last.endOrder;
 const before=(id:string,m:number)=>m<=at&&(index.byId.get(id)?.index??Infinity)<order;
 const appointment=p.appointments.filter(ap=>ap.factionId===a.factionId&&ap.startMonth<=at).at(-1);
 const office=appointment?.officeHistory?.filter(g=>before(g.eventId,g.month)).at(-1)?.office;
 const grant=p.nobilityHistory?.filter(g=>g.factionId===a.factionId&&g.epochFounderId===a.epochFounderId&&before(g.eventId,g.month)&&index.byId.get(g.eventId)?.event.metadata?.nobility===JSON.stringify(g)).at(-1);
 const colorMonth=Number.isFinite(order)?Math.max(a.month,at-1):at;
 return {personId:p.personId,age:Math.max(0,Math.floor((at-p.bornMonth)/12)),role:(office??'UNKNOWN') as PortraitRole,nobleRank:grant?.rank??a.rank,royalKin:!!p.royalIdentity,color:faction?getFactionColorAtMonth(faction,colorMonth):undefined,deceased:false,month:at,rank:grant?.rank??a.rank};
}
