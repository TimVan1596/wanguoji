// Read-only staged release gates. Missing seeds/checkpoints are failures, never zero observations.
const fs=require('node:fs'),path=require('node:path'),dir=path.join(__dirname,'results');
const read=f=>JSON.parse(fs.readFileSync(path.join(dir,f+'.json'),'utf8'));
const mean=a=>a.reduce((s,n)=>s+n,0)/a.length;
function stats(worlds,month){
 const rows=worlds.map(w=>({w,b:w.balance.checkpoints.find(c=>c.month===month),s:w.checkpoints.find(c=>c.month===month)}));
 if(rows.some(r=>!r.b||!r.s))throw Error('Missing checkpoint '+month);
 const total=k=>rows.reduce((s,r)=>s+(Array.isArray(r.b[k])?r.b[k].length:r.b[k]),0);
 return {worlds:rows.length,captures:total('captures'),promotions:total('promotions'),extinctions:total('extinctions'),restorations:total('restorations'),splits:total('splits'),militarySplits:total('militarySplits'),unifications:total('unifications'),meanPopulation:mean(rows.map(r=>r.b.worldPopulation)),warDeaths:total('warDeaths'),meanActiveStates:mean(rows.map(r=>r.b.meanActiveStates)),meanMaxTerritoryShare:mean(rows.map(({w})=>mean(w.balance.annual.filter(a=>a.month<=month).map(a=>a.maxTerritoryShare)))),meanFormationSize:mean(rows.map(r=>r.b.meanFormationSize)),emptyCapitalRatio:mean(rows.map(r=>r.s.capitalDefense.emptyRatio)),meanLocalCapitalPopulation:mean(rows.map(r=>r.s.capitalDefense.meanLocal)),recapture24:mean(rows.map(r=>r.s.recaptureWindows['24'].ratio??0)),maxCityTransfers:Math.max(...rows.map(r=>r.s.cumulativeTransfers.max)),meanDevastation:mean(rows.map(r=>r.s.meanDevastation)),allInvariantsValid:rows.every(({b})=>b.strictSaveValid&&['populationUnexplained','residentIdentityConflicts','duplicatePopulationIds','formationOwnershipConflicts'].every(k=>b[k]===0))};
}
function compare(base,candidate){
 const checks={identitiesPopulationAndSaves:candidate.allInvariantsValid,capturesAtLeast80Percent:candidate.captures>=base.captures*.8,promotionsAtLeast75Percent:candidate.promotions>=base.promotions*.75,activeStatesAtMost125Percent:candidate.meanActiveStates<=base.meanActiveStates*1.25,territoryDropAtMost8Points:candidate.meanMaxTerritoryShare>=base.meanMaxTerritoryShare-.08,emptyCapitalsIncreaseAtMost5Points:candidate.emptyCapitalRatio<=base.emptyCapitalRatio+.05,retakesIncreaseAtMost5Points:candidate.recapture24<=base.recapture24+.05,extremeTransfersBound:candidate.maxCityTransfers<=base.maxCityTransfers*1.25+2,politicalChurnBound:candidate.restorations+candidate.splits+candidate.militarySplits<=(base.restorations+base.splits+base.militarySplits)*1.25+2};
 return {pass:Object.values(checks).every(Boolean),checks,failed:Object.keys(checks).filter(k=>!checks[k]),baseline:base,candidate};
}
function stage2(name){
 const ws=read('siege-z16-'+name+'-stage2'),base=read('siege-z16-A-stage2');
 if(ws.length!==4||ws.some((w,i)=>w.seed!=='regional-'+(i+1)||w.years!==50))throw Error('Stage 2 must complete the same four 50-year worlds');
 return compare(stats(base,600),stats(ws,600));
}
function stage3(name){
 const ws=read('siege-z16-'+name+'-stage3'),old=read('siege-z14-A');if(ws.length!==8)throw Error('Stage 3 must complete eight predetermined worlds');
 const base=ws.map((w,i)=>{if(w.seed!=='regional-'+(i+1)||w.years!==(i<2?200:100))throw Error('Wrong seed or duration');return old.find(o=>o.seed===w.seed);});
 const hundred=compare(stats(base,1200),stats(ws,1200)),twoHundred=compare(stats(base.slice(0,2),2400),stats(ws.slice(0,2),2400));return {pass:hundred.pass&&twoHundred.pass,hundred,twoHundred};
}
function gate(name,level){try{return level===2?stage2(name):stage3(name);}catch(e){return {pass:false,error:e.message};}}
module.exports={gate};
if(require.main===module){
 const result={releasedSiegeFormula:false,releasedLightFormations:false,newWithdrawalHistoryEvents:false,baselineReuse:'z14 A long cohort; z15 full canonical/RNG fingerprints previously verified identical. Fresh z15 four-seed 50-year baseline used for stage 2.',stage2:Object.fromEntries(['P','Q','B','C'].map(n=>[n,gate(n,2)])),stage3:{P:gate('P',3)},audit:'P was expanded before active-state and territory screening was reviewed. Complete stage-2 review rejects it. All future stage-3/final launches now require these full gates. No final-tier or 500-year runs were performed.'};
 fs.writeFileSync(path.join(dir,'siege-z16-summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}
