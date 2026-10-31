import type {WorldEvent} from '../History/WorldHistory';
import type {MilitaryLocalCrisisFacts} from './MilitaryLocalRules';
/** Local causes only. The global history boundary is a separate checkpoint, never a cause. */
export function militaryCrisisSourceIds(events:readonly WorldEvent[],cityId:string,factionId:string,facts:MilitaryLocalCrisisFacts):string[]{
 return events.filter((e,index)=>{
  const at=e.monthIndex??e.year;if(at>facts.worldMonth||e.cityId!==cityId)return false;
  if(e.type==='siege-started')return !!facts.underSiege&&!!facts.battleId&&e.metadata?.battleId===facts.battleId&&e.targetFactionId===factionId;
  if(!['city-captured','city-recovered','capital-fallen','city-revolt'].includes(e.type)||at!==facts.lastCapturedMonth)return false;
  let owner=e.actorFactionId;
  for(const later of events.slice(index+1)){
   const lm=later.monthIndex??later.year;if(lm<at||lm>facts.worldMonth)continue;
   if(later.cityId===cityId&&['city-captured','city-recovered','capital-fallen','city-revolt'].includes(later.type)&&later.actorFactionId!==owner)return false;
   const m=later.metadata;
   if(later.type==='faction-merged'&&m?.absorbedFactionId===owner&&typeof m.absorbingFactionId==='string')owner=m.absorbingFactionId;
   if(later.type==='faction-submitted'&&m?.submittedFactionId===owner&&typeof m.receivingFactionId==='string')owner=m.receivingFactionId;
  }
  return owner===factionId;
 }).map(e=>e.id);
}
