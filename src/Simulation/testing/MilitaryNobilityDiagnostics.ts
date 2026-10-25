import {deriveMilitaryCareer} from '../../Politics/MilitaryCareerEvidence';
import type {MilitaryPerson,MilitaryFormation} from '../../Politics/MilitaryCommandRegistry';
import type {WorldEvent} from '../../History/WorldHistory';
/** Read-only sampling works on frozen z21 as well as the current production source. */
export function militaryNobilityDiagnostics(people:MilitaryPerson[],formations:MilitaryFormation[],events:WorldEvent[],month:number){
 const rows=people.flatMap(p=>[...new Set(p.appointments.map(a=>a.factionId))].map(factionId=>{const career=deriveMilitaryCareer({...p,appointments:p.appointments.filter(a=>a.factionId===factionId)},formations,events,month),ids=new Set(career.capturedEventIds),wins=events.filter(e=>ids.has(e.id)),cities=new Set(wins.map(e=>e.cityId)),important=new Set(wins.filter(e=>e.metadata?.wasCapital===1||e.type==='city-recovered'&&e.metadata?.founderCapital===1&&e.founderFactionId===factionId).map(e=>e.cityId));return {personId:p.personId,factionId,serviceMonths:career.serviceMonths,captures:wins.length,distinctCities:cities.size,importantCities:important.size};}));
 const honors=people.flatMap(p=>p.honorHistory??[]),deceasedByHistoricalRank:Record<string,number>={BO:0,HOU:0,GONG:0},unhonoredAtCheckpoint:Record<string,number>={};
 for(const p of people.filter(p=>p.deathMonth!==undefined)){
  const old=(p.nobilityHistory??[]).filter(g=>g.month<=p.deathMonth!).sort((a,b)=>['BO','HOU','GONG'].indexOf(b.rank)-['BO','HOU','GONG'].indexOf(a.rank))[0];if(!old)continue;deceasedByHistoricalRank[old.rank]++;
  if(p.honorHistory?.some(h=>h.kind==='POSTHUMOUS'))continue;
  const row=rows.find(r=>r.personId===p.personId&&r.factionId===old.factionId),battle=p.deathCause==='BATTLE_DEATH',merit=!!row&&(battle&&row.distinctCities>=2&&row.serviceMonths>=60||old.rank!=='BO'&&row.distinctCities>=4&&row.importantCities>=1&&row.serviceMonths>=120);
  const reason=p.politicalRulerId?'FORMER_SOVEREIGN':p.honorHistory?.some(h=>h.kind==='REVOKED')?'REVOKED':!merit?'INSUFFICIENT_DISTINGUISHED_MERIT':'AUTHORITY_REGIME_OR_ANNUAL_TIMING';unhonoredAtCheckpoint[reason]=(unhonoredAtCheckpoint[reason]??0)+1;
 }
 const secessions=events.filter(e=>e.type==='empire-split'&&typeof e.metadata?.militaryPersonId==='string'&&typeof e.metadata?.militarySplitEvidence==='string');
 const titledSecessions=secessions.filter(e=>people.some(p=>p.personId===e.metadata?.militaryPersonId&&p.nobilityHistory?.some(g=>g.factionId===e.targetFactionId&&g.month<=(e.monthIndex??e.year))));
 const grants=people.flatMap(p=>(p as any).nobilityHistory??[]);
 return {honors,posthumous:honors.filter(h=>h.kind==='POSTHUMOUS').length,revocations:honors.filter(h=>h.kind==='REVOKED').length,deceasedByHistoricalRank,unhonoredAtCheckpoint,titledSecessions:titledSecessions.length,meritRows:rows,grants,rankCounts:Object.fromEntries(['BO','HOU','GONG'].map(rank=>[rank,grants.filter(g=>g.rank===rank).length])),titledPeople:new Set(grants.map(g=>g.personId)).size};
}
