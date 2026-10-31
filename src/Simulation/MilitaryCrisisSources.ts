import type {WorldEvent} from '../History/WorldHistory';
import type {MilitaryLocalCrisisFacts} from './MilitaryLocalRules';
/** Local causes only. The global history boundary is a separate checkpoint, never a cause. */
export function militaryCrisisSourceIds(events:readonly WorldEvent[],cityId:string,factionId:string,facts:MilitaryLocalCrisisFacts):string[]{
 return events.filter(e=>{
  const at=e.monthIndex??e.year;if(at>facts.worldMonth||e.cityId!==cityId)return false;
  if(e.type==='siege-started')return !!facts.underSiege&&!!facts.battleId&&e.metadata?.battleId===facts.battleId&&e.targetFactionId===factionId;
  return ['city-captured','city-recovered','capital-fallen','city-revolt'].includes(e.type)&&e.actorFactionId===factionId&&at===facts.lastCapturedMonth;
 }).map(e=>e.id);
}
