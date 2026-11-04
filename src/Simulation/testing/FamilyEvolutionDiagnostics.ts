import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import {projectFamilyArchive} from '../../Politics/FamilyArchiveProjection';
import {projectFamilyTrunk} from '../../UI/Components/FactionDetails/militaryFamilyTree';
/** Read-only measurements on the actual world; no candidate generation or extra RNG. */
export function familyEvolutionDiagnostics(core:any,snapshot:any){
 const month=core.simulator.year,people=Military.getPeople(),families=Military.getFamilies(),events=History.getRecordedEvents(),byEvent=new Map(events.map(e=>[e.id,e])),grants=people.flatMap(p=>p.nobilityHistory??[]),source={month,people,events,dynasties:Dynasty.getAll()};
 const types:Record<string,number>={MILITARY_BO:0,MILITARY_HOU:0,MILITARY_GONG:0,COURT:0,FOUNDING:0};for(const g of grants)types[g.basis??`MILITARY_${g.rank}`]++;
 const charters:Record<string,number>={MILITARY_BO:0,MILITARY_HOU:0,MILITARY_GONG:0,COURT:0,FOUNDING:0};
 for(const f of families){const e=byEvent.get(f.sourceEventId),g=grants.find(g=>g.eventId===f.sourceEventId);const k=g?.basis??(g?`MILITARY_${g.rank}`:e?.type==='court-service-granted'?'COURT':'UNKNOWN');charters[k]=(charters[k]??0)+1;}
 const begin=performance.now();let visible=0;for(const f of families){const archive=projectFamilyArchive(f,source);visible+=projectFamilyTrunk(f.members,archive.importantIds).members.length;}const projectionMs=performance.now()-begin;
 const saveStart=performance.now(),text=JSON.stringify(snapshot),serializationMs=performance.now()-saveStart;
 return {grantSources:types,charterSources:charters,historicalMembers:families.reduce((n,f)=>n+f.members.length,0),livingMembers:families.reduce((n,f)=>n+f.members.filter(m=>m.deathMonth===undefined&&core.teams.some((t:any)=>[...t.users].some((u:any)=>u.id===m.sourceUserId&&u.bornMonth===m.bornMonth))).length,0),visibleTrunkMembers:visible,projectionMs,serializationMs,saveBytes:new TextEncoder().encode(text).byteLength,secondGenerationOfficers:families.reduce((n,f)=>n+f.members.filter(m=>m.generation===1&&m.militaryPersonId).length,0),thirdGenerationOfficers:families.reduce((n,f)=>n+f.members.filter(m=>m.generation===2&&m.militaryPersonId).length,0),descendantPersonalGrants:families.reduce((n,f)=>n+f.members.filter(m=>m.generation>0&&m.militaryPersonId&&people.some(p=>p.personId===m.militaryPersonId&&p.nobilityHistory?.length)).length,0),duplicateFamilies:families.length-new Set(families.map(f=>`${f.founderPersonId}/${f.epochFounderId}`)).size};
}
