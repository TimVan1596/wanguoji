import type {WorldSaveV1,RulerSaveV17} from '../../Persistence/WorldSaveSchema';
import {importRulerSave} from '../../Persistence/RulerSaveProjection';
import type {WorldEvent} from '../../History/WorldHistory';
import {familyAtEvidenceBoundary} from '../../Politics/FamilyNobleSuccession';
import {projectFamilyArchive} from '../../Politics/FamilyArchiveProjection';
/** Counterfactual registration coverage only. Does not simulate a second world,
 * assign a new father or predict what the rejected resident would later do. */
export function auditHouseFocusedRegistration(save:WorldSaveV1){
 const events=save.worldHistory.events as WorldEvent[],positions=new Map(events.map((e,i)=>[e.id,i])),people=save.registries.militaryCommandRegistry.people,dynasties=save.dynasties.map(d=>({...d,factionId:String(d.factionId),rulers:(d.rulers as RulerSaveV17[]).map(importRulerSave)})) as any[];
 const rows:Array<{familyId:string;memberId:string;enteredMonth:number;accepted:boolean;reason:string;laterMilitary:boolean;laterPersonalGrant:boolean;laterInheritance:boolean;laterNewPeriod:boolean}>=[];
 for(const f of save.registries.militaryCommandRegistry.families??[]){const accepted=new Set(f.members.filter(m=>m.source==='FOUNDER').map(m=>m.memberId));
  for(const m of f.members.filter(m=>m.source!=='FOUNDER').sort((a,b)=>a.enteredMonth-b.enteredMonth||(positions.get(`${a.memberId}-entered`)??0)-(positions.get(`${b.memberId}-entered`)??0))){
   const i=positions.get(`${m.memberId}-entered`);if(i===undefined)throw Error('Cannot audit an unsourced family entry');
   const before=familyAtEvidenceBoundary({...f,nobleSuccession:f.nobleSuccession?.filter(a=>(positions.get(a.eventId)??Infinity)<i)},m.enteredMonth,i,events);before.members=before.members.filter(m=>accepted.has(m.memberId));
   const parentKnown=!!m.parentMemberId&&accepted.has(m.parentMemberId),reading=parentKnown?projectFamilyArchive(before,{month:m.enteredMonth,people,events:events.slice(0,i),dynasties}):undefined,allow=!!parentKnown&&reading?.classification==='ACTIVE';if(allow)accepted.add(m.memberId);
   const person=people.find(p=>p.personId===m.militaryPersonId);
   rows.push({familyId:f.familyId,memberId:m.memberId,enteredMonth:m.enteredMonth,accepted:allow,reason:!parentKnown?'PARENT_NOT_RECORDED':allow?'ACTIVE_POLITICAL_HOUSE':'NO_CURRENT_POLITICAL_STANDING',laterMilitary:!!person?.appointments.length,laterPersonalGrant:!!person?.nobilityHistory?.length,laterInheritance:!!f.nobleSuccession?.some(a=>a.kind==='SUCCEEDED'&&a.holderMemberId===m.memberId),laterNewPeriod:!!f.nobleSuccession?.some(a=>a.kind==='STARTED'&&a.holderMemberId===m.memberId)});
  }
 }
 const rejected=rows.filter(r=>!r.accepted);
 return {scope:'READ_ONLY_COUNTERFACTUAL_COVERAGE_ON_REAL_EVENTS_NOT_AN_ALTERNATIVE_SIMULATION',considered:rows.length,retained:rows.length-rejected.length,rejected:rejected.length,recordedMilitaryLineagesLost:rejected.filter(r=>r.laterMilitary).length,recordedPersonalGrantLineagesLost:rejected.filter(r=>r.laterPersonalGrant).length,recordedInheritanceLineagesLost:rejected.filter(r=>r.laterInheritance).length,recordedNewPeriodLineagesLost:rejected.filter(r=>r.laterNewPeriod).length,rows};
}
