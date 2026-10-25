import type {WorldSaveV1} from './WorldSaveSchema';
import type {WorldEvent} from '../History/WorldHistory';
import {importRulerSave} from './RulerSaveProjection';
import {deriveNobleMerits,nobleEpochForRuler,NOBLE_RANKS,NOBLE_RULES,nobleChronicle,type NobleGrant} from '../Politics/MilitaryNobility';
import {formatRulerTitleAtMonth} from '../Politics/RulerTitleRules';
import {getHistoricalFactionIdentity} from '../History/HistoricalFactionIdentity';
import {getSovereigntyRankAtMonth} from '../Simulation/FactionIdentity';
/** Historical proofs are evaluated before each grant, never using today's living ruler or roster. */
export function validateMilitaryNobility(save:WorldSaveV1){
 const errors:string[]=[],state=save.registries.militaryCommandRegistry,events=(save.worldHistory.events as WorldEvent[]).map(e=>({...e,year:e.monthIndex??e.year})),byId=new Map(events.map((e,i)=>[e.id,{e,i}])),used=new Set<string>();
 for(const p of state.people){
  if(p.nobilityHistory===undefined)continue;if(!Array.isArray(p.nobilityHistory)){errors.push('invalid noble history');continue;}
  let lastMonth=-1;const keys=new Set<string>(),months=new Set<number>(),previous=new Map<string,NobleGrant>();
  for(const g of p.nobilityHistory){
   try{
    if(!g||!NOBLE_RANKS.includes(g.rank)||!Number.isSafeInteger(g.month)||g.month<=lastMonth||g.month%12!==0||g.month>save.world.worldMonth||g.personId!==p.personId||g.sourceUserId!==p.sourceUserId||g.bornMonth!==p.bornMonth||g.personalName!==p.personalName||![g.captureEventIds,g.cityIds,g.importantCityIds,g.importantEventIds].every(a=>Array.isArray(a)&&a.every(x=>typeof x==='string')&&new Set(a).size===a.length))throw Error();
    const ref=byId.get(g.eventId);if(!ref||used.has(g.eventId))throw Error();const {e,i}=ref,before=events.slice(0,i),f=save.factions.find(f=>f.factionId===g.factionId),d=save.dynasties.find(d=>d.factionId===g.factionId),rulers=(Array.isArray(d?.rulers)?d!.rulers:[]).map(x=>importRulerSave(x as any)),r=rulers.find(r=>r.id===g.rulerId),epoch=(Array.isArray(d?.houseEpochs)?d!.houseEpochs:[]).find(h=>h.foundingRulerId===g.epochFounderId),key=JSON.stringify([g.factionId,g.epochFounderId]),prev=previous.get(key),unique=key+g.rank;
    if(!f||!d||!r||!epoch||nobleEpochForRuler({...d,rulers} as any,r.id)?.foundingRulerId!==g.epochFounderId||epoch.startMonth>g.month||epoch.houseName!==r.houseName||epoch.endMonth!==undefined&&r.accessionYear!==undefined&&r.accessionYear>epoch.endMonth||epoch.endMonth!==undefined&&epoch.endMonth<g.month-1||f.stateFoundedMonth===undefined||f.stateFoundedMonth>g.month||r.accessionYear===undefined||r.accessionYear>g.month||r.endYear!==undefined&&r.endYear<g.month||r.deathMonth!==undefined&&r.deathMonth<g.month||r.naturalDeathYear!==undefined&&r.naturalDeathYear<=g.month||keys.has(unique)||months.has(g.month)||g.previousRank!==(prev?.rank??'NONE')||g.rank!==NOBLE_RANKS[prev?NOBLE_RANKS.indexOf(prev.rank)+1:0])throw Error();
    const a=p.appointments.find(a=>a.commandId===g.commandId&&a.factionId===g.factionId&&a.startMonth<=g.month&&g.month<=(a.endMonth??g.month)),office=a?.officeHistory?.filter(o=>o.month<=g.month&&(o.month<g.month||(byId.get(o.eventId)?.i??Infinity)<i)).at(-1)?.office;
    if(!a||office!==g.office||p.deathMonth!==undefined&&p.deathMonth<g.month||before.some(x=>(x.monthIndex??x.year)===g.month&&((x.type==='military-command-ended'&&x.metadata?.commandId===g.commandId)||(x.type==='military-person-died'&&x.metadata?.personId===p.personId)||(x.type==='ruler-died'&&x.metadata?.rulerId===g.rulerId)||(x.type==='ruler-deposed'&&x.metadata?.previousRulerId===g.rulerId))))throw Error();
    const lifecycle=before.filter(x=>['faction-exiled','faction-extinct','faction-restored','faction-submitted','faction-merged'].includes(x.type)&&(x.type==='faction-restored'?x.actorFactionId===g.factionId||x.targetFactionId===g.factionId:x.targetFactionId===g.factionId)).at(-1);if(lifecycle&&lifecycle.type!=='faction-restored')throw Error();
    const titleTeam:any={...f,name:f.factionId},boundaries=[g.month,...(g.month>0&&[...f.nameHistory,...(f.sovereigntyHistory as any[])].some(h=>h.startMonth===g.month)?[g.month-1]:[])];
    if(!boundaries.some(m=>['KING','EMPEROR'].includes(getSovereigntyRankAtMonth(titleTeam,m))&&g.countryName===getHistoricalFactionIdentity(titleTeam,m).name&&g.rulerTitle===formatRulerTitleAtMonth(titleTeam,`${r.houseName.replace(/氏$/, '')}${r.givenName}`,m)))throw Error();
    const merits=deriveNobleMerits(p,state.formations,before,g.factionId,g.month),rule=NOBLE_RULES[g.rank];
    if(g.serviceMonths!==merits.serviceMonths||merits.serviceMonths<rule.serviceMonths||merits.cityIds.length<rule.cities||merits.importantCityIds.length<rule.importantCities||['captureEventIds','cityIds','importantCityIds','importantEventIds'].some(k=>JSON.stringify(g[k as keyof NobleGrant])!==JSON.stringify(merits[k as keyof typeof merits]))||e.type!=='military-ennobled'||e.actorFactionId!==g.factionId||e.rulerId!==g.rulerId||(e.monthIndex??e.year)!==g.month||e.metadata?.nobility!==JSON.stringify(g)||e.title!==nobleChronicle(g))throw Error();
    keys.add(unique);months.add(g.month);used.add(g.eventId);lastMonth=g.month;previous.set(key,g);
   }catch{errors.push('invalid noble grant: '+(g?.eventId??p.personId));}
  }
 }
 for(const e of events)if(e.type==='military-ennobled'&&!used.has(e.id))errors.push('unreferenced noble event: '+e.id);
 return errors;
}
