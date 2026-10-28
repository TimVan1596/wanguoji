import {createMilitaryEvidenceIndex,type MilitaryEvidenceIndex} from './MilitaryEvidenceIndex';
import {deriveMilitaryActivities} from './MilitaryExperience';
import type {MilitaryPerson,MilitaryFormation} from './MilitaryCommandRegistry';
import type {Dynasty} from './Dynasty';
import type {WorldEvent} from '../History/WorldHistory';
import {deriveMilitaryCareer,militaryServiceMonths} from './MilitaryCareerEvidence';
import {formatRulerTitleAtMonth} from './RulerTitleRules';
import {getHistoricalFactionIdentity} from '../History/HistoricalFactionIdentity';
import {type MilitaryOffice} from './MilitaryOffice';
export const NOBLE_RANKS=['BO','HOU','GONG'] as const;
export type NobleRank=typeof NOBLE_RANKS[number];
export const NOBLE_NAMES:Record<NobleRank,string>={BO:'伯爵',HOU:'侯爵',GONG:'公爵'};
export const NOBLE_RULES={BO:{serviceMonths:60,cities:2,importantCities:0},HOU:{serviceMonths:120,cities:4,importantCities:1},GONG:{serviceMonths:180,cities:6,importantCities:2}};
export interface NobleGrant {
 eventId:string;personId:string;sourceUserId:number;bornMonth:number;personalName:string;factionId:string;countryName:string;
 epochFounderId:string;rulerId:string;rulerTitle:string;month:number;previousRank:NobleRank|'NONE';rank:NobleRank;
 commandId:string;office:MilitaryOffice;serviceMonths:number;captureEventIds:string[];cityIds:string[];importantCityIds:string[];importantEventIds:string[];
}
export function deriveNobleMerits(p:MilitaryPerson,formations:MilitaryFormation[],events:WorldEvent[],factionId:string,month:number,index?:MilitaryEvidenceIndex){
 const local={...p,appointments:p.appointments.filter(a=>a.factionId===factionId)},career=deriveMilitaryCareer(local,formations,events,month,index),ids=new Set(career.capturedEventIds);
 const captures=(index?[...ids].flatMap(id=>index.allById.get(id)??[]):events.filter(e=>ids.has(e.id))).sort((a,b)=>(a.monthIndex??a.year)-(b.monthIndex??b.year)||a.id.localeCompare(b.id));
 const cities=new Map<string,WorldEvent>(),important=new Map<string,string>();
 for(const e of captures){if(e.cityId&&!cities.has(e.cityId))cities.set(e.cityId,e);if(e.cityId&&(e.metadata?.wasCapital===1||e.type==='city-recovered'&&e.metadata?.founderCapital===1&&e.founderFactionId===factionId))if(!important.has(e.cityId))important.set(e.cityId,e.id);}
 // Honor cards distinguish real attack and defense; promotion keeps its original one-location rule.
 const achievements=deriveMilitaryActivities(local,formations,events,month,career.capturedEventIds,true,index),defenses=achievements.filter(a=>a.kind==='DEFENSE'),sieges=achievements.filter(a=>a.kind==='SIEGE');
 return {defenseEventIds:defenses.map(a=>a.eventId),defendedCityIds:[...new Set(defenses.map(a=>a.cityId))],siegeEventIds:sieges.map(a=>a.eventId),serviceMonths:career.serviceMonths,captureEventIds:[...cities.values()].map(e=>e.id),cityIds:[...cities.keys()],importantCityIds:[...important.keys()].sort(),importantEventIds:[...important.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(e=>e[1]),captures:captures.length,activities:career.activities.length};
}
export function nobleEpoch(d:Pick<Dynasty,'houseEpochs'>|undefined,month:number){return d?.houseEpochs?.find(e=>e.startMonth<=month&&month<=(e.endMonth??Infinity));}
export function currentNobleGrant(p:MilitaryPerson,factionId:string,month:number,epochFounderId?:string){
 return (p.nobilityHistory??[]).filter(g=>g.factionId===factionId&&g.month<=month&&!(p.honorHistory??[]).some(h=>h.kind==='REVOKED'&&h.month<=month&&h.factionId===g.factionId&&h.epochFounderId===g.epochFounderId)&&(!epochFounderId||g.epochFounderId===epochFounderId)).sort((a,b)=>NOBLE_RANKS.indexOf(b.rank)-NOBLE_RANKS.indexOf(a.rank)||b.month-a.month)[0];
}
export function nobleLabel(p:MilitaryPerson,factionId:string,month=Infinity){const g=currentNobleGrant(p,factionId,month);return g?`${g.countryName} · ${NOBLE_NAMES[g.rank]}`:'';}
/** No randomness, population, office promotion or city ownership mutation. */
export function nextNobleGrant(p:MilitaryPerson,formations:MilitaryFormation[],events:WorldEvent[],month:number,team:any,dy:Dynasty):NobleGrant|undefined{
 if(month%12!==0||p.status!=='ACTIVE'||p.deathMonth!==undefined||p.politicalRulerId||team.status!=='ACTIVE'||team.identityStage!=='STATE'||p.factionId!==team.name||dy.factionId!==team.name||team.stateFoundedMonth===undefined||team.stateFoundedMonth>month||(p.nobilityHistory??[]).some(g=>g.month===month))return;
 const ruler=dy.rulers.find(r=>r.id===dy.currentRulerId),epoch=nobleEpochForRuler(dy,dy.currentRulerId);
 if(!ruler||!epoch||ruler.status!=='ruling'||ruler.accessionYear===undefined||ruler.accessionYear>month||ruler.endYear!==undefined||ruler.deathMonth!==undefined||ruler.naturalDeathYear!==undefined&&ruler.naturalDeathYear<=month||!['KING','EMPEROR'].includes(team.sovereigntyRank))return;
 const a=p.appointments.find(a=>a.factionId===team.name&&a.endMonth===undefined&&a.startMonth<=month),office=a?.officeHistory?.filter(g=>g.month<=month).at(-1)?.office;
 if(!a||!office||!formations.some(f=>f.commandId===a.commandId&&f.commanderPersonId===p.personId&&f.factionId===team.name&&f.status==='ACTIVE'))return;
 if((p.honorHistory??[]).some(h=>h.kind==='REVOKED'&&h.factionId===team.name&&h.epochFounderId===epoch.foundingRulerId))return;
 const previous=currentNobleGrant(p,team.name,month,epoch.foundingRulerId),rank=NOBLE_RANKS[previous?NOBLE_RANKS.indexOf(previous.rank)+1:0];if(!rank)return;
 const merits=deriveNobleMerits(p,formations,events,team.name,month),rule=NOBLE_RULES[rank];
 if(merits.serviceMonths<rule.serviceMonths||merits.cityIds.length<rule.cities||merits.importantCityIds.length<rule.importantCities)return;
 return {eventId:`military-noble-${p.personId}-${team.name}-${epoch.foundingRulerId}-${rank}`,personId:p.personId,sourceUserId:p.sourceUserId,bornMonth:p.bornMonth,personalName:p.personalName,factionId:team.name,countryName:getHistoricalFactionIdentity(team,month).name,epochFounderId:epoch.foundingRulerId,rulerId:ruler.id,rulerTitle:formatRulerTitleAtMonth(team,`${ruler.houseName.replace(/氏$/, '')}${ruler.givenName}`,month),month,previousRank:previous?.rank??'NONE',rank,commandId:a.commandId,office,serviceMonths:merits.serviceMonths,captureEventIds:merits.captureEventIds,cityIds:merits.cityIds,importantCityIds:merits.importantCityIds,importantEventIds:merits.importantEventIds};
}
export function nobleChronicle(g:NobleGrant){return `${g.rulerTitle}因${g.personalName}累有军功，${g.previousRank==='NONE'?'封其':'进封其'}为${NOBLE_NAMES[g.rank]}。`;}
/** Dynamic archive ranking only: it never confers or removes a title. */
export function meritRoster(people:MilitaryPerson[],formations:MilitaryFormation[],events:WorldEvent[],factionId:string,month:number){
 return people.filter(p=>p.appointments.some(a=>a.factionId===factionId)).map(p=>({person:p,merits:deriveNobleMerits(p,formations,events,factionId,month)})).filter(r=>r.merits.cityIds.length>0||r.merits.defendedCityIds.length>0).sort(compareMeritRows);
}
/** Reign ordinals resolve same-month house changes without guessing bloodlines or surnames. */
export function nobleEpochForRuler(d:Dynasty|undefined,rulerId:string|null){
 const ordinal=d?.rulers.find(r=>r.id===rulerId)?.reignOrdinal;if(ordinal===undefined)return;
 return d?.houseEpochs?.map(e=>({e,ordinal:d.rulers.find(r=>r.id===e.foundingRulerId)?.reignOrdinal??Infinity})).filter(x=>x.ordinal<=ordinal).sort((a,b)=>b.ordinal-a.ordinal||b.e.startMonth-a.e.startMonth)[0]?.e;
}

type MeritRow={person:MilitaryPerson;merits:ReturnType<typeof deriveNobleMerits>};
function compareMeritRows(a:MeritRow,b:MeritRow){return b.merits.importantCityIds.length-a.merits.importantCityIds.length||b.merits.cityIds.length-a.merits.cityIds.length||b.merits.defendedCityIds.length-a.merits.defendedCityIds.length||b.merits.serviceMonths-a.merits.serviceMonths||b.merits.activities-a.merits.activities||a.person.personId.localeCompare(b.person.personId);}
/** Per-view evidence cache: immutable proofs are reused, the actual service clock and ranking are always current. */
export function createMeritRosterProjection(){
 let sourceEvents:WorldEvent[]|undefined,index:MilitaryEvidenceIndex|undefined,scope:string|undefined;
 const records=new Map<string,{person:MilitaryPerson;personKey:string;formsKey:string;events:WorldEvent[];cutoff:number;facts:ReturnType<typeof deriveNobleMerits>}>();
 const stats={indexBuilds:0,evidenceEvaluations:0,evidenceReuses:0};
 return {diagnostics:()=>({...stats,cachedPeople:records.size}),eventsById:()=>index?.byId??new Map<string,WorldEvent>(),get(people:MilitaryPerson[],formations:MilitaryFormation[],events:WorldEvent[],factionId:string,month:number){
  if(scope!==factionId||people.some(p=>records.has(p.personId)&&records.get(p.personId)!.person!==p)){records.clear();scope=factionId;}
  // Event objects are immutable within a world; reset/hydration creates new objects even for identical IDs.
  const same=sourceEvents===events||sourceEvents?.length===events.length&&sourceEvents.every((e,i)=>e===events[i]);
  if(!same||!index){index=createMilitaryEvidenceIndex(events,formations);sourceEvents=events.slice();stats.indexBuilds++;}
  else { // Formation ownership/member facts can change without an appended historical event.
   index.formsByPerson.clear();for(const f of formations){const rows=index.formsByPerson.get(f.commanderPersonId)??[];rows.push(f);index.formsByPerson.set(f.commanderPersonId,rows);}
  }
  const liveIds=new Set(people.map(p=>p.personId));for(const id of records.keys())if(!liveIds.has(id))records.delete(id);
  const rows:MeritRow[]=[];
  for(const person of people.filter(p=>p.appointments.some(a=>a.factionId===factionId))){
   const local={...person,appointments:person.appointments.filter(a=>a.factionId===factionId)},deps=index.dependencies(local),cutoff=deps.reduce((n,e)=>n+Number((e.monthIndex??e.year)<=month),0),personKey=JSON.stringify(person),formsKey=JSON.stringify(index.formsByPerson.get(person.personId)??[]),old=records.get(person.personId);
   let facts:ReturnType<typeof deriveNobleMerits>;
   if(old&&old.personKey===personKey&&old.formsKey===formsKey&&old.cutoff===cutoff&&old.events.length===deps.length&&old.events.every((e,i)=>e===deps[i])){facts=old.facts;stats.evidenceReuses++;}
   else{facts=deriveNobleMerits(person,formations,events,factionId,month,index);records.set(person.personId,{person,personKey,formsKey,events:deps,cutoff,facts});stats.evidenceEvaluations++;}
   const merits={...facts,serviceMonths:militaryServiceMonths(local,month)};if(merits.cityIds.length||merits.defendedCityIds.length)rows.push({person,merits});
  }
  return rows.sort(compareMeritRows);
 }};
}
