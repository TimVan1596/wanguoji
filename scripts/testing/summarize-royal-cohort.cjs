const fs=require('node:fs');
const root='scripts/testing/results/';
const baseline=JSON.parse(fs.readFileSync(root+'royal-military-baseline.json'));
let candidate=JSON.parse(fs.readFileSync(root+'royal-military-candidate.json'));
const prefixPath=root+'royal-military-candidate-recheck.json';
const rechecks=[];
if(fs.existsSync(prefixPath)){
 const prefix=JSON.parse(fs.readFileSync(prefixPath));
 candidate=candidate.map(world=>{
  const rerun=prefix.find(r=>r.seed===world.seed);if(!rerun)return world;
  for(const c of world.checkpoints){const r=rerun.checkpoints.find(r=>r.month===c.month);if(!r||r.canonicalSha256!==c.canonicalSha256||r.worldRandomPosition!==c.worldRandomPosition)throw Error(`Recheck changed canonical/RNG outcome: ${world.seed}:${c.month}`);rechecks.push({seed:world.seed,month:c.month,canonicalAndRngEqual:true});}
  return rerun;
 });
}
const seeds=Array.from({length:24},(_,i)=>`regional-${i+1}`);
for(const [label,worlds]of [['baseline',baseline],['candidate',candidate]]){
 if(worlds.length!==24||seeds.some(s=>!worlds.some(w=>w.seed===s)))throw Error(`${label}: incomplete fixed cohort`);
 for(const w of worlds)if(!w.checkpoints.some(c=>c.month===1200)||seeds.slice(0,6).includes(w.seed)&&!w.checkpoints.some(c=>c.month===2400))throw Error(`${label}: incomplete horizon ${w.seed}`);
}
if(candidate.some(w=>w.checkpoints.some(c=>c.royalMilitary.adultKinObserved===undefined)))throw Error('Candidate missing final offer/identity diagnostic instrumentation');
const sum=xs=>xs.reduce((a,b)=>a+b,0),mean=xs=>xs.length?sum(xs)/xs.length:0;
function group(worlds,month,label){
 const ws=worlds.filter(w=>w.checkpoints.some(c=>c.month===month)),cs=ws.map(w=>w.checkpoints.find(c=>c.month===month));
 const totals=key=>sum(cs.map(c=>c[key]||0)),royal=key=>sum(cs.map(c=>c.royalMilitary[key]||0));
 const population=totals('worldPopulation'),ordinary=sum(cs.map(c=>c.ordinaryResidentAges.population));
 const age={ordinaryResidents:ordinary,meanAge:ordinary?sum(cs.map(c=>c.ordinaryResidentAges.mean*c.ordinaryResidentAges.population))/ordinary:0,maxAge:Math.max(...cs.map(c=>c.ordinaryResidentAges.max))};
 for(const key of ['over70','over90','over100','over120','over150']){age[key]=sum(cs.map(c=>c.ordinaryResidentAges[key]));age[key+'Percent']=ordinary?age[key]/ordinary*100:0;}
 const rows=ws.map((w,i)=>({seed:w.seed,month,royalMilitary:cs[i].royalMilitary,population:cs[i].worldPopulation,populationUnexplained:cs[i].populationUnexplained,identityConflicts:cs[i].residentIdentityConflicts,duplicatePopulationIds:cs[i].duplicatePopulationIds,formationOwnershipConflicts:cs[i].formationOwnershipConflicts,extinctions:cs[i].extinctions,restorations:cs[i].restorations,splits:cs[i].splits,militarySplits:cs[i].militarySplits,unifications:cs[i].unifications,meanMaxTerritoryShare:mean(w.annual.filter(a=>a.month<=month).map(a=>a.maxTerritoryShare)),ordinaryResidentAges:cs[i].ordinaryResidentAges,strictSaveValid:cs[i].strictSaveValid}));
 return {seeds:ws.length,years:month/12,meanFinalPopulation:population/ws.length,meanAnnualMaximumTerritoryPercent:mean(rows.map(r=>r.meanMaxTerritoryShare))*100,meanAnnualActiveStates:mean(ws.map(w=>mean(w.annual.filter(a=>a.month<=month).map(a=>a.activeStates)))),
  royalMilitary:{offeredCandidatePeople:label==='baseline'?0:royal('candidatePeople'),enlisted:royal('enlisted'),victories:royal('victories'),promotions:royal('promotions'),battleDeaths:royal('battleDeaths'),naturalDeaths:royal('naturalDeaths'),accessions:royal('accessions'),identityConflicts:royal('identityConflicts'),duplicateActiveMembers:royal('duplicateActiveMembers')},
  political:{extinctions:totals('extinctions'),restorations:totals('restorations'),splits:totals('splits'),militarySplits:totals('militarySplits'),unifications:totals('unifications')},
  invariants:{populationUnexplained:totals('populationUnexplained'),residentIdentityConflicts:totals('residentIdentityConflicts'),duplicatePopulationIds:totals('duplicatePopulationIds'),formationOwnershipConflicts:totals('formationOwnershipConflicts'),allStrictSavesValid:cs.every(c=>c.strictSaveValid)},ordinaryAgeSnapshot:age,perSeed:rows};
}
const result={baselineHead:'ecf5b6a168bafc4b5df000152f0b788c968e713e',appVersion:'v0.99931z11',packageVersion:'0.99.177',saveSchemaVersion:21,
 measurement:'Real Arcade Core, default seven states; identical read-only observers; all fixed seeds retained. Candidate offers count unique real people returned by the production opportunity reader. Baseline feature is absent, so actual offers are zero. Static adult-kin observation is a separate, conservative age18-64 diagnostic.',
 diagnosticRecheck:rechecks,baseline:{years100:group(baseline,1200,'baseline'),years200:group(baseline,2400,'baseline')},candidate:{years100:group(candidate,1200,'candidate'),years200:group(candidate,2400,'candidate')},
 limitations:['Shared seeds do not imply identical subsequent RNG paths. No probability or troop-cap tuning to match event counts.','Age snapshots describe surviving ordinary real Users across these worlds, excluding military/royal identities; they are not a birth cohort or a mortality experiment.','Controlled career/deposition regressions verify reachability, not natural event rates.','Chrome visual acceptance remains pending.']};
fs.writeFileSync(root+'royal-military-summary.json',JSON.stringify(result,null,2));
fs.writeFileSync(root+'royal-military-candidate.json',JSON.stringify(candidate,null,2));
for(const label of ['baseline','candidate'])for(const horizon of ['years100','years200']){const {perSeed,...row}=result[label][horizon];console.log(label,horizon,JSON.stringify(row));}
