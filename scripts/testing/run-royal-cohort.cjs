// Real Core cohorts. Explicit frozen baseline or current tree, with identical read-only instrumentation.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,execFileSync}=require('node:child_process');
const repo=process.cwd(),baseline=process.argv.includes('--baseline'),label=baseline?'baseline':'candidate',port=baseline?5224:5223;
const log=fs.openSync(path.join(os.tmpdir(),`wanguoji-royal-${label}${process.env.WANGUOJI_COHORT_OUTPUT?"-recheck":""}.log`),'w');
let server;
(async()=>{try{
 if(baseline){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'wanguoji-z10-'));
  const archive=execFileSync('git',['archive',process.env.WANGUOJI_COHORT_BASELINE||'ecf5b6a168bafc4b5df000152f0b788c968e713e'],{maxBuffer:512*1024*1024});
  execFileSync('tar',['-x','-C',root],{input:archive});
  fs.symlinkSync(path.join(repo,'node_modules'),path.join(root,'node_modules'),'junction');
  // Identical read-only instrumentation observes both production versions.
  fs.copyFileSync('src/Simulation/testing/MilitaryBalanceHarness.ts',path.join(root,'src/Simulation/testing/MilitaryBalanceHarness.ts'));
  server=spawn(process.execPath,[path.join(repo,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:['ignore',log,log]});
 }
 for(let n=0;n<100;n++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 const env={...process.env,WANGUOJI_CORE_SUITE:'military-balance',WANGUOJI_CORE_URL:`http://127.0.0.1:${port}/?debug=1&avatarRenderer=plain`,WANGUOJI_CORE_SEEDS:process.env.WANGUOJI_CORE_SEEDS||Array.from({length:24},(_,i)=>`regional-${i+1}`).join(','),WANGUOJI_CORE_LONG_SEEDS:process.env.WANGUOJI_CORE_LONG_SEEDS||Array.from({length:6},(_,i)=>`regional-${i+1}`).join(','),WANGUOJI_CORE_YEARS:'100',WANGUOJI_CORE_LONG_YEARS:'200',WANGUOJI_CORE_OUTPUT:process.env.WANGUOJI_COHORT_OUTPUT||path.join(repo,`scripts/testing/results/royal-military-${label}.json`)};
 delete env.ELECTRON_RUN_AS_NODE;
 const electron=require('electron');
 await new Promise((resolve,reject)=>{const p=spawn(electron,['scripts/testing/natural-core-runner.cjs'],{env,stdio:['ignore',log,log]});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(`Core ${label} exited ${code}`)));});
}finally{server?.kill();fs.closeSync(log);}})().catch(e=>{console.error(e);process.exitCode=1;});
