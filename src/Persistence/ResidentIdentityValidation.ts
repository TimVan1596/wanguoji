import {evaluatePopularPoliticalCrisis} from '../Simulation/PopularPoliticalCrisis';
import type {WorldSaveV1} from "./WorldSaveSchema";
/** V19 resident founders have one permanent life record and at most one live map entity. */
export function validateResidentIdentities(save:WorldSaveV1):string[]{
  if(!Array.isArray(save.users)||!Array.isArray(save.factions)||!Array.isArray(save.cities)||!Array.isArray(save.dynasties)||!Array.isArray(save.worldHistory?.events))return [];
  const errors:string[]=[],people=new Map<string,any>(),sourceIds=new Set<string>();
  const record=(v:unknown)=>v!==null&&typeof v==="object"&&!Array.isArray(v);
  const users=save.users.filter(record);
  const events=(save.worldHistory.events as any[]).filter(record),eventById=new Map(events.map(e=>[e.id,e]));
  for(const e of events)if(e.type==="faction-restored"&&e.metadata?.restorationTrigger==="MILITARY_RECAPTURE"){
    const c=eventById.get(e.metadata.captureEventId);
    if(!c||!["city-captured","city-recovered","capital-fallen"].includes(c.type)||c.actorFactionId!==e.actorFactionId||c.cityId!==e.cityId||(c.monthIndex??c.year)!==(e.monthIndex??e.year)||e.metadata.remnantPopulation!==0)errors.push("military restoration lacks matching capture evidence");
  }
  for(const [index,e]of events.entries())if(e.metadata?.popularCrisisFacts!==undefined){try{
   const f=JSON.parse(e.metadata.popularCrisisFacts),at=e.monthIndex??e.year;
   if(!['rebel-faction-founded','frontier-faction-founded'].includes(e.type)||f.worldMonth!==at||!['loyalty','devastation','stability'].every(k=>Number.isFinite(f[k])&&f[k]>=0&&f[k]<=100)||!Number.isSafeInteger(f.captureCount)||f.captureCount<0||!Number.isFinite(f.strain)||f.strain<0||f.lastCapturedMonth!==undefined&&(!Number.isSafeInteger(f.lastCapturedMonth)||f.lastCapturedMonth>at||f.lastCapturedMonth<0))throw Error();
   const crisis=evaluatePopularPoliticalCrisis(f);if(!crisis.eligible||e.metadata.popularCrisisReason!==crisis.reason)throw Error();
   if(crisis.reason!=='ORIGINAL_CRISIS'){
    const captures=events.slice(0,index).filter(x=>x.cityId===e.cityId&&['city-captured','city-recovered','capital-fallen'].includes(x.type));
    if(!captures.some(x=>(x.monthIndex??x.year)===f.lastCapturedMonth)||crisis.reason==='REPEATED_OCCUPATION'&&new Set(captures.map(x=>JSON.stringify([x.monthIndex??x.year,x.actorFactionId,x.previousOwnerFactionId??x.targetFactionId]))).size<2)throw Error();
   }
  }catch{errors.push('ordinary founding crisis facts lack valid dated evidence');}}
  const factions=new Map(save.factions.filter(record).map(f=>[f.factionId,f]));
  const cities=new Set([...save.cities.filter(record).map(c=>c.cityId),...(Array.isArray(save.registries?.archivedCities)?save.registries.archivedCities:[]).map((c:any)=>c?.cityId??c?.id)]);
  for(const d of save.dynasties)for(const r of (Array.isArray(d?.rulers)?d.rulers:[]) as any[]){
    if(!r||typeof r!=="object")continue;
    const i=r.residentIdentity;if(i===undefined)continue;
    if(!i||typeof i!=="object"||typeof i.personId!=="string"||!i.personId||people.has(i.personId)||!Number.isSafeInteger(i.sourceUserId)||sourceIds.has(`${i.sourceUserId}:${i.bornMonth}:${i.sourceUserLabel}`)||
      typeof i.sourceUserLabel!=="string"||!i.sourceUserLabel||typeof i.sourceFactionName!=="string"||!factions.has(i.sourceFactionId)||!cities.has(i.cityId)||typeof i.cityName!=="string"||
      !Number.isSafeInteger(i.bornMonth)||i.bornMonth!==r.bornMonth||!Number.isSafeInteger(i.foundedMonth)||i.foundedMonth!==r.accessionMonth||i.foundedMonth>Number(save.world?.worldMonth)||
      !Number.isSafeInteger(r.naturalDeathMonth)||r.naturalDeathMonth<=i.foundedMonth||r.relationType!=="FOUNDER"||
      factions.get(String(d.factionId))?.origin?.parentFactionId!==i.sourceFactionId||factions.get(String(d.factionId))?.origin?.foundingRulerId!==r.rulerId){errors.push("resident founder identity/provenance mismatch");continue;}
    people.set(i.personId,{r,d,i});sourceIds.add(`${i.sourceUserId}:${i.bornMonth}:${i.sourceUserLabel}`);
    const bindings=users.filter(u=>u.historicalPersonId===i.personId||u.rulerId===r.rulerId||(u.userId===i.sourceUserId&&u.bornMonth===i.bornMonth&&u.name===i.sourceUserLabel));
    if(bindings.length>1)errors.push("resident person has duplicate live entities");
    for(const u of bindings){
      if(u.historicalPersonId!==i.personId||u.userId!==i.sourceUserId||u.name!==i.sourceUserLabel||u.bornMonth!==r.bornMonth||(u.militaryPersonId!==undefined&&u.militaryPersonId!==i.military?.personId)||r.deathMonth!==undefined||
        (u.role==="RULER"&&(u.rulerId!==r.rulerId||u.factionId!==d.factionId||d.currentRulerId!==r.rulerId||r.status!=="ruling")))errors.push("resident person life/entity mismatch");
    }
    const accession=events.find((e:any)=>e.type==="ruler-acceded"&&e.rulerId===r.rulerId);
    if(!accession||accession.metadata?.residentPersonId!==i.personId||accession.metadata?.sourceUserId!==i.sourceUserId||accession.metadata?.sourceFactionId!==i.sourceFactionId||accession.metadata?.foundingCityId!==i.cityId)errors.push("resident founder lacks canonical accession evidence");
  }
  for(const u of users)if(u.historicalPersonId!==undefined&&!people.has(String(u.historicalPersonId))&&!save.dynasties.some(d=>Array.isArray(d?.rulers)&&d.rulers.some(r=>r?.militaryIdentity?.personId===u.historicalPersonId)))errors.push("unknown resident historicalPersonId");
  return errors;
}
