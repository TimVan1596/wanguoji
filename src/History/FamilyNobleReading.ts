import {getRulerTitleAtMonth} from '../Politics/RulerTitleRules';
import type {WorldEvent} from './WorldHistory';
import type {HistoryFactionLike} from './HistoryRenderRules';
import {getHistoricalFactionIdentity} from './HistoricalFactionIdentity';
import {FAMILY_NOBLE_NAMES,type FamilyNobleAct} from '../Politics/FamilyNobleSuccession';
/** Adds event-time attribution without editing canonical text, IDs or sealed succession records. */
export function familyNobleReading(event:WorldEvent,factions:ReadonlyMap<string,HistoryFactionLike>){
 if(!['family-title-succeeded','family-title-ended'].includes(event.type))return;
 let act:FamilyNobleAct;try{act=JSON.parse(String(event.metadata?.familyNobleAct));}catch{return;}
 if(!act||typeof act!=='object'||Array.isArray(act))return;
 const month=event.monthIndex??event.year,f=factions.get(act.factionId);
 if(!f||act.eventId!==event.id||act.month!==month||act.factionId!==event.actorFactionId||!FAMILY_NOBLE_NAMES[act.previousRank])return;
 const nameMonth=act.reason==='REGIME_ENDED'&&f.nameHistory?.some(h=>h.startMonth===month&&f.nameHistory!.some(p=>p!==h&&p.endMonth===month))?month-1:month;
 const identity=getHistoricalFactionIdentity(f,nameMonth),rank=getRulerTitleAtMonth({...f,sovereigntyRank:f.sovereigntyRank==='KING'||f.sovereigntyRank==='EMPEROR'||f.sovereigntyRank==='LEADER'?f.sovereigntyRank:undefined},nameMonth),country=identity.name+(rank==='王'?'国':rank==='帝'?'朝':'');
 return `${country}${['DEATH','NO_HEIR'].includes(act.reason)?FAMILY_NOBLE_NAMES[act.previousRank]:''}${event.title}`;
}
