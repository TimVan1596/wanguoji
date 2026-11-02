import type {WorldEvent} from './WorldHistory';
import type {HistoryFactionLike} from './HistoryRenderRules';
import {getHistoricalFactionIdentity} from './HistoricalFactionIdentity';
import {FAMILY_NOBLE_NAMES,type FamilyNobleAct} from '../Politics/FamilyNobleSuccession';
/** Adds event-time attribution without editing canonical text, IDs or sealed succession records. */
export function familyNobleReading(event:WorldEvent,factions:ReadonlyMap<string,HistoryFactionLike>){
 if(!['family-title-succeeded','family-title-ended'].includes(event.type))return;
 let act:FamilyNobleAct;try{act=JSON.parse(String(event.metadata?.familyNobleAct));}catch{return;}
 const month=event.monthIndex??event.year,f=factions.get(act.factionId);
 if(!f||act.eventId!==event.id||act.month!==month||act.factionId!==event.actorFactionId||!FAMILY_NOBLE_NAMES[act.previousRank])return;
 const identity=getHistoricalFactionIdentity(f,month),country=identity.name+(identity.sovereigntyRank==='KING'?'国':identity.sovereigntyRank==='EMPEROR'?'朝':'');
 return `${country}${['DEATH','NO_HEIR'].includes(act.reason)?FAMILY_NOBLE_NAMES[act.previousRank]:''}${event.title}`;
}
