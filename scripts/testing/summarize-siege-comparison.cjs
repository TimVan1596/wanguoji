// Run after natural-core-runner completes both frozen source variants.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'results');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const baseline=read('siege-z7-baseline.json'),candidate=read('siege-candidate.json');
const fields=['unifications','captures','recoveries','siegeCityMonths','activeStates','splits','militarySplits','classicRebellions','frontierRebellions','restorations','extinctions','appointments','depositions','worldPopulation','warDeaths','populationUnexplained','formationOwnershipConflicts','residentIdentityConflicts','militaryRoyalOverlap'];
const at=(r,month)=>r.checkpoints.find(c=>c.month===month);
const metrics=(r,month)=>{
 const c=at(r,month);if(!c)return undefined;
 const years=r.annual.filter(a=>a.month<=month);
 return {...Object.fromEntries(fields.map(k=>[k,c[k]])),promotions:c.promotions.length,meanServiceMonths:c.meanServiceMonths,
  meanAnnualLargestShare:years.reduce((n,a)=>n+a.maxTerritoryShare,0)/years.length,
  peakAnnualLargestShare:Math.max(...years.map(a=>a.maxTerritoryShare)),meanAnnualActiveStates:years.reduce((n,a)=>n+a.activeStates,0)/years.length,
  unificationMonths:r.unificationMonths.filter(m=>m<=month),worldRandomPosition:c.worldRandomPosition,canonicalSha256:c.canonicalSha256};
};
const pairs=baseline.map(b=>{
 const c=candidate.find(c=>c.seed===b.seed);if(!c)throw new Error(`Missing candidate ${b.seed}`);
 return {seed:b.seed,checkpoints:[1200,2400].filter(m=>at(b,m)&&at(c,m)).map(month=>({month,baseline:metrics(b,month),candidate:metrics(c,month)}))};
});
if(pairs.length!==24||candidate.length!==24||pairs.filter(p=>p.checkpoints.some(c=>c.month===2400)).length!==6)throw new Error('Required 24 x 100 year / 6 x 200 year pairs are incomplete');
const summaries=[1200,2400].map(month=>{
 const rows=pairs.flatMap(p=>p.checkpoints.filter(c=>c.month===month));
 const sum=(side,key)=>rows.reduce((n,r)=>n+r[side][key],0);
 return {month,seeds:rows.length,totals:Object.fromEntries([...fields,'promotions'].map(k=>[k,{baseline:sum('baseline',k),candidate:sum('candidate',k)}])),
  means:Object.fromEntries(['meanAnnualLargestShare','peakAnnualLargestShare','meanAnnualActiveStates','meanServiceMonths'].map(k=>[k,{baseline:sum('baseline',k)/rows.length,candidate:sum('candidate',k)/rows.length}]))};
});
const contactStats=rows=>rows.map(r=>{
 const closed=r.episodes??[],n=closed.length,hist={};
 for(const [key,count] of Object.entries(r.forceSamples??{})){const [attackers]=key.split(':');hist[attackers]=(hist[attackers]??0)+count;}
 return {seed:r.seed,years:r.years,rawRegistrationCallbacks:r.contactCalls,nearbyIndependentAttackerHistogram:hist,
  directPopulationLossAroundSiegeSettlement:r.localSiegeDeaths,closedObservedCityEpisodes:n,
  closedCaptured:closed.filter(e=>e.result==='CAPTURED').length,closedContactEnded:closed.filter(e=>e.result==='CONTACT_ENDED').length,
  closedDestroyed:closed.filter(e=>e.result==='DESTROYED').length,ongoingObservedCityEpisodes:r.ongoingEpisodes?.length??0,
  meanClosedDurationMonths:n?closed.reduce((n,e)=>n+e.durationMonths,0)/n:null};
});
const result={baselineHead:'eb55496c7df0ac82d12e8413bce76f5b7552fd57',scenario:'default seven-state real Core and Phaser Arcade, Windows',
 decision:'REJECTED: candidate is an isolated production-City patch, NOT enabled in v0.99931z8; keep z7 siege, population-loss fallback, and 2/2/12 limits.',
 denominators:{captureFrequency:'deduplicated authoritative city-captured / city-recovered / capital-fallen actions per hostile-contact city-month; NOT battle win probability',
  rawContacts:'registerSiegeContact callbacks, including rejected or repeated callbacks; never soldiers',
  strength:'unique verified live User/Player/logical-unit bindings present near the city at settlement, per faction-city-month; position uses the active runtime authority; not proof each soldier touched the city',
  episodes:'consecutive underSiege city episodes observed after monthly settlement, not individual army attempts; instant first-tick captures may not open an episode; CONTACT_ENDED does not identify retreat, defeat or treaty cause',
  casualties:'world population delta around City.updateSiege, may include capture/terminal transaction loss; not asserted to be all local defenders'},
 limitations:['This new fixed-seed panel is not the older army-1..12 panel: zero unifications here cannot by itself diagnose the historical z6 18 -> z7 3 change. No political probabilities were changed.',
  'Both variants have zero unification events in this panel; first-unification time, post-unification duration and re-fracture distributions are consequently unavailable.',
  'Failure/withdrawal reasons are not canonical z7 events. No new failure narratives are published. Controlled tests do not establish natural rare-event frequency.'],
 summaries,pairs,contacts:{baseline:contactStats(baseline),candidate:contactStats(candidate)}};
const release=read('political-release-z8.json');
if(release.length!==6||release.some(r=>r.years!==200))throw new Error('Six actual-release 200-year runs are incomplete');
result.actualRelease={scope:'old siege plus released deposition choice; six seeds at 100/200 years, not the rejected siege candidate',
 pairs:release.map(r=>({seed:r.seed,depositionRelations:r.depositionRelations,
 checkpoints:r.checkpoints.map(c=>{const b=at(baseline.find(b=>b.seed===r.seed),c.month);return {month:c.month,depositions:c.depositions,
  sameCanonicalSha256:c.canonicalSha256===b.canonicalSha256,sameRngPosition:c.worldRandomPosition===b.worldRandomPosition,
  unifications:c.unifications,captures:c.captures,populationUnexplained:c.populationUnexplained,formationOwnershipConflicts:c.formationOwnershipConflicts};})})),
 limitation:'No natural deposition in either side of these six seeds: identical full canonical fingerprints and RNG positions do NOT establish an unchanged successor distribution when a coup occurs. See deposition-selection-z8.json for controlled conditional distributions and deposition-core-z8.json for real Core transactions.'};
fs.writeFileSync(path.join(root,'siege-comparison-z8.json'),JSON.stringify(result,null,2));
process.stdout.write(JSON.stringify(summaries,null,2)+'\n');
