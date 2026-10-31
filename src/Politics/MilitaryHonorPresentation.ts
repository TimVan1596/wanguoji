import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
import {NOBLE_NAMES} from './MilitaryNobility';
/** Titles remain separate acts: a posthumous epithet never invents a combined peerage. */
export function militaryHonorPresentation(p:MilitaryPerson,factionId:string,month:number,byId:ReadonlyMap<string,WorldEvent>){
 const valid=(a:{eventId:string;month:number},type:string,key:string)=>{const e=byId.get(a.eventId);return a.month<=month&&e?.type===type&&e.actorFactionId===factionId&&e.metadata?.personId===p.personId&&e.metadata[key]===JSON.stringify(a)&&(e.monthIndex??e.year)===a.month;};
 const grants=(p.nobilityHistory??[]).filter(g=>g.personId===p.personId&&g.factionId===factionId&&valid(g,'military-ennobled','nobility')).sort((a,b)=>a.month-b.month);
 const grant=grants.at(-1);if(!grant)return {text:'',grant:undefined,revoked:false,epithet:undefined};
 const revoked=(p.honorHistory??[]).some(h=>h.kind==='REVOKED'&&h.epochFounderId===grant.epochFounderId&&h.factionId===factionId&&h.personId===p.personId&&valid(h,'military-title-revoked','honor'));
 const posthumous=(p.honorHistory??[]).find(h=>h.kind==='POSTHUMOUS'&&h.personId===p.personId&&h.factionId===factionId&&h.deathMonth===p.deathMonth&&p.deathMonth!==undefined&&p.deathMonth<=month&&h.month>=p.deathMonth&&h.epithet&&valid(h,'military-posthumous','honor')&&grants.some(g=>g.eventId===h.grantEventId)&&byId.get(h.sourceEventId)?.metadata?.personId===p.personId&&byId.get(h.sourceEventId)?.type==='military-person-died');
 const title=`${grant.countryName}国${NOBLE_NAMES[grant.rank]}`;
 return {grant,revoked,epithet:posthumous?.epithet,text:[revoked?`旧爵${title} · 已追夺`:p.politicalRulerId?`曾受${title}`:p.deathMonth!==undefined&&p.deathMonth<=month?`去世时${title}`:title,posthumous?`谥${posthumous.epithet}`:''].filter(Boolean).join(' · ')};
}
