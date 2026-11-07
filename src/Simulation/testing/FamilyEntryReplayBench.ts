import type {WorldSaveV1} from '../../Persistence/WorldSaveSchema';
import type {WorldEvent} from '../../History/WorldHistory';
import {familyAtEvidenceBoundary} from '../../Politics/FamilyNobleSuccession';
import {planFamilyPopulationEntry} from '../../Politics/MilitaryFamily';
import rng from '../WorldRandom';
/** Repeated pure planning of the last 64 actually committed entries, using each
 * original evidence boundary. These are CPU queries, never new resident events. */
export function benchmarkActualFamilyEntries(save:WorldSaveV1){
 const events=save.worldHistory.events as WorldEvent[],positions=new Map(events.map((e,i)=>[e.id,i])),families=save.registries.militaryCommandRegistry.families??[];
 const queries=events.filter(e=>e.type==='military-family-member-entered').slice(-64).map(e=>{
  const m=e.metadata!,family=families.find(f=>f.familyId===m.familyId)!;if(!family)throw Error('Missing actual family entry source');
  const month=e.monthIndex??e.year,boundary=positions.get(e.id)!,historical=families.filter(f=>(positions.get(`${f.familyId}-founded`)??Infinity)<boundary).map(f=>{const copy=familyAtEvidenceBoundary(f,month,boundary,events);copy.renewals=copy.renewals?.filter(r=>(positions.get(`${f.familyId}-${r.memberId}-merit`)??Infinity)<boundary);return copy;});
  return {args:[historical,e.actorFactionId!,family.epochFounderId,Number(m.sourceUserId),Number(m.bornMonth),month,String(save.worldRandom.seed)] as const,expected:{familyId:family.familyId,parentMemberId:m.parentMemberId,name:m.residentName}};
 });
 const before=JSON.stringify(queries),randomBefore=JSON.stringify(rng.exportState());
 for(const q of queries){const p=planFamilyPopulationEntry(...q.args);if(!p||p.familyId!==q.expected.familyId||p.member.parentMemberId!==q.expected.parentMemberId||p.member.name!==q.expected.name)throw Error('Historical entry planning failed its actual parent/name evidence');}
 const repetitions=1000,start=performance.now();for(let n=0;n<repetitions;n++)for(const q of queries)planFamilyPopulationEntry(...q.args);const elapsedMs=performance.now()-start;
 if(before!==JSON.stringify(queries)||randomBefore!==JSON.stringify(rng.exportState()))throw Error('Pure historical entry benchmark mutated a family or RNG');
 return {scope:'CONTROLLED_REPEATED_PURE_PRODUCTION_PLANNER_ON_ACTUAL_ACCEPTED_ENTRIES_NOT_NATURAL_ENTRY_COUNTS',cases:queries.length,repetitions,calls:queries.length*repetitions,elapsedMs,meanMs:queries.length?elapsedMs/(queries.length*repetitions):0,actualParentAndNameVerified:true};
}
