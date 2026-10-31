import type {WorldSaveV1} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
export function validateMilitaryNarrativeLinks(save:WorldSaveV1):string[]{
 const errors:string[]=[],events=save.worldHistory.events as WorldEvent[],byId=new Map(events.map((e,i)=>[e.id,{e,i}]));
 for(const [index,e] of events.entries()){
  const m=e.metadata??{},at=e.monthIndex??e.year;
  if(m.siegeEndedEventId!==undefined){
   const end=byId.get(String(m.siegeEndedEventId)),s=end?.e;
   if(!['city-captured','city-recovered','capital-fallen'].includes(e.type)||!s||end!.i>=index||s.type!=='siege-ended'||s.metadata?.reason!=='CAPTURED'||typeof m.battleId!=='string'||s.metadata.battleId!==m.battleId||s.metadata.commandId!==m.commandId||s.metadata.personId!==m.commanderPersonId||s.cityId!==e.cityId||s.actorFactionId!==e.actorFactionId||s.targetFactionId!==(e.previousOwnerFactionId??e.targetFactionId)||(s.monthIndex??s.year)!==at)errors.push('invalid capture/siege narrative source');
  }
  if(m.commandEndEventId!==undefined){
   const end=byId.get(String(m.commandEndEventId)),s=end?.e;
   if(e.type!=='siege-ended'||!s||end!.i>=index||!['COMMAND_ENDED','REPULSED'].includes(String(m.reason))||m.reason==='REPULSED'&&m.attackers!==0||s.type!=='military-command-ended'||s.metadata?.endReason!=='DEATH'||s.metadata.personId!==m.personId||s.metadata.commandId!==m.commandId||s.actorFactionId!==e.actorFactionId||(s.monthIndex??s.year)>at)errors.push('invalid death/withdrawal narrative source');
  }
  if(m.formerRuler!==undefined){
   const r=save.dynasties.flatMap(d=>d.rulers as any[]).find(r=>r.rulerId===e.rulerId||r.rulerId===m.rulerId);
   if(e.type!=='ruler-died'||m.formerRuler!==1||!r||r.endMonth===undefined||r.endMonth>at||r.endMonth!==m.officeEndMonth||r.deathMonth!==at||typeof m.rulerNameAtDeath!=='string'||!m.rulerNameAtDeath.startsWith('故')||!m.rulerNameAtDeath.endsWith(r.houseName.replace(/氏$/,'')+r.givenName)||e.title!==`${m.rulerNameAtDeath}去世`)errors.push('invalid former ruler death identity');
  }
 }
 return errors;
}
