import type {WorldSaveV1} from './WorldSaveSchema';
import {importRulerSave} from './RulerSaveProjection';
import {householdBirthPlan,householdBirthParents,isRoyalBirthPolicy,HOUSEHOLD_ANNUAL_CAP,HOUSEHOLD_LIVING_CAP} from '../Politics/RoyalHouseholdBirth';
import type {Dynasty,Ruler} from '../Politics/Dynasty';
import type {WorldEvent} from '../History/WorldHistory';
/** Birth evidence is reconstructed at its own boundary, never using a later child or death. */
export function validateRoyalHouseholds(save:WorldSaveV1){
 const errors:string[]=[],policy=save.registries.dynastyRoyalBirthPolicy;if(!isRoyalBirthPolicy(policy))return ['invalid royal birth policy'];
 const events=save.worldHistory.events as WorldEvent[],positions=new Map(events.map((e,i)=>[e.id,i])),bornEvents=events.filter(e=>e.type==='royal-child-born'),seen=new Set<string>();
 for(const raw of save.dynasties){try{
  const d={...raw,rulers:(raw.rulers as import('./WorldSaveSchema').RulerSaveV17[]).map(importRulerSave)} as Dynasty;
  if(d.lastHouseholdBirthMonth!==undefined&&(!Number.isSafeInteger(d.lastHouseholdBirthMonth)||d.lastHouseholdBirthMonth%12||d.lastHouseholdBirthMonth>save.world.worldMonth))throw Error('invalid royal annual birth boundary');
  for(const r of d.rulers){if(r.successionScope==='HOUSEHOLD'&&!r.householdBirth)throw Error('household identity without birth');if(!r.householdBirth)continue;
   const b=r.householdBirth,e=events[positions.get(b.eventId)??-1];
   if(b.version!==1||b.policy!==policy||b.month!==r.bornYear||b.month%12||b.month>save.world.worldMonth||b.parentId!==r.parentId||r.successionScope!=='HOUSEHOLD'||r.registration?.month!==b.month||r.registration.parentId!==r.parentId||e?.type!=='royal-child-born'||e.actorFactionId!==d.factionId||e.rulerId!==r.id||(e.monthIndex??e.year)!==b.month||e.metadata?.royalBirth!==JSON.stringify(b)||!r.registration||positions.get(r.registration.eventId)!<=positions.get(b.eventId)!)throw Error('invalid royal birth identity/source');
   if(d.heirIds.includes(r.id)||d.designatedHeirId===r.id||r.reignOrdinal!==undefined||r.accessionYear!==undefined)throw Error('ordinary household child illegally became crown candidate');
   seen.add(e.id);
  }
  for(const month of new Set(d.rulers.flatMap(r=>r.householdBirth?[r.householdBirth.month]:[]))){
   const actual=d.rulers.filter(r=>r.householdBirth?.month===month).sort((a,b)=>positions.get(a.householdBirth!.eventId)!-positions.get(b.householdBirth!.eventId)!),boundary=positions.get(actual[0].householdBirth!.eventId)!,prefix=events.slice(0,boundary),ids=new Set(prefix.map(e=>e.id));
   const historical=d.rulers.filter(r=>r.registration&&ids.has(r.registration.eventId)).map(r=>{
    const copy={...r};const dead=prefix.some(e=>(e.monthIndex??e.year)<=month&&(['ruler-died','heir-died','royal-kin-died'].includes(e.type)&&(e.rulerId===r.id||e.metadata?.heirId===r.id)||e.type==='military-person-died'&&r.militaryIdentity&&e.metadata?.personId===r.militaryIdentity.personId));
    if(!dead){delete copy.deathMonth;copy.status='kin';}if((r.militaryIdentity?.enteredMonth??Infinity)>month)delete copy.militaryIdentity;if((r.accessionYear??Infinity)>month){delete copy.reignOrdinal;delete copy.accessionYear;}
    return copy;
   });
   const epoch=d.houseEpochs?.find(e=>e.foundingRulerId===actual[0].householdBirth!.epochFounderId&&e.startMonth<=month&&(e.endMonth??Infinity)>month);if(!epoch)throw Error('birth outside original royal authority');
   const context={...d,currentRulerId:d.rulers.find(r=>r.accessionYear!==undefined&&r.accessionYear<=month&&(r.endYear??Infinity)>month)?.id??null,houseName:epoch.houseName,rulers:historical,royalNobility:d.royalNobility?.filter(a=>ids.has(a.eventId))};let living=historical.filter(r=>(r.deathMonth??Infinity)>month&&(r.naturalDeathYear??Infinity)>month).length;const planned:Ruler[]=[];
   for(const [ordinal,parent] of householdBirthParents(context,month).entries()){if(planned.length>=HOUSEHOLD_ANNUAL_CAP||living>=HOUSEHOLD_LIVING_CAP)break;const child=householdBirthPlan(parent,month,String(save.worldRandom.seed),policy,epoch.foundingRulerId,ordinal);if(child){planned.push(child);living++;}}
   if(planned.length!==actual.length)throw Error('royal birth annual cap/selection mismatch');
   for(let i=0;i<actual.length;i++){const a=actual[i],p=planned[i];if(a.id!==p.id||a.givenName!==p.givenName||a.houseName!==p.houseName||a.bornYear!==p.bornYear||a.naturalDeathYear!==p.naturalDeathYear||JSON.stringify(a.householdBirth)!==JSON.stringify(p.householdBirth))throw Error('royal birth deterministic replay mismatch');}
  }
 }catch(e){errors.push(`invalid royal household ${raw.factionId}: ${String(e)}`);}}
 for(const e of bornEvents)if(!seen.has(e.id))errors.push('orphan royal birth event');
 return errors;
}
