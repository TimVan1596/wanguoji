// Candidates alter frozen production copies only; no release runtime switch or alternate simulator.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync,spawn}=require('node:child_process');
const repo=process.cwd(),name=process.argv[2]||'A',root=fs.mkdtempSync(path.join(os.tmpdir(),'wanguoji-z14-'+name+'-')),port=Number(process.env.Z14_PORT||5230);
const head='d4d75fdaae4736eb6f1a9d85992930dee53b8f33';
const edit=(f,fn)=>{const p=path.join(root,f);fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));};
const replace=(s,a,b)=>{if(!s.includes(a))throw Error('Missing production anchor: '+a);return s.replace(a,b);};
execFileSync('tar',['-x','-C',root],{input:execFileSync('git',['archive',head],{maxBuffer:512*1024*1024})});
fs.symlinkSync(path.join(repo,'node_modules'),path.join(root,'node_modules'),'junction');
for(const f of ['SiegeTurnoverHarness.ts','MilitaryBalanceHarness.ts'])fs.copyFileSync(path.join(repo,'src/Simulation/testing',f),path.join(root,'src/Simulation/testing',f));
if(name!=='A'){
 edit('src/Components/City.ts',s=>{
  s='import {siegeParticipants} from "../Simulation/SiegeParticipants";\n'+s;
  s=replace(s,'const mainAttacker = contacts.sort((a, b) => b.count - a.count)[0];',`const mainAttacker = contacts.map(c=>({...c, strength:siegeParticipants(this,c.team,Game.Core,Game.BlockSize,true).length})).filter(c=>c.strength>0&&!c.team.isDie).sort((a,b)=>b.strength-a.strength||a.team.name.localeCompare(b.team.name))[0];`);
  s=replace(s,'    const rawSiegeDamage =',`    const defenders=siegeParticipants(this,this.ownerTeam!,Game.Core,Game.BlockSize,false).length;
    const pressure=mainAttacker.strength<2||mainAttacker.strength*2<=defenders?0:Math.min(1.5,mainAttacker.strength/(defenders+1));
    if(pressure===0)return;
    const rawSiegeDamage =`);
  s=replace(s,'CITY_SIEGE_DAMAGE_PER_TICK *','CITY_SIEGE_DAMAGE_PER_TICK * pressure *');
  s=replace(s,'const siegeDamage = Math.max(1, Math.floor(rawSiegeDamage));','const siegeDamage = Math.floor(rawSiegeDamage);');
  return replace(s,'    this.defense -= siegeDamage;','    if(siegeDamage<=0)return;\n    this.defense -= siegeDamage;');
 });
}
if(name==='C')edit('src/Politics/MilitaryCommandRegistry.ts',s=>{
 s='import Game from "../Game/Game";\nimport {siegeParticipants} from "../Simulation/SiegeParticipants";\n'+s;
 s=replace(s,'      const candidates = [...team.users]',`      const capital=team.capitalCity;
      const reserved=new Set(capital?siegeParticipants(capital,team,Game.Core,Game.BlockSize,false).filter(u=>u.role==="NORMAL"&&!u.rulerId&&!this.isUnitAssigned(u.player.logicalUnitId??"")).sort((a,b)=>a.id-b.id).slice(0,2):[]);
      const candidates = [...team.users]`);
 s=replace(s,'this.isEligible(user, worldMonth)).sort','this.isEligible(user, worldMonth)&&!reserved.has(user)).sort');
 return replace(s,'user.player.logicalUnitId && user.role === "NORMAL"','!reserved.has(user) && user.player.logicalUnitId && user.role === "NORMAL"');
});
if(name==='B3')edit('src/Politics/MilitaryCommandRegistry.ts',s=>replace(s,'MAX_FORMATION_UNITS = 12','MAX_FORMATION_UNITS = 3'));
const config=path.join(root,'z14.vite.config.ts');fs.writeFileSync(config,`import configure from './vite.config';export default env=>({...configure(env),optimizeDeps:{include:['react','react-dom','react-dom/client','react-dom/server']},cacheDir:'.vite-z14'});`);
const log=fs.openSync(path.join(os.tmpdir(),'siege-z14-'+name+'-'+port+'.log'),'w');
const server=spawn(process.execPath,[path.join(repo,'node_modules/vite/bin/vite.js'),'--config',config,'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:['ignore',log,log]});
(async()=>{try{
 for(let n=0;n<150;n++){try{if((await fetch('http://127.0.0.1:'+port)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 const env={...process.env,WANGUOJI_CORE_URL:`http://127.0.0.1:${port}/?debug=1&avatarRenderer=plain`,WANGUOJI_CORE_SUITE:process.env.Z14_SUITE||'siege-turnover',WANGUOJI_CORE_SEEDS:process.env.WANGUOJI_CORE_SEEDS||Array.from({length:24},(_,i)=>'regional-'+(i+1)).join(','),WANGUOJI_CORE_LONG_SEEDS:process.env.WANGUOJI_CORE_LONG_SEEDS||Array.from({length:6},(_,i)=>'regional-'+(i+1)).join(','),WANGUOJI_CORE_OUTPUT:path.join(repo,'scripts/testing/results/siege-z14-'+name+(process.env.Z14_SUFFIX||'')+'.json')};delete env.ELECTRON_RUN_AS_NODE;
 await new Promise((resolve,reject)=>{const p=spawn(require('electron'),[path.join(repo,'scripts/testing/natural-core-runner.cjs')],{cwd:repo,env,stdio:['ignore',log,log]});p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error('Core '+name+' failed '+c)));});
}finally{server.kill();fs.closeSync(log);}})().catch(e=>{console.error(e);process.exitCode=1;});
