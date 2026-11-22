import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {Dynasty} from './Dynasty';
import type {WorldEvent} from '../History/WorldHistory';
import {militaryPoliticalOutcome} from './MilitaryPoliticalOutcome';
/** The viewed country's actual event-time political status; a transfer alone is not rebellion. */
export function militaryPortraitStatus(p:MilitaryPerson,factionId:string,month:number,dynasties:readonly Dynasty[],events:readonly WorldEvent[]):'叛离'|'禁仕'|'已赦'|'伏诛'|'追夺'|undefined{
 const labels=militaryPoliticalOutcome(p,factionId,month,dynasties,events);
 if(labels.some(s=>s.includes('因谋逆伏诛')))return '伏诛';
 if(labels.some(s=>s.startsWith('后叛离')))return '叛离';
 if(labels.some(s=>s.includes('禁仕')))return '禁仕';
 if(labels.some(s=>s.includes('已获赦免')))return '已赦';
 if(p.honorHistory?.some(h=>h.kind==='REVOKED'&&h.factionId===factionId&&h.month<=month&&events.some(e=>e.id===h.eventId&&e.type==='military-title-revoked'&&e.actorFactionId===factionId&&e.metadata?.personId===p.personId&&e.metadata?.honor===JSON.stringify(h)&&(e.monthIndex??e.year)===h.month)))return '追夺';
 return undefined;
}
