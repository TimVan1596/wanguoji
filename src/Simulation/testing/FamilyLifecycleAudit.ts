import type {WorldSaveV1,RulerSaveV17} from '../../Persistence/WorldSaveSchema';
import {importRulerSave} from '../../Persistence/RulerSaveProjection';
import type {WorldEvent} from '../../History/WorldHistory';
import {createFamilyArchiveIndex,projectFamilyArchive} from '../../Politics/FamilyArchiveProjection';
import {familyAtEvidenceBoundary} from '../../Politics/FamilyNobleSuccession';
/** Coverage audit on one real saved history. No new simulation, identities or altered save. */
export function auditFamilyLifecycle(save:WorldSaveV1){
 const events=save.worldHistory.events as WorldEvent[],positions=new Map(events.map((e,i)=>[e.id,i])),people=save.registries.militaryCommandRegistry.people,families=save.registries.militaryCommandRegistry.families??[],month=save.world.worldMonth;
 const dynasties=save.dynasties.map(d=>({...d,rulers:(d.rulers as RulerSaveV17[]).map(importRulerSave)})) as any[],source={month,people,events,dynasties},index=createFamilyArchiveIndex(source),perFamily:any[]=[],cuts=new Set<string>();
 const rows:Array<{familyId:string;memberId:string;month:number;chainEnded:boolean;entryWhileInactiveEnded:boolean;laterMilitary:boolean;laterNewPeriod:boolean;laterMonarch:boolean;ancestorCut?:boolean}>=[];
 for(const f of families){
  const projection=projectFamilyArchive(f,source,index),current=f.nobleSuccession?.at(-1);
  perFamily.push({familyId:f.familyId,members:f.members.length,activePolitical:projection.classification==='ACTIVE',effectiveTitle:!!projection.locatableTitleHolderId,chainEnded:current?.kind==='ENDED',unknownLiving:projection.unknown,registeredLiving:projection.living,bytes:new TextEncoder().encode(JSON.stringify(f)).byteLength});
  for(const m of f.members.filter(m=>m.source==='NATURAL_GROWTH')){
   const boundary=positions.get(`${m.memberId}-entered`);if(boundary===undefined)throw Error('Unverifiable family entry');
   const acts=f.nobleSuccession?.filter(a=>(positions.get(a.eventId)??Infinity)<boundary),last=acts?.at(-1);let inactive=false;
   if(last?.kind==='ENDED'){
    const historical=familyAtEvidenceBoundary({...f,nobleSuccession:acts},m.enteredMonth,boundary,events),before=projectFamilyArchive(historical,{month:m.enteredMonth,people,events:events.slice(0,boundary),dynasties});
    inactive=before.classification!=='ACTIVE';if(inactive)cuts.add(m.memberId);
   }
   const p=people.find(p=>p.personId===m.militaryPersonId),political=index.byResident.get(`${m.sourceUserId}/${m.bornMonth}`)??(m.militaryPersonId?index.byMilitary.get(`${m.militaryPersonId}/${m.bornMonth}`):undefined);
   rows.push({familyId:f.familyId,memberId:m.memberId,month:m.enteredMonth,chainEnded:last?.kind==='ENDED',entryWhileInactiveEnded:inactive,laterMilitary:!!p?.appointments.some(a=>a.startMonth>=m.enteredMonth),laterNewPeriod:!!f.nobleSuccession?.some(a=>a.kind==='STARTED'&&a.holderMemberId===m.memberId),laterMonarch:!!political});
  }
 }
 let cycles=0;for(const f of families){const byId=new Map(f.members.map(m=>[m.memberId,m]));for(const row of rows.filter(r=>r.familyId===f.familyId)){let id:string|undefined=row.memberId;const seen=new Set<string>();while(id){if(seen.has(id)){cycles++;break;}seen.add(id);if(cuts.has(id))row.ancestorCut=true;id=byId.get(id)?.parentMemberId;}}}
 const affected=rows.filter(r=>r.ancestorCut),bands=[];for(let start=0;start<month;start+=1200){const end=Math.min(month,start+1200),within=(at:number)=>(start===0?at>=0:at>start)&&at<=end;bands.push({startMonth:start,endMonth:end,newHouses:families.filter(f=>within(f.foundedMonth)).length,newRegisteredMembers:families.flatMap(f=>f.members).filter(m=>within(m.enteredMonth)).length,newDescendants:rows.filter(r=>within(r.month)).length});}
 return {scope:'READ_ONLY_COVERAGE_ON_ACTUAL_EVENT_BOUNDARIES_NOT_A_COUNTERFACTUAL_WORLD_OR_CPU_BENCHMARK',month,families:families.length,members:families.reduce((n,f)=>n+f.members.length,0),familySaveBytes:perFamily.reduce((n,f)=>n+f.bytes,0),saveBytes:new TextEncoder().encode(JSON.stringify(save)).byteLength,effectiveTitleHouses:perFamily.filter(f=>f.effectiveTitle).length,endedHouses:perFamily.filter(f=>f.chainEnded).length,activeHouses:perFamily.filter(f=>f.activePolitical).length,entriesWhileChainEnded:rows.filter(r=>r.chainEnded).length,laterOfficersFromEndedEntries:rows.filter(r=>r.chainEnded&&r.laterMilitary).length,laterNewPeriodsFromEndedEntries:rows.filter(r=>r.chainEnded&&r.laterNewPeriod).length,cycles,bands,archiveCoverage:{condition:'At the original entry boundary: latest main chain ENDED and no actual active political member. Evaluate on the unmodified real history, then trace identity coverage through actual parent links; does not predict changed future events.',directRejected:cuts.size,descendantIdentityRecordsAffected:affected.length,actualLaterOfficersAffected:affected.filter(r=>r.laterMilitary).length,actualLaterNewPeriodFoundersAffected:affected.filter(r=>r.laterNewPeriod).length,actualLaterMonarchsAffected:affected.filter(r=>r.laterMonarch).length},perFamily,rows};
}
