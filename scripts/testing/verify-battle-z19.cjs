// Freeze the real working production source once: no hot reloads, candidates or alternative simulator.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn,execFileSync}=require('node:child_process');
const label=process.env.WANGUOJI_COHORT_LABEL||'z19';
const repo=process.cwd(),root=fs.mkdtempSync(path.join(os.tmpdir(),'wanguoji-battle-'+label+'-')),port=Number(process.env.WANGUOJI_COHORT_PORT||5230);
const ref=process.env.WANGUOJI_COHORT_REF;
if(ref){
 const tar=fs.openSync(path.join(root,'source.tar'),'w');try{execFileSync('git',['archive',ref,'src','public','index.html','vite.config.ts','tsconfig.json','package.json','desktop/DesktopSecurity.ts'],{cwd:repo,stdio:['ignore',tar,'pipe']});}finally{fs.closeSync(tar);}execFileSync('tar',['-xf',path.join(root,'source.tar'),'-C',root]);
 // Only read-only sampling overlays; the old simulation modules remain byte-for-byte at ref.
 for(const name of ['MilitaryBalanceHarness.ts','MilitaryPromotionDiagnostics.ts','MilitaryNobilityDiagnostics.ts'])fs.copyFileSync(path.join(repo,'src/Simulation/testing',name),path.join(root,'src/Simulation/testing',name));
}else{
 for(const name of ['src','public','index.html','vite.config.ts','tsconfig.json','package.json'])fs.cpSync(path.join(repo,name),path.join(root,name),{recursive:true});
 fs.mkdirSync(path.join(root,'desktop'));fs.copyFileSync(path.join(repo,'desktop/DesktopSecurity.ts'),path.join(root,'desktop/DesktopSecurity.ts'));
}
if(process.env.WANGUOJI_NOBLE_POLITICS==='0'){const p=path.join(root,'src/Politics/MilitaryPoliticalInfluence.ts');const s=fs.readFileSync(p,'utf8');if(!s.includes('ENABLE_NOBILITY_POLITICAL_WEIGHT = true'))throw Error('Missing political policy switch');fs.writeFileSync(p,s.replace('ENABLE_NOBILITY_POLITICAL_WEIGHT = true','ENABLE_NOBILITY_POLITICAL_WEIGHT = false'));}
fs.symlinkSync(path.join(repo,'node_modules'),path.join(root,'node_modules'),'dir');
const source=[];function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())scan(p);else if(/\.tsx?$/.test(p)&&!p.includes('.test.')&&!p.includes('/testing/'))source.push(p);}}scan(path.join(root,'src'));
const hash=crypto.createHash('sha256');for(const p of source.sort()){hash.update(path.relative(root,p));hash.update(fs.readFileSync(p));}
const years=process.argv.includes('--50')?50:100;
const seeds=Array.from({length:years===50?4:(['z20','z21','z22'].includes(label)?8:16)},(_,i)=>'regional-'+(i+1)),out=path.join(repo,`scripts/testing/results/military-balance-${label}-final${years}.json`);
const manifest=path.join(repo,`scripts/testing/results/battle-${label}-source${years===50?'50':''}.json`),productionSha256=hash.digest('hex');
if(fs.existsSync(out)){const prior=JSON.parse(fs.readFileSync(manifest));if(prior.productionSha256!==productionSha256)throw Error('Cannot resume results from different production source');}
fs.writeFileSync(manifest,JSON.stringify({productionSha256,seeds,years,noblePoliticalWeight:process.env.WANGUOJI_NOBLE_POLITICS!=='0',scope:years===50?'real frozen production Core; original four paired seeds; no candidate rule patches':'real frozen production Core; original four + twelve additional fixed seeds; no candidate rule patches'},null,2));
fs.writeFileSync(path.join(root,'frozen.vite.config.ts'),"import configure from './vite.config';export default env=>{const c=configure(env);return {...c,optimizeDeps:{include:['react','react-dom','react-dom/client','react-dom/server']},server:{...c.server,hmr:false,watch:{ignored:['**/*']}},cacheDir:'.vite-battle-z19'}};");
const log=fs.openSync(path.join(os.tmpdir(),`battle-${label}-frozen.log`),'w'),server=spawn(process.execPath,[path.join(repo,'node_modules/vite/bin/vite.js'),'--config',path.join(root,'frozen.vite.config.ts'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:['ignore',log,log]});
(async()=>{try{
 let ready=false;for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error('Frozen Vite stopped');try{if((await fetch('http://127.0.0.1:'+port)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}if(!ready)throw Error('Frozen server did not start');
 const env={...process.env,WANGUOJI_CORE_URL:`http://127.0.0.1:${port}/?debug=1&avatarRenderer=plain`,WANGUOJI_CORE_SUITE:'military-balance',WANGUOJI_CORE_SEEDS:seeds.join(','),WANGUOJI_CORE_RESUME:'1',WANGUOJI_CORE_YEARS:String(years),WANGUOJI_CORE_OUTPUT:out};delete env.ELECTRON_RUN_AS_NODE;delete env.WANGUOJI_CORE_LONG_SEEDS;
 await new Promise((resolve,reject)=>{const p=spawn(require('electron'),[path.join(repo,'scripts/testing/natural-core-runner.cjs')],{env,stdio:['ignore',log,log]});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error('Frozen battle cohort failed: '+code)));});
}finally{server.kill();fs.closeSync(log);}})().catch(e=>{console.error(e);process.exitCode=1;});
