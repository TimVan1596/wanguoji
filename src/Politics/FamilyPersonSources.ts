import type {FamilyArchiveProjection} from './FamilyArchiveProjection';
import {NOBLE_RANKS} from './MilitaryNobility';
/** All references come from the same saved member graph and event-bound archive. */
export function familyPersonSources(archive:FamilyArchiveProjection,memberId:string){
 const row=archive.rows.get(memberId);if(!row)return;
 const parent=row.member.parentMemberId?archive.rows.get(row.member.parentMemberId):undefined;
 const parentHighest=[...(parent?.personalHistory??[])].sort((a,b)=>NOBLE_RANKS.indexOf(b.rank)-NOBLE_RANKS.indexOf(a.rank)||b.month-a.month)[0];
 return {familyId:archive.family.familyId,surname:archive.family.surname,generation:row.member.generation+1,parent,parentHighest,personal:row.personalHistory.map(grant=>({grant,effective:row.effectivePersonal?.eventId===grant.eventId,source:grant.basis==='COURT'?'从龙政治恩爵':grant.basis==='FOUNDING'?'开国政治恩爵':'本人军功授爵'})),inherited:row.inheritedHistory.map(act=>({act,predecessor:archive.rows.get(act.previousMemberId),effective:row.inherited?.eventId===act.eventId,endedBy:archive.acts.find(a=>a.step>act.step&&a.previousMemberId===memberId)})),appointments:row.appointments,life:row.life};
}
