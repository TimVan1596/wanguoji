import type {WorldEvent} from './WorldHistory';
import {formatWorldDate} from '../Simulation/WorldTime';

type ReadingRow = {id:string;month:number;text:string;sources:string[]};
const boundaryEvents = new Set([
 'civil-governor-ended','civil-governor-appointed','military-court-sanction',
 'royal-succession-sanction','court-coup-result','civil-ennobled','military-ennobled',
 'court-peerage-granted','founding-peerage-granted','military-title-revoked',
 'empire-split','dynasty-usurped','city-captured','capital-fallen',
]);

/** The input is one person's chronological public timeline. Preserve raw IDs and event order. */
export function summarizeStewardship<T extends ReadingRow>(rows:readonly T[],byId:ReadonlyMap<string,WorldEvent>){
 const result:T[]=[];
 let group:{assignmentId:string;index:number;lastMonth:number;count:number}|undefined;
 for(const row of rows){
  const event=byId.get(row.id),assignmentId=event?.metadata?.assignmentId;
  if(event?.type==='civil-stewardship-assessed'&&typeof assignmentId==='string'){
   if(group?.assignmentId===assignmentId){
    const first=result[group.index];
    group.count++;
    group.lastMonth=row.month;
    result[group.index]={...first,text:`自${formatWorldDate(first.month)}至${formatWorldDate(group.lastMonth)}，本任内先后${group.count}次守成考课称职。`,sources:[...(first.sources.length?first.sources:[first.id]),...(row.sources.length?row.sources:[row.id])]};
    continue;
   }
   group={assignmentId,index:result.length,lastMonth:row.month,count:1};
  }else if(event&&boundaryEvents.has(event.type))group=undefined;
  result.push(row);
 }
 return result;
}
