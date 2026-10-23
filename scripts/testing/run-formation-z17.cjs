// Candidate modifies a frozen real production checkout, never the release runtime.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync,spawn}=require('node:child_process');
const repo=process.cwd(),root=fs.mkdtempSync(path.join(os.tmpdir(),'wanguoji-z17-formation-')),port=5241;
if(process.env.WANGUOJI_CORE_YEARS||process.env.WANGUOJI_CORE_LONG_YEARS)throw Error('Controlled stage A only; no long simulation launch');
execFileSync('tar',['-x','-C',root],{input:execFileSync('git',['archive','d50efc99d90e7c872467c7cffca453771dd9d3ee'],{maxBuffer:512*1024*1024})});fs.symlinkSync(path.join(repo,'node_modules'),path.join(root,'node_modules'),'junction');
for(const f of ['MilitaryFormationCandidate.ts','FormationManagementCoreHarness.ts'])fs.writeFileSync(path.join(root,'src/Simulation/testing',f),execFileSync('git',['show','45268ea1a8496413c86a1d80a84200588a66d9f8:src/Simulation/testing/'+f]));
const replace=(s,a,b)=>{if(!s.includes(a))throw Error('Missing production anchor: '+a);return s.replace(a,b);};
const registry=path.join(root,'src/Politics/MilitaryCommandRegistry.ts');let s=fs.readFileSync(registry,'utf8');
s='import Game from "../Game/Game";\nimport {initialLightMembers,nearbyRecruitment,reinforceLightFormation} from "../Simulation/testing/MilitaryFormationCandidate";\n'+s;
s=replace(s,'MAX_FORMATION_UNITS = 12','MAX_FORMATION_UNITS = 4');
s=replace(s,'this.isEligible(user, worldMonth)).sort','this.isEligible(user, worldMonth)&&initialLightMembers(user,Game.Core,this).length===2).sort');
s=replace(s,'const royals = this.royalService?.candidates(team, worldMonth) ?? [];','const royals = (this.royalService?.candidates(team, worldMonth) ?? []).filter(()=>team.spawnBlock&&nearbyRecruitment(team,Game.Core,this,team.spawnBlock,1).length===1);');
s=replace(s,'availableUnits.slice(0, MAX_FORMATION_UNITS - 1)','nearbyRecruitment(team,Game.Core,this,team.spawnBlock!,1)');
s=replace(s,'const members = [candidate, ...availableUnits.filter(user => user !== candidate)].slice(0, MAX_FORMATION_UNITS);','const members = initialLightMembers(candidate,Game.Core,this);');
s=replace(s,'if(grant)this.grantOffice(person,appointment,grant);','if(grant)this.grantOffice(person,appointment,grant);\n      if(team)reinforceLightFormation(formation,team,Game.Core,this,month);');
s=replace(s,'if (formation.memberUnitIds.length < 2) this.endFormation(formation, worldMonth, "DISMISSED");','reinforceLightFormation(formation,team!,Game.Core,this,worldMonth);\n      if (formation.memberUnitIds.length < 2) this.endFormation(formation, worldMonth, "DISMISSED");');
// Transfer/death callbacks must exclude the departing body while it still belongs to its old Team.
const tailStart=s.indexOf('  onUserTransfer(');
s=s.slice(0,tailStart)+s.slice(tailStart).replaceAll('if (formation.memberUnitIds.length < 2) this.endFormation(formation, worldMonth, "DISMISSED");','reinforceLightFormation(formation,user.team,Game.Core,this,worldMonth,user);\n        if (formation.memberUnitIds.length < 2) this.endFormation(formation, worldMonth, "DISMISSED");');
fs.writeFileSync(registry,s);
const config=path.join(root,'z17.vite.config.ts');fs.writeFileSync(config,"import configure from './vite.config';export default env=>({...configure(env),optimizeDeps:{include:['react','react-dom','react-dom/client','react-dom/server']},cacheDir:'.vite-z17'});");
const log=fs.openSync(path.join(os.tmpdir(),'formation-z17.log'),'w'),server=spawn(process.execPath,[path.join(repo,'node_modules/vite/bin/vite.js'),'--config',config,'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:['ignore',log,log]});
(async()=>{try{let ready=false;for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error('Vite stopped');try{if((await fetch('http://127.0.0.1:'+port)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}if(!ready)throw Error('Vite not ready');
 const env={...process.env,WANGUOJI_CORE_URL:`http://127.0.0.1:${port}/?debug=1&avatarRenderer=plain`,WANGUOJI_CORE_SUITE:'formation-management',WANGUOJI_CORE_SEEDS:'royal-military-z11',WANGUOJI_CORE_OUTPUT:path.join(repo,'scripts/testing/results/formation-z17-controlled.json')};delete env.ELECTRON_RUN_AS_NODE;
 await new Promise((resolve,reject)=>{const p=spawn(require('electron'),[path.join(repo,'scripts/testing/natural-core-runner.cjs')],{env,stdio:['ignore',log,log]});p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error('Controlled formation candidate failed: '+c)));});
}finally{server.kill();fs.closeSync(log);}})().catch(e=>{console.error(e);process.exitCode=1;});
