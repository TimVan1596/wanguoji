const fs=require('node:fs'),path=require('node:path'),dir=path.join(__dirname,'results');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const mean=a=>a.length?a.reduce((a,b)=>a+b,0)/a.length:null;
const quantile=(xs,p)=>{const a=xs.slice().sort((a,b)=>a-b);return a[Math.ceil((a.length-1)*p)]??null;};
const natural=r=>['自然去世','去世'].includes(r.deathReason)&&r.deathMonth!==undefined;
function group(lives){
 const ended=lives.filter(r=>r.endMonth!==undefined),dead=lives.filter(natural),observed=w=>lives.filter(r=>r.observedMonths>=w);
 const incidence=w=>{const xs=observed(w),deaths=xs.filter(r=>natural(r)&&r.deathMonth-r.accessionMonth<=w);return {fullyObserved:xs.length,naturalDeaths:deaths.length,ratio:xs.length?deaths.length/xs.length:null};};
 return {count:lives.length,accessionAge:{mean:mean(lives.map(r=>r.accessionAge)),median:quantile(lives.map(r=>r.accessionAge),.5),p90:quantile(lives.map(r=>r.accessionAge),.9),max:Math.max(0,...lives.map(r=>r.accessionAge))},
  naturalDeaths:dead.length,exact12MonthNaturalDeaths:dead.filter(r=>r.deathMonth-r.accessionMonth===12).length,
  exact12MonthNaturalReignDeaths:dead.filter(r=>r.deathMonth-r.accessionMonth===12&&r.endMonth===r.deathMonth).length,
  naturalWithin12Months:incidence(12),naturalWithin24Months:incidence(24),
  meanCompletedTenureMonths:mean(ended.map(r=>r.tenureMonths)),ongoingTenures:lives.length-ended.length,
  completedTenureBins:Object.fromEntries([[0,12],[13,24],[25,36],[37,60],[61,Infinity]].map(([lo,hi])=>[`${lo}-${hi}`,ended.filter(r=>r.tenureMonths>=lo&&r.tenureMonths<=hi).length])),
  endStatuses:Object.fromEntries([...new Set(lives.map(r=>r.status))].map(s=>[s,lives.filter(r=>r.status===s).length])),
  naturalDeathDuringReign:dead.filter(r=>r.deathMonth===r.endMonth).length,naturalDeathAfterPoliticalEnd:dead.filter(r=>r.deathMonth!==r.endMonth).length,
  otherRecordedDeaths:lives.filter(r=>r.deathMonth!==undefined&&!natural(r)).length,
  politicalEndWithoutDeath:lives.filter(r=>r.endMonth!==undefined&&r.deathMonth===undefined).length};
}
function panel(runs,month){
 const records=runs.flatMap(r=>{const c=r.checkpoints.find(c=>c.metrics.month===month);return c?[{seed:r.seed,...c}]:[];});
 const perSeed=records.map(c=>({seed:c.seed,groups:Object.fromEntries(['RESIDENT_FOUNDER','MILITARY_FOUNDER','INITIAL','SUCCESSOR'].map(k=>[k,group(c.lives.filter(r=>r.kind===k))])),metrics:c.metrics,
  oldExpiredLifeSamples:runs.find(r=>r.seed===c.seed).created.filter(r=>r.accessionMonth<=month&&r.legacySampleDeathMonth<=r.accessionMonth).length}));
 const lives=records.flatMap(c=>c.lives),metrics=records.map(c=>c.metrics),sum=k=>metrics.reduce((n,c)=>n+c[k],0);
 return {seeds:records.length,groups:Object.fromEntries(['RESIDENT_FOUNDER','MILITARY_FOUNDER','INITIAL','SUCCESSOR'].map(k=>[k,group(lives.filter(r=>r.kind===k))])),
  oldExpiredLifeSamples:perSeed.reduce((n,c)=>n+c.oldExpiredLifeSamples,0),balance:{meanPopulation:mean(metrics.map(c=>c.worldPopulation)),warDeaths:sum('warDeaths'),splits:sum('splits'),militarySplits:sum('militarySplits'),restorations:sum('restorations'),extinctions:sum('extinctions'),unifications:sum('unifications'),populationUnexplained:sum('populationUnexplained'),identityConflicts:sum('residentIdentityConflicts')+sum('formationOwnershipConflicts')+sum('militaryRoyalOverlap')+sum('duplicatePopulationIds')},perSeed};
}
const report={definitions:{cohort:'Entrenched rulers only, grouped by verified resident/military origin or initial month zero; remaining enthroned rulers are successors. Ordinary unenthroned kin excluded.',
 naturalIncidence:'Deaths from actual natural death records. 12/24 month denominator includes all entrants with complete observation, including competing political outcomes. This is person-life incidence, not polity survival.',
 tenure:'Completed political tenure only; living or deceased after political end counted separately; ongoing tenures censored.',
 oldExpiredSamples:'Creation-time forwarded observation of the two original draw bounds, not an extra draw. For z9 it reconstructs the actual unconditioned sample; for the candidate it is the hypothetical old-sampler outcome of the same draws.',
 oldAgeTail:'Resident-only conditional lifespan retains original 45–84 band masses, spreads dates over months, and replaces last 5% finite 85–92 band with an open increasing-hazard old-age tail. Ordinary population mortality and military schedules are not changed.',
 rng:'Final resident sampler retains the original two draw bounds and constructs a stratified conditional quantile from both values. First one-draw experiment is preserved separately, not published. Changed deaths still lead to divergent later RNG paths and histories; no event-by-event equivalence assumed.'}};
for(const name of ['baseline','candidate']){const runs=read(`founder-life-${name}.json`);report[name]={hundredYear:panel(runs,1200),twoHundredYear:panel(runs,2400)};}
fs.writeFileSync(path.join(dir,'founder-life-summary.json'),JSON.stringify(report,null,2));
for(const name of ['baseline','candidate'])for(const [period,p]of Object.entries(report[name]))console.log(name,period,JSON.stringify({seeds:p.seeds,resident:p.groups.RESIDENT_FOUNDER,military:p.groups.MILITARY_FOUNDER,balance:p.balance}));
