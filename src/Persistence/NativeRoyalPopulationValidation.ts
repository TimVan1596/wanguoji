import type {WorldSaveV1} from './WorldSaveSchema';
import {importRulerSave} from './RulerSaveProjection';
import {getRulerUserId,nativeRoyal} from '../Politics/RoyalPopulationIdentity';
/** The crown can end without turning its permanent person into an anonymous resident. */
export function validateNativeRoyalPopulation(save:WorldSaveV1){
 const errors:string[]=[],rulers=save.dynasties.flatMap(d=>(d.rulers??[]).map(r=>({d,r:importRulerSave(r as any)}))),seen=new Set<string>();
 for(const u of save.users){
  const source=rulers.find(x=>nativeRoyal(x.r)&&getRulerUserId(x.r.id)===u.userId&&x.r.bornYear===u.bornMonth),owner=u.nativeRoyalRulerId?rulers.find(x=>x.r.id===u.nativeRoyalRulerId):source;
  if(!u.nativeRoyalRulerId&&!source)continue;
  if(!owner||!nativeRoyal(owner.r)||u.nativeRoyalRulerId!==owner.r.id||u.userId!==getRulerUserId(owner.r.id)||u.bornMonth!==owner.r.bornYear||owner.r.deathMonth!==undefined||seen.has(owner.r.id)||u.militaryPersonId||u.historicalPersonId||u.role==='RULER'&&(u.rulerId!==owner.r.id||owner.d.currentRulerId!==owner.r.id)||u.role==='NORMAL'&&(u.rulerId||owner.r.endYear===undefined||owner.r.endYear>save.world.worldMonth))errors.push('invalid native royal permanent population identity');
  else seen.add(owner.r.id);
 }
 return errors;
}
