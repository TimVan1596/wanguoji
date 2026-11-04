import type {WorldSaveV1} from '../../Persistence/WorldSaveSchema';
import type {WorldEvent} from '../../History/WorldHistory';
import {militarySecessionEvidenceHistory} from '../../Persistence/MilitarySecessionValidation';
import {deriveMilitaryCareer} from '../../Politics/MilitaryCareerEvidence';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
/** Audit actual natural transactions; do not synthesize a siege or substitute a world simulation. */
export function checkNaturalSecessionBoundaries(snapshot:WorldSaveV1){
 const events=snapshot.worldHistory.events as WorldEvent[],state=snapshot.registries.militaryCommandRegistry;
 let cases=0,rejectedForgeries=0;
 for(const ruler of snapshot.dynasties.flatMap(d=>d.rulers as any[])){
  const e=ruler.residentIdentity?.military;if(e?.entryKind!=='LOCAL_CRISIS')continue;
  const p=state.people.find(p=>p.personId===e.personId);if(!p)throw Error('Natural secession missing original person');
  const prefix=militarySecessionEvidenceHistory(events,e),known=new Set(deriveMilitaryCareer(p,state.formations,prefix,e.worldMonth).activities.map(a=>a.eventId)),late=deriveMilitaryCareer(p,state.formations,events,e.worldMonth).activities.filter(a=>!known.has(a.eventId));
  if(!late.length)continue;cases++;
  const forged=structuredClone(snapshot),r=forged.dynasties.flatMap(d=>d.rulers as any[]).find(r=>r.rulerId===ruler.rulerId),military=r.residentIdentity.military;
  military.localCareerEventIds=[...new Set([...(military.localCareerEventIds??[]),late[0].eventId])].sort();
  const founding=(forged.worldHistory.events as WorldEvent[]).find(x=>x.type==='empire-split'&&x.metadata?.foundingRulerId===r.rulerId);if(!founding?.metadata)throw Error('Natural secession missing original founding');
  founding.metadata.militarySplitEvidence=JSON.stringify(military);
  const validation=validateWorldSave(forged);
  if(validation.valid||!validation.errors.some(error=>error.includes('military secession identity')&&error.includes(r.rulerId)))throw Error('Post-checkpoint battle falsely admitted as prior secession evidence');
  rejectedForgeries++;
 }
 return {actualLateSameMonthCases:cases,rejectedPostCheckpointForgeries:rejectedForgeries};
}
