import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {Dynasty} from './Dynasty';
import type {WorldEvent} from '../History/WorldHistory';
/** Country and date scoped archive labels; a later departure never changes an earlier portrait. */
export function militaryPoliticalOutcome(person:MilitaryPerson,factionId:string,month:number,dynasties:readonly Dynasty[],events:readonly WorldEvent[]):string[] {
  const found=dynasties.flatMap(d=>d.rulers).find(r=>r.residentIdentity?.military?.personId===person.personId&&r.residentIdentity.sourceFactionId===factionId&&r.residentIdentity.foundedMonth<=month&&events.some(e=>e.type==='empire-split'&&e.targetFactionId===factionId&&e.metadata?.militaryPersonId===person.personId&&e.metadata?.foundingRulerId===r.id&&(e.monthIndex??e.year)<=month));
  if(!found)return [];
  const labels=[`后叛离${found.residentIdentity!.sourceFactionName}`];
  if(person.honorHistory?.some(h=>h.kind==='REVOKED'&&h.factionId===factionId&&h.month<=month&&events.some(e=>e.id===h.eventId&&e.type==='military-title-revoked'&&e.actorFactionId===factionId&&e.metadata?.personId===person.personId&&e.metadata?.honor===JSON.stringify(h)&&(e.monthIndex??e.year)===h.month)))labels.push('旧爵已追夺');
  else if(person.nobilityHistory?.some(g=>g.factionId===factionId&&g.month<=month))labels.push('原册封为历史记录');
  return labels;
}
