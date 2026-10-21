// Derive compact, per-seed metrics from the real Core's saved observations.
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'results');
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,`siege-z9-${name}.json`),'utf8'));
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const quantile=(xs,p)=>{const a=xs.slice().sort((a,b)=>a-b);return a[Math.ceil((a.length-1)*p)]??0;};
function row(run,month){
 const b=run.balance.checkpoints.find(c=>c.month===month),c=run.checkpoints.find(c=>c.month===month);
 if(!b||!c)return;
 const annual=run.balance.annual.filter(a=>a.month<=month),transfers=run.transfers.filter(t=>t.month<=month);
 const reasons={};for(const e of c.completedEpisodes)reasons[e.reason]=(reasons[e.reason]||0)+1;
 return {seed:run.seed,month,captures:transfers.filter(t=>t.kind==='CAPTURE').length,revolts:transfers.filter(t=>t.kind==='REVOLT').length,
  recoveries:b.recoveries,siegeCityMonths:b.siegeCityMonths,contactCalls:month===run.years*12?run.balance.contactCalls:null,
  recaptureWindows:c.recaptureWindows,cityTransferDistribution:c.cumulativeTransfers,
  mostContested:c.cities.slice().sort((a,b)=>b.captureCount-a.captureCount).slice(0,3),
  meanDevastation:c.meanDevastation,maxDevastation:Math.max(...c.cities.map(x=>x.maxDevastation)),
  localSiegeDeaths:c.localLoss,nationalFallbackSiegeDeaths:c.nationalFallbackLoss,noEligibleVictimAttempts:c.noEligibleVictim,
  completedSiegeEpisodes:reasons,meanCompletedSiegeMonths:mean(c.completedEpisodes.map(e=>e.durationMonths)),
  p90CompletedSiegeMonths:quantile(c.completedEpisodes.map(e=>e.durationMonths),.9),ongoingSieges:c.ongoingEpisodes.length,
  meanLargestTerritory:mean(annual.map(a=>a.maxTerritoryShare)),meanActiveStates:mean(annual.map(a=>a.activeStates)),
  unificationMonths:run.balance.unificationMonths.filter(m=>m<=month),splits:b.splits,militarySplits:b.militarySplits,
  rebellions:b.rebellions,restorations:b.restorations,extinctions:b.extinctions,worldPopulation:b.worldPopulation,warDeaths:b.warDeaths,
  promotions:b.promotions.length,meanServiceMonths:b.meanServiceMonths,meanFormationSize:b.meanFormationSize,militaryPoliticalEvents:b.militaryPoliticalEvents,
  populationUnexplained:b.populationUnexplained,identityConflicts:b.formationOwnershipConflicts+b.residentIdentityConflicts+b.militaryRoyalOverlap+b.duplicatePopulationIds,
  canonicalSha256:b.canonicalSha256,worldRandomPosition:b.worldRandomPosition,strictSaveValid:b.strictSaveValid};
}
function aggregate(rows){
 const total=k=>rows.reduce((n,r)=>n+r[k],0),avg=k=>mean(rows.map(r=>r[k]));
 return {seeds:rows.length,captures:total('captures'),recoveries:total('recoveries'),siegeCityMonths:total('siegeCityMonths'),
  recaptureWindows:Object.fromEntries([12,24,60,120].map(w=>{const n=rows.reduce((n,r)=>n+r.recaptureWindows[w].recaptured,0),d=rows.reduce((n,r)=>n+r.recaptureWindows[w].fullyObservedCaptures,0);return [w,{recaptured:n,fullyObservedCaptures:d,ratio:d?n/d:null}];})),
  meanPerWorldMedianTransfers:mean(rows.map(r=>r.cityTransferDistribution.median)),meanPerWorldP90Transfers:mean(rows.map(r=>r.cityTransferDistribution.p90)),
  extremeCityTransfers:Math.max(...rows.map(r=>r.cityTransferDistribution.max)),meanPerWorldExtremeTransfers:mean(rows.map(r=>r.cityTransferDistribution.max)),
  meanDevastation:avg('meanDevastation'),maxDevastation:Math.max(...rows.map(r=>r.maxDevastation)),
  localSiegeDeaths:total('localSiegeDeaths'),nationalFallbackSiegeDeaths:total('nationalFallbackSiegeDeaths'),warDeaths:total('warDeaths'),
  meanLargestTerritory:avg('meanLargestTerritory'),meanActiveStates:avg('meanActiveStates'),unifications:rows.reduce((n,r)=>n+r.unificationMonths.length,0),
  splits:total('splits'),militarySplits:total('militarySplits'),rebellions:total('rebellions'),restorations:total('restorations'),extinctions:total('extinctions'),
  promotions:total('promotions'),meanServiceMonths:avg('meanServiceMonths'),meanFormationSize:avg('meanFormationSize'),
  militaryPoliticalEvents:total('militaryPoliticalEvents'),meanWorldPopulation:avg('worldPopulation'),populationUnexplained:total('populationUnexplained'),identityConflicts:total('identityConflicts')};
}
const results={};
for(const name of ['baseline','baseline-screen','A','B','C','BC','R','BCR','BC-full']){
 const runs=name==='baseline-screen'?read('baseline').slice(0,4):read(name),hundred=runs.map(r=>row(r,1200)).filter(Boolean),long=runs.filter((r,i)=>name!=='baseline-screen'||i<2).map(r=>row(r,2400)).filter(Boolean);
 results[name]={hundredYear:{aggregate:aggregate(hundred),perSeed:hundred},twoHundredYear:{aggregate:aggregate(long),perSeed:long}};
}
const report={baselineHead:'c1a63421c11a0d0e11e783c5d01fe36273d30281',
 definitions:{
  retake:'Next actual capture OR revolt of the same city within the window after a capture; captures lacking a complete follow-up horizon are excluded.',
  siegeCityMonth:'At least one valid hostile contact row entering monthly City settlement. Capture frequency per city-month is NOT independent battle win probability.',
  units:'Independent verified nearby unit IDs sampled at settlement, not collision calls; existing contact rows do not identify every historical attacker.',
  contactEnded:'No valid contact is evidence of siege interruption only, not a verified military defeat or credited defensive victory.',
  cityDistribution:'Cumulative City.captureCount includes captures and revolts; includes newly founded and archived cities observed by monthly settlement.',
  causality:'Deterministic identical initial seeds; later RNG consumption and histories diverge. Comparisons are whole-rule experiments, not paired battle causal effects.',
  sample:'24 fixed seeds at 100 years; first 6 at 200 for baseline/BC-full; A/B/C/R/BCR screening only 4 seeds (first 2 at 200). No universal balance guarantee.',
  unification:'Only canonical world-unification events. If none, first time/duration/refragmentation are not measurable; no political probabilities adjusted.',
  damage:'Legacy diagnostic wall-damage delta omits capture-final hits when capture restores walls; not used as total damage or a conservation assertion.'},results};
fs.writeFileSync(path.join(dir,'siege-z9-summary.json'),JSON.stringify(report,null,2));
for(const [name,r]of Object.entries(results))console.log(name,JSON.stringify(r.hundredYear.aggregate));
