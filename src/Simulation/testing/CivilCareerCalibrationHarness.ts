import Civil from '../../Politics/CivilAdministration';
import {civilOfficeCap,centralCivilOfficeAvailable} from '../../Politics/CivilOffice';
import {civilPromotionEvidence} from '../../Politics/CivilPromotion';
import type {CivilCareerPolicy} from '../../Politics/CivilCareerRules';
import {runMilitaryBalance} from './MilitaryBalanceHarness';
/** Additional fixed first-four seeds; monthly diagnostic sampling, not another simulator. */
export async function runCivilCareerCalibration(seed:string,years=100){
 const results:any[]=[];
 for(const policy of ['BASELINE','LOW','MEDIUM'] as CivilCareerPolicy[]){
  const original=Civil.update,streaks=new Map<string,{start:number;last:number}>(),bins:Record<string,{samples:number;candidates:number;vacantSamples:number;centralVacantSamples:number;eligiblePromotions:number;maxVacancySampleSpanMonths:number}>={};let lastMonth=-1;
  Civil.update=function(month,teams,dynasties){const result=original.call(this,month,teams,dynasties);if(month===lastMonth||month>years*12)return result;lastMonth=month;
   const diagnostics=Civil.getCandidateDiagnostics(month,teams,dynasties),terms=Civil.getTerms();
   for(const t of teams.filter(t=>t.status==='ACTIVE'&&t.identityStage==='STATE')){const cap=civilOfficeCap(t.cities.length),key=t.cities.length===1?'one-city':cap===1?'two-four-cities':cap===2?'five-eight-cities':'nine-plus-cities',b=bins[key]??(bins[key]={samples:0,candidates:0,vacantSamples:0,centralVacantSamples:0,eligiblePromotions:0,maxVacancySampleSpanMonths:0}),d=diagnostics.find(d=>d.factionId===t.name)!;b.samples++;b.candidates+=d.candidates;
    if(d.hasVacancy){b.vacantSamples++;const old=streaks.get(t.name),s=old&&old.last===month-1?{start:old.start,last:month}:{start:month,last:month};streaks.set(t.name,s);b.maxVacancySampleSpanMonths=Math.max(b.maxVacancySampleSpanMonths,s.last-s.start);}else streaks.delete(t.name);
    if(cap>=2&&centralCivilOfficeAvailable('YUSHI_DAFU',t.cities.length,terms,t.name))b.centralVacantSamples++;
    if(month%12===0)b.eligiblePromotions+=terms.filter(r=>r.factionId===t.name&&r.endMonth===undefined).filter(r=>{const u=[...t.users].find(u=>u.id===r.sourceUserId&&u.bornMonth===r.bornMonth);return u&&civilPromotionEvidence(r,month,u.loyalty,t.cities.length,terms);}).length;
   }return result;
  };
  try{const result=await runMilitaryBalance(seed,years,false,false,'MEDIUM',undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,policy),c=result.checkpoints.at(-1)! as any,terms=Civil.getTerms(),people=new Set(terms.map(t=>t.personId)),assessments=terms.flatMap(t=>t.stewardshipAssessments??[]),longCounty=new Set(terms.filter(t=>t.office==='XIANLING'&&Math.min(t.endMonth??years*12,years*12)-t.startMonth>=120&&!terms.some(other=>other.personId===t.personId&&other.promotion)).map(t=>t.personId));
   results.push({policy,seed,years,people:people.size,appointments:terms.length,promotions:terms.filter(t=>t.promotion).length,promotionSteps:Object.fromEntries(['JUNSHOU','YUSHI_DAFU','CHENGXIANG'].map(o=>[o,terms.filter(t=>t.office===o&&t.promotion).length])),assessments:assessments.length,recoveryReceipts:terms.reduce((n,t)=>n+(t.receipts?.length??0),0),retired:new Set(terms.filter(t=>t.endReason==='RETIREMENT').map(t=>t.personId)).size,diedInOffice:new Set(terms.filter(t=>t.endReason==='DEATH').map(t=>t.personId)).size,longUnpromotedCountyPeople:longCounty.size,civilPeerages:c.careerAudit?.civilPeerages??c.civilAdministration?.civilPeerages,bins,canonicalSha256:c.canonicalSha256,worldRandomPosition:c.worldRandomPosition,strictSaveValid:c.strictSaveValid,scope:'Same fixed seed; actual monthly Core. Vacancy durations are consecutive after-Civil-phase sample spans; diagnostic overhead is excluded from performance claims.'});
  }finally{Civil.update=original;}
 }
 return {seed,years,results};
}
