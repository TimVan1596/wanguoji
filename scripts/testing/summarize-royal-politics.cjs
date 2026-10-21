// Summarize every predetermined seed; never select favorable worlds or invent rare observations.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'results');
const read=label=>JSON.parse(fs.readFileSync(path.join(root,`royal-politics-z12-${label}.json`),'utf8'));
const baseline=read('baseline'),candidate=read('candidate');
const seeds=Array.from({length:24},(_,i)=>`regional-${i+1}`);
for(const rows of [baseline,candidate])if(rows.length!==24||rows.some((r,i)=>r.seed!==seeds[i]))throw Error('Incomplete or reordered predetermined cohort');
const metrics=['worldPopulation','captures','recoveries','extinctions','restorations','splits','militarySplits','rebellions','depositions','militaryPoliticalEvents','unifications','normalRoyalSuccessions'];
const sum=(rows,key)=>rows.reduce((n,c)=>n+(c[key]??0),0);
function group(data,month){
 const worlds=data.filter((_,i)=>month===1200||i<6),rows=worlds.map(r=>r.checkpoints.find(c=>c.month===month));
 if(rows.some(c=>!c))throw Error('Missing required checkpoint');
 const result={worlds:rows.length,month,totals:Object.fromEntries(metrics.map(k=>[k,sum(rows,k)])),meanPopulation:sum(rows,'worldPopulation')/rows.length,
  meanLargestAnnualTerritory:worlds.reduce((n,r)=>n+r.annual.filter(a=>a.month<=month).reduce((s,a)=>s+a.maxTerritoryShare,0)/(month/12),0)/worlds.length,
  qualifiedChecks:sum(rows.map(c=>c.depositionDiagnostics),'qualifiedChecks'),drawAttempts:sum(rows.map(c=>c.depositionDiagnostics),'drawAttempts'),
  ordinaryGeneralAssistedDepositions:worlds.reduce((n,r)=>n+r.depositionRelations.filter(e=>e.month<=month&&e.metadata.militaryParticipation).length,0),
  royalMilitaryAccessions:sum(rows.map(c=>c.royalMilitary),'accessions'),normalRoyalMilitaryAccessions:sum(rows.map(c=>c.royalMilitary),'normalAccessions'),
  royalCommandCrises:rows.every(c=>Number.isInteger(c.depositionDiagnostics.royalCommandCrises))?sum(rows.map(c=>c.depositionDiagnostics),'royalCommandCrises'):null,
  weightedSelections:sum(rows.map(c=>c.depositionDiagnostics),'royalWeightedSelections'),changedSelections:sum(rows.map(c=>c.depositionDiagnostics),'royalChangedSelections'),
  integrity:{populationUnexplained:sum(rows,'populationUnexplained'),royalIdentityConflicts:sum(rows.map(c=>c.royalMilitary),'identityConflicts'),duplicateFormationMembers:sum(rows.map(c=>c.royalMilitary),'duplicateActiveMembers'),ownershipConflicts:sum(rows,'formationOwnershipConflicts'),duplicatePopulationIds:sum(rows,'duplicatePopulationIds'),residentIdentityConflicts:sum(rows,'residentIdentityConflicts'),allSavesValid:rows.every(c=>c.strictSaveValid)}};
 if(!rows.every(c=>Number.isInteger(c.normalRoyalSuccessions)&&Number.isInteger(c.royalMilitary.normalAccessions)))throw Error('Missing normal succession measurements');
 const ordinary=rows.map(c=>c.ordinaryResidentAges),population=sum(ordinary,'population');
 result.ordinaryResidents={population,over70:sum(ordinary,'over70')/population,over90:sum(ordinary,'over90')/population,over100:sum(ordinary,'over100')/population,maxAge:Math.max(...ordinary.map(c=>c.max))};
 return result;
}
const comparisons=baseline.flatMap((world,i)=>world.checkpoints.map(a=>{
 const b=candidate[i].checkpoints.find(b=>b.month===a.month);
 if(!b)throw Error('Missing paired checkpoint');
 return {seed:world.seed,month:a.month,metricsEqual:metrics.every(k=>a[k]===b[k]),rngPositionEqual:a.worldRandomPosition===b.worldRandomPosition,
  qualifiedChecksEqual:a.depositionDiagnostics.qualifiedChecks===b.depositionDiagnostics.qualifiedChecks,
  deltas:Object.fromEntries(metrics.map(k=>[k,b[k]-a[k]]))};
}));
const replay=[];
if(process.env.WANGUOJI_COHORT_REPLAY_DIR)for(const [label,final]of [['baseline',baseline],['candidate',candidate]]){
 const initial=JSON.parse(fs.readFileSync(path.join(process.env.WANGUOJI_COHORT_REPLAY_DIR,`z12-initial-${label}.json`),'utf8'));
 for(const [i,r]of final.entries())for(const c of r.checkpoints){
  const before=initial[i]?.checkpoints.find(a=>a.month===c.month);
  if(initial[i]?.seed!==r.seed||!before||before.canonicalSha256!==c.canonicalSha256)throw Error(`Read-only measurement changed replay: ${label}/${r.seed}/${c.month}`);
  replay.push({label,seed:r.seed,month:c.month,initialCanonicalSha256:before.canonicalSha256,finalCanonicalSha256:c.canonicalSha256,matched:true});
 }
}
const examples=candidate.flatMap(r=>r.depositionRelations.flatMap(e=>{
 const selection=JSON.parse(e.metadata.depositionSelection),own=selection.candidates.filter(c=>c.ownMilitary);
 if(!own.length)return [];
 const baseTotal=selection.candidates.reduce((n,c)=>n+c.baseWeight,0);let remaining=selection.conditionalRoll*baseTotal;
 const original=selection.candidates.find(c=>(remaining-=c.baseWeight)<0)??selection.candidates.at(-1);
 return [{seed:r.seed,month:e.month,selectedRulerId:selection.selectedRulerId,unweightedRulerId:original.rulerId,changed:original.rulerId!==selection.selectedRulerId,selection}];
}));
const report={replay,naturalWeightedExamples:examples,baselineHead:'a2e7f3d76b8487f10585ebd96afc35c3f3ccd7f5',cohort:{seeds,hundredYearWorlds:24,twoHundredYearWorlds:6},
 mechanism:{minimumAdvantage:.15,maximumAdvantage:.25,distinctCityCap:2,extraSelectionDraws:0,normalSuccessionChanged:false,depositionSuccessChanceChanged:false},
 hundredYears:{baseline:group(baseline,1200),candidate:group(candidate,1200)},twoHundredYears:{baseline:group(baseline,2400),candidate:group(candidate,2400)},comparisons,
 caveats:['Natural weighted-success events may be absent; controlled real Core transactions, not mathematical selection alone, verify the political closure.','Baseline royal-command crisis counter is null because z11 did not implement this counter. Zero weighted selections in z11 means no such mechanic.','Metrics/RNG-position equality is not a claim that V21 and V22 JSON or all historical evidence are byte-identical.','Ordinary resident mortality is unchanged and requires separate population calibration.']};
const output=path.join(root,'royal-politics-z12-summary.json');fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({hundredYears:report.hundredYears,twoHundredYears:report.twoHundredYears,pairedCheckpoints:comparisons.length,allMetricsEqual:comparisons.every(c=>c.metricsEqual),allRngPositionsEqual:comparisons.every(c=>c.rngPositionEqual)},null,2));
