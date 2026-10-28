import {createMilitaryArchiveIndex} from './MilitaryArchiveIndex';
import {useMemo,type ReactNode} from 'react';
import Military,{type MilitaryPerson,type MilitaryFormation} from '../../../Politics/MilitaryCommandRegistry';
import type {WorldEvent} from '../../../History/WorldHistory';
import type {Dynasty} from '../../../Politics/Dynasty';
import type Team from '../../../Components/Team';
import {composeMilitaryBiography} from '../../../Politics/PersonBiography';
import {militaryPoliticalLife,appendMilitaryPoliticalLife} from '../../../Politics/MilitaryPoliticalLife';
import {militaryMilestones,selectMilitaryMilestones} from './PersonChroniclePresentation';
function project(person:MilitaryPerson,factionId:string,month:number,events:WorldEvent[],dynasties:Dynasty[],factions:Map<string,Team>){
 const entries=Military.getChronicle(person,month,factionId),local=events.filter(e=>e.actorFactionId===factionId||e.targetFactionId===factionId||e.factionIds?.includes(factionId));
 const life=militaryPoliticalLife(person,dynasties,events,factions,month),allMilestones=appendMilitaryPoliticalLife(militaryMilestones(person,entries,local,{factions}),life);
 return {entries,allMilestones,milestones:selectMilitaryMilestones(allMilestones,local,8),career:Military.getCareer(person,month),bio:composeMilitaryBiography(person,entries,factionId)};
}
/** UI-only cache. Live bindings/commands, ages and diagnostics remain outside this historical projection. */
export default function MilitaryDetailProjection({person,factionId,month,events,dynasties,formations,factions,children,eventIndex}:{person:MilitaryPerson;factionId:string;month:number;events:WorldEvent[];eventIndex?:ReturnType<typeof createMilitaryArchiveIndex>;dynasties:Dynasty[];formations:MilitaryFormation[];factions:Map<string,Team>;children:(p:ReturnType<typeof project>)=>ReactNode}){
 const countries=new Set(person.appointments.map(a=>a.factionId).concat(person.factionId,person.royalIdentity?.factionId??''));
 const political=person.politicalRulerId?dynasties.find(d=>d.rulers.some(r=>r.id===person.politicalRulerId)):undefined;if(political)countries.add(political.factionId);
 const relevant=(eventIndex??createMilitaryArchiveIndex(events)).related(countries);
 // Recorded events are immutable inside a world. IDs detect appends/backdated additions;
 // object identity detects hydration/reset even if the new world reuses the same IDs.
 const eventKey=relevant.map(e=>e.id).join('|'),personKey=JSON.stringify(person),formationKey=JSON.stringify(formations.filter(f=>f.commanderPersonId===person.personId));
 const serviceClock=person.status==='ACTIVE'||person.appointments.some(a=>a.endMonth===undefined)?month:0;
 const value=useMemo(()=>project(person,factionId,month,events,dynasties,factions),[factionId,eventKey,relevant[0],personKey,formationKey,serviceClock]);
 return <>{children(value)}</>;
}
