import {isLinkedLastCityCapture,terminalCaptureKind} from '../History/TerminalConflictReading';
import type {WorldEvent} from '../History/WorldHistory';
import type {RulerSaveV17,WorldSaveV1} from './WorldSaveSchema';

/** Recheck the frozen participants against canonical capture and reign records. */
export function validateTerminalConflictParticipants(save:WorldSaveV1){
 const errors:string[]=[],events=save.worldHistory.events as WorldEvent[];
 const byId=new Map(events.map((event,index)=>[event.id,{event,index}]));
 const accessions=new Map<string,number>(),losses=new Map<string,number>();
 const first=(map:Map<string,number>,id:unknown,index:number)=>{if(typeof id==='string'&&!map.has(id))map.set(id,index);};
 events.forEach((e,index)=>{
  if(e.type==='ruler-acceded')first(accessions,e.rulerId,index);
  if(e.type==='ruler-succession'){
   first(accessions,e.metadata?.nextRulerId,index);
   first(losses,e.metadata?.previousRulerId,index);
  }
  if(e.type==='ruler-captured'||e.type==='ruler-died')first(losses,e.rulerId,index);
 });
 const rulers=new Map(save.dynasties.flatMap(d=>(d.rulers as RulerSaveV17[]).map(r=>[r.rulerId,{r,factionId:d.factionId}] as const)));
 for(const event of events){
  if(!['faction-extinct','faction-dissolved','faction-exiled'].includes(event.type))continue;
  const m=event.metadata;
  if(!m||![m.victorRulerId,m.defeatedRulerId,m.victorRulerTitle,m.defeatedRulerTitle].some(v=>v!==undefined))continue;
  const capture=typeof m.terminalCaptureEventId==='string'?byId.get(m.terminalCaptureEventId):undefined;
  const terminal=byId.get(event.id)!,month=event.monthIndex??event.year;
  if(!capture||capture.index>=terminal.index||event.type==='faction-exiled'&&!isLinkedLastCityCapture(event,capture.event)||
    event.type!=='faction-exiled'&&!terminalCaptureKind(event,capture.event)){
   errors.push(`invalid terminal conflict capture for ${event.id}`);
   continue;
  }
  for(const [id,title,factionId] of [[m.victorRulerId,m.victorRulerTitle,event.conquerorFactionId],[m.defeatedRulerId,m.defeatedRulerTitle,event.targetFactionId]]){
   if(id===undefined&&title===undefined)continue;
   const row=typeof id==='string'?rulers.get(id):undefined,r=row?.r;
   const name=r?`${r.houseName.replace(/氏$/,'')}${r.givenName}`:undefined;
   if(!r||row.factionId!==factionId||r.accessionMonth===undefined||r.accessionMonth>month||(r.endMonth??Infinity)<month||(r.deathMonth??Infinity)<month||
     r.accessionMonth===month&&(accessions.get(r.rulerId)??-1)>capture.index||
     (r.endMonth===month||r.deathMonth===month)&&(losses.get(r.rulerId)??Infinity)<capture.index||
     title!==undefined&&(typeof title!=='string'||!name||!title.endsWith(name))){
    errors.push(`invalid terminal conflict ruler for ${event.id}`);
   }
  }
 }
 return errors;
}
