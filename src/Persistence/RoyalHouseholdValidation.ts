import type {WorldSaveV1} from './WorldSaveSchema';
import {importRulerSave} from './RulerSaveProjection';
import {householdBirthPlan,householdBirthParents,isRoyalBirthPolicy,HOUSEHOLD_ANNUAL_CAP,HOUSEHOLD_LIVING_CAP} from '../Politics/RoyalHouseholdBirth';
import type {Dynasty,Ruler} from '../Politics/Dynasty';
import type {WorldEvent} from '../History/WorldHistory';
/** Birth evidence is reconstructed at its own boundary, never using a later child or death. */
export function validateRoyalHouseholds(save:WorldSaveV1){
 const errors:string[]=[],policy=save.registries.dynastyRoyalBirthPolicy;if(!isRoyalBirthPolicy(policy))return ['invalid royal birth policy'];
 const events=save.worldHistory.events as WorldEvent[],positions=new Map(events.map((e,i)=>[e.id,i])),bornEvents=events.filter(e=>e.type==='royal-child-born'),seen=new Set<string>();
 // Local to one validation call: never reused across a mutable DTO, read or rollback.
 const firstPosition=new Map<string,number>(),royalDeaths=new Map<string,Array<{position:number;month:number}>>(),militaryDeath=new Map<string,number>(),kinDeaths=new Map<string,WorldEvent[]>();
 events.forEach((e,position)=>{
  if(!firstPosition.has(e.id))firstPosition.set(e.id,position);
  if(['ruler-died','heir-died','royal-kin-died'].includes(e.type))for(const id of new Set([e.rulerId,e.metadata?.heirId]))if(typeof id==='string'){
   const rows=royalDeaths.get(id)??[];rows.push({position,month:e.monthIndex??e.year});royalDeaths.set(id,rows);
  }
  if(e.type==='military-person-died'&&typeof e.metadata?.personId==='string'&&!militaryDeath.has(e.metadata.personId))militaryDeath.set(e.metadata.personId,position);
  if(e.type==='royal-kin-died'&&e.rulerId){const rows=kinDeaths.get(e.rulerId)??[];rows.push(e);kinDeaths.set(e.rulerId,rows);}
 });
 for(const raw of save.dynasties){try{
  const d={...raw,rulers:(raw.rulers as import('./WorldSaveSchema').RulerSaveV17[]).map(importRulerSave)} as Dynasty;
  if(d.lastHouseholdBirthMonth!==undefined&&(!Number.isSafeInteger(d.lastHouseholdBirthMonth)||d.lastHouseholdBirthMonth<=0||d.lastHouseholdBirthMonth%12||d.lastHouseholdBirthMonth>save.world.worldMonth))throw Error('invalid royal annual birth boundary');
  for(const r of d.rulers){if((r.successionScope==='HOUSEHOLD'||r.id.startsWith(`${d.factionId}-household-`))&&!r.householdBirth)throw Error('household identity without birth');if(!r.householdBirth)continue;
   if((d.lastHouseholdBirthMonth??-1)<r.householdBirth.month)throw Error('missing royal annual birth boundary');
   const b=r.householdBirth,e=events[positions.get(b.eventId)??-1];
   if(b.version!==1||!Number.isSafeInteger(b.month)||b.month<=0||b.policy!==policy||b.month!==r.bornYear||b.month%12||b.month>save.world.worldMonth||b.parentId!==r.parentId||r.successionScope!=='HOUSEHOLD'||r.registration?.month!==b.month||r.registration.parentId!==r.parentId||e?.type!=='royal-child-born'||e.actorFactionId!==d.factionId||e.rulerId!==r.id||(e.monthIndex??e.year)!==b.month||e.metadata?.royalBirth!==JSON.stringify(b)||!r.registration||positions.get(r.registration.eventId)!<=positions.get(b.eventId)!)throw Error('invalid royal birth identity/source');
   if(d.heirIds.includes(r.id)||d.designatedHeirId===r.id||r.reignOrdinal!==undefined||r.accessionYear!==undefined)throw Error('ordinary household child illegally became crown candidate');
   if(!r.militaryIdentity){const deaths=kinDeaths.get(r.id)??[];if(deaths.length>1||!r.deathMonth&&deaths.length)throw Error('duplicate or erased royal child death');if(r.deathMonth!==undefined&&(r.deathReason!=='自然去世'||r.deathMonth!==r.naturalDeathYear||deaths.length!==1||(deaths[0].monthIndex??deaths[0].year)!==r.deathMonth||deaths[0].id!==`${r.id}-life-ended`||deaths[0].metadata?.deathMonth!==r.deathMonth))throw Error('invalid natural royal child death source');}
   seen.add(e.id);
  }
  const birthMonths=new Map<number,Ruler[]>();for(const r of d.rulers)if(r.householdBirth){const rows=birthMonths.get(r.householdBirth.month)??[];rows.push(r);birthMonths.set(r.householdBirth.month,rows);}
  for(const [month,children] of birthMonths){
   const actual=children.sort((a,b)=>positions.get(a.householdBirth!.eventId)!-positions.get(b.householdBirth!.eventId)!),boundary=positions.get(actual[0].householdBirth!.eventId)!,before=(id:string)=>(firstPosition.get(id)??Infinity)<boundary;
   const historical=d.rulers.filter(r=>r.registration&&before(r.registration.eventId)).map(r=>{
    const copy={...r};const dead=(royalDeaths.get(r.id)??[]).some(e=>e.position<boundary&&e.month<=month)||!!r.militaryIdentity&&(militaryDeath.get(r.militaryIdentity.personId)??Infinity)<boundary;
    if(!dead){delete copy.deathMonth;copy.status='kin';}if((r.militaryIdentity?.enteredMonth??Infinity)>month)delete copy.militaryIdentity;if((r.accessionYear??Infinity)>month){delete copy.reignOrdinal;delete copy.accessionYear;}
    return copy;
   });
   const epoch=d.houseEpochs?.find(e=>e.foundingRulerId===actual[0].householdBirth!.epochFounderId&&e.startMonth<=month&&(e.endMonth??Infinity)>month);if(!epoch)throw Error('birth outside original royal authority');
   const context={...d,currentRulerId:d.rulers.find(r=>r.accessionYear!==undefined&&r.accessionYear<=month&&(r.endYear??Infinity)>month)?.id??null,houseName:epoch.houseName,rulers:historical,royalNobility:d.royalNobility?.filter(a=>before(a.eventId))};let living=historical.filter(r=>(r.deathMonth??Infinity)>month&&(r.naturalDeathYear??Infinity)>month).length;const planned:Ruler[]=[];
   for(const [ordinal,parent] of householdBirthParents(context,month).entries()){if(planned.length>=HOUSEHOLD_ANNUAL_CAP||living>=HOUSEHOLD_LIVING_CAP)break;const child=householdBirthPlan(parent,month,String(save.worldRandom.seed),policy,epoch.foundingRulerId,ordinal);if(child){planned.push(child);living++;}}
   if(planned.length!==actual.length)throw Error('royal birth annual cap/selection mismatch');
   for(let i=0;i<actual.length;i++){const a=actual[i],p=planned[i];if(a.id!==p.id||a.givenName!==p.givenName||a.houseName!==p.houseName||a.bornYear!==p.bornYear||a.naturalDeathYear!==p.naturalDeathYear||JSON.stringify(a.householdBirth)!==JSON.stringify(p.householdBirth))throw Error('royal birth deterministic replay mismatch');}
  }
 }catch(e){errors.push(`invalid royal household ${raw.factionId}: ${String(e)}`);}}
 for(const e of bornEvents)if(!seen.has(e.id))errors.push('orphan royal birth event');
 return errors;
}
