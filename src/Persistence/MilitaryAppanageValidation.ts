import type {WorldSaveV1} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import {appanageChanges,appanageText,OWNERSHIP_EVENTS} from '../Politics/MilitaryAppanage';
import {currentNobleGrant,nobleEpochForRuler} from '../Politics/MilitaryNobility';
import {importRulerSave} from './RulerSaveProjection';
import {formatRulerTitleAtMonth} from '../Politics/RulerTitleRules';
import {getHistoricalFactionIdentity} from '../History/HistoricalFactionIdentity';
import {getSovereigntyRankAtMonth} from '../Simulation/FactionIdentity';
export function validateMilitaryAppanages(save:WorldSaveV1){
 const errors:string[]=[],events=save.worldHistory.events as WorldEvent[],byId=new Map(events.map((e,i)=>[e.id,{e,i}])),used=new Set<string>(),records:Array<{a:any;i:number}>=[];
 for(const p of save.registries.militaryCommandRegistry.people){
  if(p.appanageHistory===undefined)continue;if(!Array.isArray(p.appanageHistory)){errors.push('invalid appanage history');continue;}
  let last:typeof p.appanageHistory[number]|undefined;
  for(const a of p.appanageHistory){try{
   const ref=byId.get(a?.eventId);if(!a||!ref||used.has(a.eventId)||!Number.isSafeInteger(a.month)||a.month>save.world.worldMonth||a.month<0||a.personId!==p.personId||a.personalName!==p.personalName||a.month<(last?.month??-1))throw Error();
   const {e,i}=ref,before=events.slice(0,i);
   if(e.type!=='military-appanage'||e.metadata?.appanage!==JSON.stringify(a)||e.metadata?.personId!==p.personId||e.actorFactionId!==a.factionId||e.cityId!==a.cityId||e.cityName!==a.cityName||(e.monthIndex??e.year)!==a.month||e.title!==appanageText(a))throw Error();
   if(a.kind==='GRANTED'){
    if(a.eventId!==a.grantEventId||a.month%12!==0||p.appanageHistory.some(x=>x!==a&&x.kind==='GRANTED'&&x.factionId===a.factionId&&x.epochFounderId===a.epochFounderId))throw Error();
    const d=save.dynasties.find(d=>d.factionId===a.factionId),r=(d?.rulers as any[]|undefined)?.map(importRulerSave).find(r=>r.id===a.rulerId),f=save.factions.find(f=>f.factionId===a.factionId);
    if(!d||!r||!f||r.accessionYear===undefined||r.accessionYear>a.month||(r.endYear??Infinity)<a.month||(r.deathMonth??Infinity)<a.month||(r.naturalDeathYear??Infinity)<=a.month||f.stateFoundedMonth===undefined||f.stateFoundedMonth>a.month)throw Error();
    const dy={...d,rulers:(d.rulers as any[]).map(importRulerSave)} as any,epoch=nobleEpochForRuler(dy,r.id),team={...f,name:f.factionId,sovereigntyRank:getSovereigntyRankAtMonth(f as any,a.month)};
    if(!['KING','EMPEROR'].includes(team.sovereigntyRank)||epoch?.foundingRulerId!==a.epochFounderId||getHistoricalFactionIdentity(team as any,a.month).name!==a.countryName||formatRulerTitleAtMonth(team as any,`${r.houseName.replace(/氏$/,'')}${r.givenName}`,a.month)!==a.rulerTitle||e.rulerId!==r.id)throw Error();
    if(before.some(x=>(x.monthIndex??x.year)===a.month&&((['ruler-died','ruler-captured','dynasty-exiled'].includes(x.type)&&(x.rulerId===r.id||x.metadata?.rulerId===r.id))||(['ruler-deposed','ruler-succession','dynasty-usurped'].includes(x.type)&&x.metadata?.previousRulerId===r.id))))throw Error();
    const priorLife=before.filter(x=>['faction-exiled','faction-extinct','faction-restored','faction-submitted','faction-merged'].includes(x.type)&&(x.type==='faction-restored'?x.actorFactionId===a.factionId||x.targetFactionId===a.factionId:x.targetFactionId===a.factionId)).at(-1);if(priorLife&&priorLife.type!=='faction-restored')throw Error();
    const ids=new Set(before.map(x=>x.id)),past={...p,honorHistory:p.honorHistory?.filter(h=>ids.has(h.eventId))},g=currentNobleGrant(past,a.factionId,a.month,a.epochFounderId),merit=byId.get(a.meritEventId),owner=before.filter(x=>x.cityId===a.cityId&&(OWNERSHIP_EVENTS.includes(x.type)||x.type==='city-destroyed')).at(-1);
    if(!g||g.eventId!==a.nobleGrantEventId||g.rank!==a.rank||!ids.has(g.eventId)||!g.cityIds.includes(a.cityId)||!g.captureEventIds.includes(a.meritEventId)||!merit||merit.i>=i||merit.e.cityId!==a.cityId||!owner||owner.id!==a.sourceEventId||owner.actorFactionId!==a.factionId||owner.type==='city-destroyed'||owner.cityName!==a.cityName||before.some(x=>x.type==='military-person-died'&&x.metadata?.personId===p.personId))throw Error();
    // Source grant binds the permanent person; a prior accession/transfer cannot receive a new ordinary food estate.
    if(before.some(x=>x.type==='military-command-ended'&&x.metadata?.personId===p.personId&&x.metadata.endReason==='TRANSFERRED'&&(x.monthIndex??x.year)>=g.month)||before.some(x=>x.type==='ruler-acceded'&&(x.rulerId===p.politicalRulerId||x.rulerId===p.royalIdentity?.rulerId)))throw Error();
   }else{
    if(!last||last.kind==='ENDED')throw Error();
    const expected=appanageChanges(p,last,before,a.month)[0];if(!expected||JSON.stringify(expected)!==JSON.stringify(a)||e.rulerId!==undefined)throw Error();
   }
   used.add(a.eventId);records.push({a,i});last=a;
  }catch{errors.push('invalid military appanage: '+(a?.eventId??p.personId));}}
 }
 const reserved=new Map<string,string>();for(const {a} of records.sort((a,b)=>a.i-b.i)){const key=JSON.stringify([a.factionId,a.epochFounderId,a.cityId]);if(a.kind==='GRANTED'){if(reserved.has(key))errors.push('conflicting exclusive appanage');reserved.set(key,a.personId);}else if(a.kind==='ENDED')reserved.delete(key);}
 for(const e of events)if(e.type==='military-appanage'&&!used.has(e.id))errors.push('unreferenced military appanage: '+e.id);
 return errors;
}
