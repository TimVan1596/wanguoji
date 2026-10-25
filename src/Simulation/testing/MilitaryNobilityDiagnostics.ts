import {deriveMilitaryCareer} from '../../Politics/MilitaryCareerEvidence';
import type {MilitaryPerson,MilitaryFormation} from '../../Politics/MilitaryCommandRegistry';
import type {WorldEvent} from '../../History/WorldHistory';
/** Read-only sampling works on frozen z21 as well as the current production source. */
export function militaryNobilityDiagnostics(people:MilitaryPerson[],formations:MilitaryFormation[],events:WorldEvent[],month:number){
 const rows=people.flatMap(p=>[...new Set(p.appointments.map(a=>a.factionId))].map(factionId=>{const career=deriveMilitaryCareer({...p,appointments:p.appointments.filter(a=>a.factionId===factionId)},formations,events,month),ids=new Set(career.capturedEventIds),wins=events.filter(e=>ids.has(e.id)),cities=new Set(wins.map(e=>e.cityId)),important=new Set(wins.filter(e=>e.metadata?.wasCapital===1||e.type==='city-recovered'&&e.metadata?.founderCapital===1&&e.founderFactionId===factionId).map(e=>e.cityId));return {personId:p.personId,factionId,serviceMonths:career.serviceMonths,captures:wins.length,distinctCities:cities.size,importantCities:important.size};}));
 const grants=people.flatMap(p=>(p as any).nobilityHistory??[]);
 return {meritRows:rows,grants,rankCounts:Object.fromEntries(['BO','HOU','GONG'].map(rank=>[rank,grants.filter(g=>g.rank===rank).length])),titledPeople:new Set(grants.map(g=>g.personId)).size};
}
