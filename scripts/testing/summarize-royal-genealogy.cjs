const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'results'),read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const baseline=read('royal-genealogy-z13-baseline.json'),candidate=read('royal-genealogy-z13-candidate.json');
const baseline500=read('royal-genealogy-z13-500-baseline.json'),candidate500=read('royal-genealogy-z13-500-candidate.json');
const seeds=Array.from({length:24},(_,i)=>'regional-'+(i+1));
for(const data of [baseline,candidate])if(data.length!==24||data.some((r,i)=>r.seed!==seeds[i]))throw Error('Missing or changed predetermined seed');
const paired=[];
function compare(a,b){
 if(a.length!==b.length)throw Error('Missing worlds');
 for(let i=0;i<a.length;i++){
  if(a[i].seed!==b[i].seed||a[i].checkpoints.length!==b[i].checkpoints.length)throw Error('Mismatched worlds');
  for(let j=0;j<a[i].checkpoints.length;j++){
   const x=a[i].checkpoints[j],y=b[i].checkpoints[j];
   const row={seed:a[i].seed,month:x.month,baselineCanonical:x.canonicalSha256,candidateCanonical:y.canonicalSha256,canonicalEqual:x.canonicalSha256===y.canonicalSha256,rngPositionEqual:x.worldRandomPosition===y.worldRandomPosition};
   if(x.month!==y.month||!row.canonicalEqual||!row.rngPositionEqual)throw Error('Read-only change altered canonical facts or RNG: '+JSON.stringify(row));
   const g=y.genealogyArchive;
   if(!g||g.royalMilitaryExpected!==g.royalMilitaryIncluded||g.duplicateNodes||g.birthConflicts||y.populationUnexplained||y.royalMilitary.identityConflicts||y.royalMilitary.duplicateActiveMembers||!y.strictSaveValid)throw Error('Identity or population invariant failed');
   paired.push(row);
  }
 }
}
compare(baseline,candidate);compare(baseline500,candidate500);
const sum=(rows,key)=>rows.reduce((n,r)=>n+(r[key]||0),0);
function group(worlds,month){const checkpoints=worlds.map(r=>r.checkpoints.find(c=>c.month===month));if(checkpoints.some(c=>!c))throw Error('Missing checkpoint');const rows=checkpoints.map(c=>c.genealogyArchive);return {worlds:worlds.length,month,nodes:sum(rows,'nodes'),royalMilitaryExpected:sum(rows,'royalMilitaryExpected'),royalMilitaryIncluded:sum(rows,'royalMilitaryIncluded'),duplicateNodes:sum(rows,'duplicateNodes'),birthConflicts:sum(rows,'birthConflicts'),populationUnexplained:sum(checkpoints,'populationUnexplained'),allSavesValid:checkpoints.every(c=>c.strictSaveValid)};}
const short=new Map();for(const w of [...candidate,...candidate500])for(const c of w.checkpoints)for(const a of c.genealogyArchive.shortAppointments){if(a.endEvents!==1)throw Error('Missing or duplicated military end event');short.set(w.seed+':'+a.commandId,{seed:w.seed,...a});}
const controlled=read('royal-genealogy-z13-core.json')[0];
const report={baselineHead:'4180762a0724c1f948bbcab1ca0461cece4bf687',appVersion:'v0.99931z13',packageVersion:'0.99.179',saveSchemaVersion:22,
 hundredYears:group(candidate,1200),twoHundredYears:group(candidate.slice(0,6),2400),fiveHundredYears:group(candidate500,6000),
 pairedCheckpoints:paired,allCanonicalFactsAndRngEqual:true,shortAppointments:[...short.values()],controlledCoreChecks:controlled.checks.length,actualReactRendering:controlled.genealogyRender,controlledShortAppointmentAudits:controlled.shortAppointmentAudits,
 limits:['Node counts include political figures, verified military royalty and required recorded ancestors. Display inclusion never changes the legal candidate pool.','Size fixtures measure actual React deep/wide rendering, not a second simulator. Natural-world metrics use the real Core/Phaser path.','Performance timings and heap deltas depend on load and garbage collection; Chrome visual acceptance remains pending.']};
fs.writeFileSync(path.join(root,'royal-genealogy-z13-summary.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({hundredYears:report.hundredYears,twoHundredYears:report.twoHundredYears,fiveHundredYears:report.fiveHundredYears,paired:paired.length,shortAppointments:report.shortAppointments},null,2));
