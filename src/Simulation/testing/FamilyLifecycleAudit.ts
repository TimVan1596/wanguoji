import {createFamilyArchiveIndex,projectFamilyArchive,type FamilyArchiveSource} from '../../Politics/FamilyArchiveProjection';
import type {MilitaryFamily} from '../../Politics/MilitaryFamily';
import type {CivilGovernorTerm} from '../../Politics/CivilAdministrationSchema';
/** Read-only checkpoint audit. These overlapping categories are not a new simulation lifecycle. */
export function auditFamilyLifecycle(s:FamilyArchiveSource,families:readonly MilitaryFamily[],civil:readonly CivilGovernorTerm[]){
 const index=createFamilyArchiveIndex(s),civilIds=new Set(civil.filter(t=>t.startMonth<=s.month&&t.endMonth===undefined).map(t=>`${t.sourceUserId}/${t.bornMonth}`));
 const rows=families.map(f=>{const p=projectFamilyArchive(f,s,index),members=[...p.rows.values()],hasCivil=members.some(r=>civilIds.has(`${r.member.sourceUserId}/${r.member.bornMonth}`)),formal=hasCivil||members.some(r=>r.activeOffice||r.political&&(r.political.r.endYear??Infinity)>s.month),title=members.some(r=>r.inherited||r.effectivePersonal),ended=p.last?.kind==='ENDED';
  return {familyId:f.familyId,members:f.members.length,living:p.living,unknown:p.unknown,politicalMembers:p.activeMembers+(hasCivil?1:0),generations:Math.max(...f.members.map(m=>m.generation))+1,hasEffectiveTitle:title,ended:!!ended,hasFormalService:formal,dormantReadingOnly:!!ended&&!formal&&!title,revived:p.acts.some(a=>a.kind==='STARTED'&&a.reason==='NEW_MERIT'),extinct:p.classification==='EXTINCT',ordinaryKinOnly:!formal&&!title&&p.living>0,successions:p.actualSuccessions,births:f.members.filter(m=>m.birth).length,residentEntries:f.members.filter(m=>m.sourceUserId!==undefined).length};});
 const count=(test:(row:typeof rows[number])=>boolean)=>rows.filter(test).length;
 return {scope:'READ_ONLY_OVERLAPPING_CATEGORIES_NO_DORMANCY_POLICY',families:rows.length,members:rows.reduce((n,r)=>n+r.members,0),effectiveTitle:count(r=>r.hasEffectiveTitle),endedWithFormalService:count(r=>r.ended&&r.hasFormalService),endedWithoutPoliticalActivity:count(r=>r.dormantReadingOnly),revived:count(r=>r.revived),extinct:count(r=>r.extinct),ordinaryKinOnly:count(r=>r.ordinaryKinOnly),rows};
}
