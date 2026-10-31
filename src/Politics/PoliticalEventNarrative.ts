import {formatRevolutionEvidence} from "./DynasticRevolution";
import type {WorldEvent} from '../History/WorldHistory';
import {formatWorldDate} from '../Simulation/WorldTime';
import {MILITARY_OFFICE_NAMES, type MilitaryOffice} from './MilitaryOffice';

export interface PoliticalCrisisSnapshot {
 version:1; kind:'DEPOSITION'|'REVOLUTION'; factionId:string; worldMonth:number; countryName:string;
 cityCount:number; stability:number; capitalCityId?:string; capitalCityName?:string;
 successorBornMonth:number;
 successorOffice?:{personId:string;commandId:string;office:MilitaryOffice;eventId:string};
 facts:Array<{eventId:string;worldMonth:number;type:WorldEvent['type'];cityId?:string;cityName?:string;capital:boolean;groupId:string}>;
}
/** Called at the real political boundary. Reading never consults today's cities or loyalty. */
export function capturePoliticalCrisis(input:Omit<PoliticalCrisisSnapshot,'version'|'facts'>,ids:readonly string[],events:readonly WorldEvent[]):PoliticalCrisisSnapshot {
 const seen=new Set<string>();
 const facts=ids.flatMap(id=>{const e=events.find(e=>e.id===id);if(!e)return [];const groupId=e.historyGroupId??e.id;
  if(seen.has(groupId))return [];seen.add(groupId);
  return [{eventId:e.id,worldMonth:e.monthIndex??e.year,type:e.type,cityId:e.cityId,cityName:e.cityName,capital:e.type==='capital-fallen'||e.metadata?.wasCapital===1,groupId}];
 });
 return {version:1,...input,facts};
}
export function readPoliticalCrisis(event:WorldEvent):PoliticalCrisisSnapshot|undefined {
 if(typeof event.metadata?.politicalCrisis!=='string')return;
 try{const s=JSON.parse(String(event.metadata?.politicalCrisis));return s?.version===1&&s.factionId===event.actorFactionId&&s.worldMonth===(event.monthIndex??event.year)&&Array.isArray(s.facts)?s:undefined;}catch{return;}
}
export function politicalCauseText(event:WorldEvent):string|undefined {
 const s=readPoliticalCrisis(event);if(!s)return;
 const facts=[...s.facts].sort((a,b)=>a.worldMonth-b.worldMonth||a.eventId.localeCompare(b.eventId)).map(f=>`${formatWorldDate(f.worldMonth)}${f.cityName??'本国'}${f.capital?'失都':f.type==='city-revolt'?'发生城市叛乱':f.type==='empire-split'?'发生重大分裂':f.type==='city-captured'?'失守':'发生政治冲击'}`);
 const scale=s.cityCount===1?'当时仅余一城':`当时国有${s.cityCount}城`;
 const mood=s.stability>=70?'民心尚稳':s.stability<=40?'国中不稳':'国势未稳';
 return `${facts.length?`${facts.join('；')}。`:''}${scale}，${mood}。`;
}
const kin:Record<string,string>={DIRECT_CHILD:'其子',GRANDCHILD:'其孙',SIBLING:'其兄弟',NEPHEW:'其侄',UNCLE:'其叔伯',COUSIN:'其堂亲'};
/** Shared default prose for the scroll and both monarchs. Numeric weights stay in evidence. */
export function formatPoliticalEvent(event:WorldEvent):string|undefined {
 const s=readPoliticalCrisis(event),m=event.metadata;if(!s||!m)return;
 const cause=politicalCauseText(event)??'';
 if(event.type==='ruler-deposed'){
  let support='';
  try{const selected=JSON.parse(String(m.depositionSelection??'null')),p=JSON.parse(String(m.militaryParticipation??'null'))?.participant;
   if(selected?.support&&p&&selected.support.personId===p.personId){const v=selected.support;support=`${p.officeStanding?MILITARY_OFFICE_NAMES[p.officeStanding.office as MilitaryOffice]:'将领'}${v.name}统兵支持${v.rulerName}，${v.rulerId===m.nextRulerId?'所支持者获位':'终由另一宗室获位'}。`;}
   else if(p)support=`将领${p.personalName??p.name}统兵参与废立。`;
  }catch{/* No support is inferred from rank or victory. */}
  const age=Math.floor((s.worldMonth-s.successorBornMonth)/12),office=s.successorOffice?`，此前任${MILITARY_OFFICE_NAMES[s.successorOffice.office]}`:'';
  return `${s.countryName}国宗室废立。${cause}${m.previousRulerName}被废，${kin[String(m.relation)]??'宗室'}${m.nextRulerName}继位，时年${age}岁${office}。${support}王统、国号与旗色未改${s.capitalCityName?`，国都仍在${s.capitalCityName}`:''}。`;
 }
 if(event.type==='dynasty-usurped'){
  const death=m.successionReason==='combat'?'战死':m.successionReason==='captured'?'被俘处死':'去世';
  const age=typeof m.displacedSuccessorAge==='number'?`（时年${m.displacedSuccessorAge}岁）`:'';
  let previousOffice='';try{const i=JSON.parse(String(m.militaryUsurperIdentity??'null'));if(i?.personId===m.militaryUsurperPersonId&&MILITARY_OFFICE_NAMES[i.office as MilitaryOffice])previousOffice=`原${m.oldStateName}${MILITARY_OFFICE_NAMES[i.office as MilitaryOffice]}`;}catch{/* No fictional military past. */}
  const name=m.newRulerName??m.newHouseName;
  const otherCauses=formatRevolutionEvidence(String(m.vulnerabilityEvidence??'').split(',').filter(k=>!['ONE_CITY_REMAINING','FEW_CITIES_REMAINING','LOW_FACTION_STABILITY','POLITICAL_VULNERABILITY','PREDECESSOR_COMBAT_DEATH','PREDECESSOR_CAPTURED',...s.facts.map(f=>f.capital?'RECENT_CAPITAL_LOSS':f.type==='empire-split'?'RECENT_EMPIRE_SPLIT':'')].includes(k)));
  let military='';try{const p=JSON.parse(String(m.militaryParticipation??'null'))?.participant;if(p)military=`${p.officeStanding?MILITARY_OFFICE_NAMES[p.officeStanding.office as MilitaryOffice]:'将领'}${p.personalName??p.name}统兵参与继统之争，获位者为${name}。`;}catch{/* No invented command. */}
  const colors=typeof m.oldColor==='number'&&typeof m.newColor==='number'?(m.oldColor!==m.newColor?'并易帜。':'旗色未改。'):'';
  return `${s.countryName}国易代。${cause}${otherCauses?`${otherCauses}。`:''}${m.predecessorRulerName}${death}，原定由${m.displacedSuccessorName}${age}承统，继统之际${previousOffice}${name}夺取王统，${m.oldHouseName}改为${m.newHouseName}${m.oldStateName!==m.newStateName?`，国号由${m.oldStateName}改为${m.newStateName}`:''}。${military}${colors}${s.capitalCityName?`国都仍在${s.capitalCityName}。`:''}`;
 }
 return undefined;
}

export function politicalCapital(metadata:Record<string,string|number|undefined>){return {capitalCityId:typeof metadata.capitalCityId==='string'?metadata.capitalCityId:undefined,capitalCityName:typeof metadata.capitalCityName==='string'?metadata.capitalCityName:undefined};}
