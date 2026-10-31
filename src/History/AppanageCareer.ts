import type {cityAppanageHistory,prepareAppanageHistory} from './CityAppanageHistory';
import {appanageChanges} from '../Politics/MilitaryAppanage';
import type {MilitaryFormation} from '../Politics/MilitaryCommandRegistry';
import {deriveMilitaryChronicle} from '../Politics/MilitaryChronicle';
import {militaryMilestones} from '../Politics/MilitaryChroniclePresentation';
type Relation=ReturnType<typeof cityAppanageHistory>['relations'][number];
type Index=ReturnType<typeof prepareAppanageHistory>;
export interface AppanageWindow {startMonth:number;startOrder:number;endMonth:number;endOrder:number;}
/** Half-open transaction intervals; same-month loss/recovery and accession are ordered by source acts. */
export function appanageEffectiveWindows(r:Relation,index:Index,month:number){
 const original=r.timeline.at(-1)!.record;
 const records=[...r.timeline.map(e=>e.record),...appanageChanges(r.grant.person,original,index.related(r.grant.person,original),month)];
 const windows:AppanageWindow[]=[];let start:{month:number;order:number}|undefined;
 for(const a of records){
  if(a.month>month)continue;
  const order=index.byId.get(a.kind==='GRANTED'?a.eventId:a.sourceEventId)?.index;if(order===undefined)continue;
  if(a.kind==='GRANTED'||a.kind==='RESTORED'){if(!start)start={month:a.month,order};}
  else if(start){windows.push({startMonth:start.month,startOrder:start.order,endMonth:a.month,endOrder:order});start=undefined;}
  if(a.kind==='ENDED')break;
 }
 if(start)windows.push({startMonth:start.month,startOrder:start.order,endMonth:month,endOrder:Infinity});
 return windows;
}
/** Only computed for an expanded card. Other-city victories remain that person's experience. */
export function appanageCareer(r:Relation,index:Index,formations:MilitaryFormation[],month:number){
 const windows=appanageEffectiveWindows(r,index,month),person=r.grant.person,factionId=r.grant.record.factionId;
 const events=index.personEvents(person.personId),entries=deriveMilitaryChronicle(person,formations,events,month,factionId);
 const inWindow=(id:string,at:number)=>{const order=index.byId.get(id)?.index;return order!==undefined&&windows.some(w=>at>=w.startMonth&&at<=w.endMonth&&order>=w.startOrder&&order<w.endOrder);};
 const types=new Set(['military-office-granted','military-ennobled','siege-defended','ruler-deposed','dynasty-usurped','empire-split']);
 return {windows,entries:militaryMilestones(person,entries,events).filter(e=>inWindow(e.eventId,e.worldMonth)&&(e.victory||types.has(index.byId.get(e.eventId)?.event.type??''))).sort((a,b)=>a.worldMonth-b.worldMonth||(index.byId.get(a.eventId)?.index??0)-(index.byId.get(b.eventId)?.index??0))};
}
