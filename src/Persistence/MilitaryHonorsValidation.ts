import type {WorldSaveV1} from './WorldSaveSchema';
import type {Dynasty} from '../Politics/Dynasty';
import type {WorldEvent} from '../History/WorldHistory';
import {importRulerSave} from './RulerSaveProjection';
import {nextMilitaryHonors,militaryHonorText} from '../Politics/MilitaryHonors';
import {getSovereigntyRankAtMonth} from '../Simulation/FactionIdentity';
/** Reconstruct the formal act from only the facts that preceded it, including the then-living issuer. */
export function validateMilitaryHonors(save:WorldSaveV1){
 const errors:string[]=[],events=save.worldHistory.events as WorldEvent[],byId=new Map(events.map((e,i)=>[e.id,{e,i}])),used=new Set<string>(),state=save.registries.militaryCommandRegistry;
 const dynasties=save.dynasties.map(d=>({...d,rulers:(d.rulers as any[]).map(importRulerSave)})) as unknown as Dynasty[];
 for(const p of state.people){
  if(p.honorHistory===undefined)continue;if(!Array.isArray(p.honorHistory)){errors.push('invalid military honor history');continue;}
  let last=-1;
  for(const h of p.honorHistory){try{
   if(!h||!['POSTHUMOUS','REVOKED'].includes(h.kind)||!Number.isSafeInteger(h.month)||h.month<last||h.month%12!==0||h.month>save.world.worldMonth||h.personId!==p.personId||h.personalName!==p.personalName||used.has(h.eventId))throw Error();
   const ref=byId.get(h.eventId),d=dynasties.find(d=>d.factionId===h.factionId),f=save.factions.find(f=>f.factionId===h.factionId),r=d?.rulers.find(r=>r.id===h.rulerId);if(!ref||!d||!f||!r)throw Error();
   const {e,i}=ref,before=events.slice(0,i),ids=new Set(before.map(e=>e.id));
   if(r.accessionYear===undefined||r.accessionYear>h.month||(r.endYear??Infinity)<h.month||(r.deathMonth??Infinity)<h.month||(r.naturalDeathYear??Infinity)<=h.month||before.some(e=>(e.monthIndex??e.year)===h.month&&(e.type==='ruler-died'&&e.metadata?.rulerId===r.id||e.type==='ruler-deposed'&&e.metadata?.previousRulerId===r.id)))throw Error();
   const life=before.filter(e=>['faction-exiled','faction-extinct','faction-restored','faction-submitted','faction-merged'].includes(e.type)&&(e.type==='faction-restored'?e.actorFactionId===h.factionId||e.targetFactionId===h.factionId:e.targetFactionId===h.factionId)).at(-1);if(life&&life.type!=='faction-restored')throw Error();
   const team={...f,name:f.factionId,status:'ACTIVE',identityStage:'STATE',sovereigntyRank:getSovereigntyRankAtMonth(f as any,h.month)};
   const dy={...d,currentRulerId:r.id,rulers:d.rulers.map(x=>x.id===r.id?{...x,status:'ruling' as const,endYear:undefined,deathMonth:undefined}:x)};
   const past={...p,honorHistory:p.honorHistory.filter(x=>ids.has(x.eventId)),nobilityHistory:p.nobilityHistory?.filter(g=>ids.has(g.eventId))};
   const candidates=nextMilitaryHonors(past,state.formations,before,h.month,[team],dynasties.map(x=>x.factionId===d.factionId?dy:x) as any);
   if(!candidates.some(c=>JSON.stringify(c)===JSON.stringify(h))||e.type!==(h.kind==='REVOKED'?'military-title-revoked':'military-posthumous')||e.actorFactionId!==h.factionId||e.rulerId!==h.rulerId||(e.monthIndex??e.year)!==h.month||e.metadata?.honor!==JSON.stringify(h)||e.title!==militaryHonorText(h))throw Error();
   used.add(h.eventId);last=h.month;
  }catch{errors.push('invalid military honor: '+(h?.eventId??p.personId));}}
 }
 for(const e of events)if(['military-posthumous','military-title-revoked'].includes(e.type)&&!used.has(e.id))errors.push('unreferenced military honor: '+e.id);
 return errors;
}
