// Read-only summary of the predetermined production-Core matrix; never creates or selects worlds.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.argv[2]??'/tmp';
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const optional=name=>fs.existsSync(path.join(root,name))?read(name):undefined;
function phase(name){return optional(name)?.map(r=>({...r,rows:r.rows.map(row=>({...row,phases:Object.fromEntries(Object.entries(row.phases).filter(([key])=>['total fixed/month step','MilitaryCommandRegistry.update','DynastyRegistry.update','Civil administration','Family household births and life','Family noble succession','Royal noble succession'].some(p=>key===p||key===p+'/January'||key===p+'/ordinary')))}))}));}
function stats(s,c){
 const terms=s.registries.civilAdministration.terms,people=s.registries.militaryCommandRegistry.people,families=s.registries.militaryCommandRegistry.families??[],events=s.worldHistory.events,rulers=s.dynasties.flatMap(d=>d.rulers),acts=families.flatMap(f=>(f.nobleSuccession??[]).map(a=>({...a,originFactionId:f.factionId}))),lost=terms.filter(t=>t.endReason==='CITY_LOST');
 const unique=rows=>new Set(rows.map(x=>x.personId)).size;
 const civilGrants=people.flatMap(p=>p.nobilityHistory??[]).filter(g=>g.basis==='CIVIL');
 return {month:s.world.worldMonth,sha256:sha(s),rng:s.worldRandom,population:s.users.length,events:events.length,rulers:rulers.length,
  civil:{people:unique(terms),appointments:terms.length,promotions:terms.filter(t=>t.promotion).length,transfers:terms.filter(t=>t.transfer).length,lostTerms:lost.length,lostPeople:unique(lost),reappointedAfterLoss:unique(terms.filter(t=>lost.some(old=>old.personId===t.personId&&old.factionId===t.factionId&&old.endMonth<=t.startMonth&&old.assignmentId!==t.assignmentId))),civilToMilitary:unique(people.filter(p=>p.appointments.some(a=>terms.some(t=>t.personId===p.personId&&t.endMonth!==undefined&&t.endMonth<=a.startMonth)))),militaryToCivil:unique(terms.filter(t=>people.some(p=>p.personId===t.personId&&p.appointments.some(a=>a.endMonth!==undefined&&a.endMonth<=t.startMonth)))),peerages:civilGrants.length,peeragesByRank:Object.fromEntries(['NAN','ZI','BO','HOU','GONG'].map(rank=>[rank,civilGrants.filter(g=>g.rank===rank).length])),loyaltyRecovered:terms.reduce((n,t)=>n+t.loyaltyRecovered,0),devastationRecovered:terms.reduce((n,t)=>n+t.devastationRecovered,0)},
  titles:{newPeriods:acts.filter(a=>a.kind==='STARTED').length,crossCountryPeriods:acts.filter(a=>a.kind==='STARTED'&&a.factionId!==a.originFactionId).length,successions:acts.filter(a=>a.kind==='SUCCEEDED').length,closureReasons:Object.fromEntries([...new Set(acts.filter(a=>a.kind==='ENDED').map(a=>a.reason))].map(reason=>[reason,acts.filter(a=>a.kind==='ENDED'&&a.reason===reason).length])),civilSourcedSuccessions:acts.filter(a=>a.kind==='SUCCEEDED'&&civilGrants.some(g=>g.eventId===a.sourceGrantEventId)).length},
  succession:{total:events.filter(e=>e.type==='ruler-succession').length,lawfulHouse:events.filter(e=>e.type==='ruler-succession'&&!['NEW_HOUSE','USURPER','LEADER_SUCCESSOR'].includes(e.metadata?.relationType)).length,unrelatedContinuations:rulers.filter(r=>r.relationType==='NEW_HOUSE').length,existingPoliticalContinuations:rulers.filter(r=>r.residentIdentity?.succession).length,civilContinuations:rulers.filter(r=>r.residentIdentity?.succession?.candidate.source==='CIVIL').length,usurpations:events.filter(e=>e.type==='dynasty-usurped').length,realMilitaryUsurpers:rulers.filter(r=>r.militaryUsurperIdentity).length},
  families:families.length,familyMembers:families.reduce((n,f)=>n+f.members.length,0),militaryPeople:people.filter(p=>p.appointments.length).length,activeCommands:s.registries.militaryCommandRegistry.formations.filter(f=>f.status==='ACTIVE').length,captures:events.filter(e=>['city-captured','city-recovered','capital-fallen'].includes(e.type)).length,saveBytes:Buffer.byteLength(JSON.stringify(s)),strictSaveValid:c.strictSaveValid,conflicts:{population:c.duplicatePopulationIds,formations:c.formationOwnershipConflicts,residents:c.residentIdentityConflicts}};
}
const worlds=[];
for(const kind of ['cohort','long']){
 const runs=read(`beta68-publish-${kind}.json`),before=read(`beta67-after-${kind}.json`);
 for(const r of runs){const b=before.find(b=>b.seed===r.seed&&b.years===r.years);if(!b)throw Error('Baseline seed/duration changed');
  for(const c of r.checkpoints){if(![1200,2400,3600,6000].includes(c.month)||kind==='long'&&c.month<3600)continue;
   const file=`${r.seed}-${c.month/12}.json`,s=read(`beta68-publish-${kind==='long'?'long-':''}snapshots/${file}`)[0].snapshot,old=read(`beta67-after-${kind==='long'?'long-':''}snapshots/${file}`)[0].snapshot;
   if(s.saveSchemaVersion!==64||old.saveSchemaVersion!==63||!c.strictSaveValid||!r.continuation)throw Error('Missing real strict save/continuation evidence');
   worlds.push({seed:r.seed,years:c.month/12,before:stats(old,b.checkpoints.find(x=>x.month===c.month)),after:stats(s,c),continuation:r.continuation});
  }
 }
}
if(worlds.length!==14)throw Error('Incomplete fixed matrix');
const maximal=[...new Map([...worlds].sort((a,b)=>a.years-b.years).map(w=>[w.seed,w])).values()];
const examples=[];
for(const w of maximal){const file=`${w.seed}-${w.years}.json`,s=read(`beta68-publish-${w.years>200?'long-':''}snapshots/${file}`)[0].snapshot;
 for(const type of ['civil-governor-appointed','family-title-started','family-title-succeeded','ruler-succession']){
  const e=s.worldHistory.events.find(e=>e.type===type&&(type==='civil-governor-appointed'?typeof e.metadata?.term==='string'&&JSON.parse(e.metadata.term).transfer:type==='ruler-succession'?e.metadata?.lawfulPoliticalSuccession:true));
  if(e)examples.push({seed:w.seed,kind:type,eventId:e.id,month:e.monthIndex??e.year,text:e.title,description:e.description});
 }
}
const report={version:'0.100.0-beta.68',worldSave:64,baseline:'e99314db5c581f44d2dc19fd0737a49957c00064',matrix:'regional-1..8 at100; first four at200; regional-1 at300/500. Eight independent seeds; checkpoints are overlapping prefixes, not independent events.',rules:'New political title authorities, lawful political continuation and civil mobility intentionally change later state/RNG. UI/reading projections do not change raw history or authoritative decisions.',worlds,maximalIndependentPrefixes:maximal.map(w=>({seed:w.seed,years:w.years,after:w.after})),naturalExamples:examples,
 strictSnapshotAudit:optional('beta68-strict-final.json'),
 core:{civil:optional('beta68-publish-civil-core.json')?.map(r=>({seed:r.seed,checks:r.checks})),military:optional('beta68-nobility-core.json')?.map(r=>({seed:r.seed,count:r.checks.length,proofs:r.checks.filter(s=>/foreign|cross-country|GONG to HOU|civil|rollback|rolls back/i.test(s)).map(s=>s.split(': {')[0])}))},
 performance:{before:phase('beta68-phase-before.json'),afterBeforeIndex:phase('beta68-phase-after.json'),after:phase('beta68-phase-indexed.json'),royalPlannerOracle:optional('beta68-royal-oracle.json'),save300:optional('beta68-save300.json'),save500:optional('beta68-save500.json')},
 limitations:['Original Ma Zhixuan/Lin Zongyi user saves were not supplied: directed Core is same-class production evidence, not exact natural-life replay.','Natural and directed evidence are separate. No probability was lowered to obtain rare events.','One active main family title period is retained; existing graph is not physically deleted or duplicated.','Baseline data are beta.67 native fixed-seed DTOs; strict baseline timing uses isolated e99314d with identical read-only P50 instrumentation. Different-version native worlds are not asserted equal.','Performance tests are real fixed-step Core, separate from rendering and manual 4x Electron acceptance.','Human visual acceptance remains pending.'],manualGate:'PENDING'};
fs.writeFileSync('scripts/testing/results/political-titles-beta68.json',JSON.stringify(report,(_k,v)=>typeof v==='number'&&!Number.isInteger(v)?Math.round(v*1000)/1000:v,2)+'\n');
console.log(JSON.stringify({worlds:worlds.length,independentSeeds:maximal.length,examples:examples.length}));
