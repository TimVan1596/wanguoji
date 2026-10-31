import type {WorldEvent} from './WorldHistory';
import {readMilitaryParticipation} from '../Politics/MilitaryPoliticalInfluence';
/** Independent canonical political acts, never monthly checks or shared-opportunity success counters. */
export function politicalEventCounts(events:readonly WorldEvent[]){
 const unique=[...new Map(events.map(e=>[e.id,e])).values()];
 const foundings=unique.filter(e=>['rebel-faction-founded','frontier-faction-founded','empire-split'].includes(e.type));
 const countFoundings=(military:boolean)=>new Set(foundings.filter(e=>typeof e.metadata?.leaderPersonId==='string'&&(e.metadata.splitSource==='MILITARY')===military).map(e=>`${e.actorFactionId}/${e.metadata?.foundingRulerId??e.id}`)).size;
 const coups=unique.filter(e=>e.type==='dynasty-usurped'),militaryCoups=coups.filter(e=>{
  try{const m=e.metadata,i=JSON.parse(String(m?.militaryUsurperIdentity));return typeof m?.militaryUsurperPersonId==='string'&&i.personId===m.militaryUsurperPersonId&&i.accessionMonth===(e.monthIndex??e.year)&&i.factionId===e.actorFactionId;}catch{return false;}
 });
 const depositions=unique.filter(e=>e.type==='ruler-deposed');
 return {ordinaryFoundings:countFoundings(false),militarySecessions:countFoundings(true),depositions:depositions.length,militarySupportedDepositions:depositions.filter(e=>readMilitaryParticipation(e)).length,nonMilitaryUsurpations:coups.length-militaryCoups.length,personalMilitaryUsurpations:militaryCoups.length};
}
