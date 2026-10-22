// Only frozen production copies receive candidates. No release balance switch.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync,spawn}=require('node:child_process');
const repo=process.cwd(),name=process.argv[2]||'A',port=Number(process.env.Z16_PORT||5236),root=fs.mkdtempSync(path.join(os.tmpdir(),'wanguoji-z16-'+name+'-'));
if(!['A','P','Q','B','C'].includes(name))throw Error('Unknown candidate');
if(name!=='A'&&/stage3|final/.test(process.env.Z16_SUFFIX||'')){const {gate}=require('./summarize-siege-z16.cjs'),level=/final/.test(process.env.Z16_SUFFIX)?3:2,result=gate(name,level);if(!result.pass)throw Error('Previous-stage safety gate rejected '+name+': '+JSON.stringify(result.failed??result));}
execFileSync('tar',['-x','-C',root],{input:execFileSync('git',['archive','f22bd1c86da92a967a348d7c3b8e725331914d4b'],{maxBuffer:512*1024*1024})});fs.symlinkSync(path.join(repo,'node_modules'),path.join(root,'node_modules'),'junction');
const replace=(s,a,b)=>{if(!s.includes(a))throw Error('Missing anchor: '+a);return s.replace(a,b);};
const edit=(f,fn)=>{const p=path.join(root,f);fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));};
for(const f of ['SiegeContestCoreHarness.ts','SiegeTurnoverHarness.ts','MilitaryBalanceHarness.ts'])fs.copyFileSync(path.join(repo,'src/Simulation/testing',f),path.join(root,'src/Simulation/testing',f));
if(name!=='A')edit('src/Components/City.ts',s=>{
 s='import {siegeParticipants} from "../Simulation/SiegeParticipants";\n'+s;
 s=replace(s,'const mainAttacker = contacts.sort((a, b) => b.count - a.count)[0];',`const mainAttacker = contacts.map(c=>({...c,strength:siegeParticipants(this,c.team,Game.Core,Game.BlockSize,true).length})).filter(c=>c.strength>=2&&!c.team.isDie).sort((a,b)=>b.strength-a.strength||a.team.name.localeCompare(b.team.name))[0];`);
 s=replace(s,'    this.underSiege = Boolean(mainAttacker);','    if(this.attackingFactionId!==mainAttacker?.team.name)this.siegeDamageRemainder=0;\n    this.underSiege = Boolean(mainAttacker);');
 s=replace(s,'    if (\n      this.lastSiegeDevastationYear < 0 ||',`    const defenders=siegeParticipants(this,this.ownerTeam!,Game.Core,Game.BlockSize,false).length;
    const pressure=Math.min(1.5,(mainAttacker.strength-1)/(1+defenders/2));
    if(!shouldApplySiegeDamage(year,this.lastSiegeDamageYear,CITY_SIEGE_DAMAGE_INTERVAL_MONTHS))return;
    const raw=CITY_SIEGE_DAMAGE_PER_TICK*FactionEffects.getSiegeMultiplier(mainAttacker.team.name)*pressure+this.siegeDamageRemainder;
    const actualDamage=Math.floor(raw);this.siegeDamageRemainder=raw-actualDamage;this.lastSiegeDamageYear=year;
    if(actualDamage===0)return;
    if (\n      this.lastSiegeDevastationYear < 0 ||`);
 s=replace(s,'mainAttacker?.commandContributions?.slice()',`mainAttacker?.commandContributions?.filter(c=>{const f=MilitaryCommandRegistry.getFormation(c.commandId);return f?.status==="ACTIVE"&&f.factionId===mainAttacker.team.name&&f.commanderPersonId===c.commanderPersonId&&siegeParticipants(this,mainAttacker.team,Game.Core,Game.BlockSize,true).some(u=>f.memberUnitIds.includes(u.player.logicalUnitId??""));}).slice()`);
 if(name==='Q'){
  s=replace(s,'const mainAttacker = contacts.map',`const localDefenders=this.ownerTeam?siegeParticipants(this,this.ownerTeam,Game.Core,Game.BlockSize,false).length:0;
    const mainAttacker = contacts.map`);
  s=replace(s,'c.strength>=2&&!c.team.isDie','(c.strength>=2||c.strength===1&&localDefenders===0)&&!c.team.isDie');
  s=replace(s,'const pressure=Math.min(1.5,(mainAttacker.strength-1)/(1+defenders/2));','const pressure=mainAttacker.strength===1?.5:Math.min(1.5,(mainAttacker.strength-1)/(1+defenders/2));');
 }
 const start=s.indexOf('    if (\n      !shouldApplySiegeDamage('),end=s.indexOf('    this.defense -= siegeDamage;',start);
 if(start<0||end<0)throw Error('Missing damage block');s=s.slice(0,start)+'    const siegeDamage=actualDamage;\n'+s.slice(end);return s;
});
if(['B','C'].includes(name))edit('src/Politics/MilitaryCommandRegistry.ts',s=>{
 s='import Game from "../Game/Game";\nimport {siegeParticipants} from "../Simulation/SiegeParticipants";\n'+s;
 s=replace(s,'MAX_FORMATION_UNITS = 12','MAX_FORMATION_UNITS = 4');
 s=replace(s,'      const candidates = [...team.users]',`      const capital=team.capitalCity;
      const reserved=new Set(capital?siegeParticipants(capital,team,Game.Core,Game.BlockSize,false).filter(u=>u.role==="NORMAL"&&!u.rulerId&&!this.isUnitAssigned(u.player.logicalUnitId??"")).sort((a,b)=>a.id-b.id).slice(0,1):[]);
      const candidates = [...team.users]`);
 s=replace(s,'this.isEligible(user, worldMonth)).sort','this.isEligible(user, worldMonth)&&!reserved.has(user)).sort');
 s=replace(s,'user.player.logicalUnitId && user.role === "NORMAL"','!reserved.has(user) && user.player.logicalUnitId && user.role === "NORMAL"');
 s=replace(s,'availableUnits.slice(0, MAX_FORMATION_UNITS - 1)','availableUnits.slice(0, 1)');s=replace(s,'.slice(0, MAX_FORMATION_UNITS);','.slice(0, 2);');
 return replace(s,'if(grant)this.grantOffice(person,appointment,grant);',`if(grant)this.grantOffice(person,appointment,grant);
      const core=Game.Core,office=appointment.officeHistory?.at(-1)?.office,limit=${name==='B'?'4':'office==="SHANGJIANGJUN"?4:office==="JIANGJUN"?3:2'};
      const position=(u:any)=>{const e=core?.logicalUnitRegistry.getEntry(u.player.logicalUnitId);return core?.logicalGameplayAuthority?{x:e?.state.logicalX,y:e?.state.logicalY}:u.player;},center=position(user);
      if(core&&team)for(const u of [...team.users].sort((a,b)=>a.id-b.id)){
       if(formation.memberUnitIds.length>=limit)break;const id=u.player.logicalUnitId,e=id&&core.logicalUnitRegistry.getEntry(id);
       if(!id||!e||e.player!==u.player||e.state.userId!==u.id||e.state.factionId!==team.name||!e.state.alive||u.team!==team||u.isDestroyed||!u.player.active||u.player.parent||u.player.children?.length||u.role!=="NORMAL"||u.rulerId||this.isUnitAssigned(id))continue;
       const p=position(u);if(Math.hypot(p.x-center.x,p.y-center.y)>64)continue;
       const capital=team.capitalCity,locals=capital?siegeParticipants(capital,team,core,32,false).filter(v=>!this.isUnitAssigned(v.player.logicalUnitId??"")):[];
       if(locals.includes(u)&&locals.length<=1)continue;formation.memberUnitIds.push(id);
      }`);
});
const log=fs.openSync(path.join(os.tmpdir(),'siege-z16-'+name+'-'+port+'.log'),'w'),config=path.join(root,'z16.vite.config.ts');fs.writeFileSync(config,`import configure from './vite.config';export default env=>({...configure(env),optimizeDeps:{include:['react','react-dom','react-dom/client','react-dom/server']},cacheDir:'.vite-z16'});`);
const server=spawn(process.execPath,[path.join(repo,'node_modules/vite/bin/vite.js'),'--config',config,'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:['ignore',log,log]});
(async()=>{try{
 let ready=false;for(let n=0;n<150;n++){if(server.exitCode!==null)throw Error('Vite exited before ready');try{if((await fetch('http://127.0.0.1:'+port)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}if(!ready)throw Error('Vite not ready');
 const env={...process.env,Z14_CANDIDATE:name==='A'?'0':'1',Z16_CANDIDATE:name,WANGUOJI_CORE_URL:`http://127.0.0.1:${port}/?debug=1&avatarRenderer=plain`,WANGUOJI_CORE_SUITE:process.env.Z16_SUITE||'siege-contest',WANGUOJI_CORE_SEEDS:process.env.WANGUOJI_CORE_SEEDS||'siege-defense-z10',WANGUOJI_CORE_LONG_SEEDS:process.env.WANGUOJI_CORE_LONG_SEEDS||'none',WANGUOJI_CORE_OUTPUT:path.join(repo,'scripts/testing/results/siege-z16-'+name+(process.env.Z16_SUFFIX||'-controlled')+'.json')};delete env.ELECTRON_RUN_AS_NODE;
 await new Promise((resolve,reject)=>{const p=spawn(require('electron'),[path.join(repo,'scripts/testing/natural-core-runner.cjs')],{env,stdio:['ignore',log,log]});p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error('Core '+name+' failed '+c)));});
}finally{server.kill();fs.closeSync(log);}})().catch(e=>{console.error(e);process.exitCode=1;});
