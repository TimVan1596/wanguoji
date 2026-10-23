const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),repo=process.cwd();
const label=process.env.WANGUOJI_VERIFY_LABEL||'z11',port=Number(process.env.WANGUOJI_VERIFY_PORT||5222);
const out=fs.openSync(path.join(require('node:os').tmpdir(),`wanguoji-person-core-${label}.log`),'w');
const cacheRoot=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'wanguoji-verification-'));
const config=path.join(cacheRoot,'vite.config.ts');
fs.writeFileSync(config,`import configure from ${JSON.stringify(path.join(repo,'vite.config'))};export default env=>({...configure(env),root:${JSON.stringify(repo)},optimizeDeps:{include:['react','react-dom','react-dom/client','react-dom/server']},cacheDir:${JSON.stringify(path.join(cacheRoot,'cache'))}});`);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config',config,'--host','127.0.0.1','--port',String(port),'--strictPort'],{windowsHide:true,stdio:['ignore',out,out]});
(async()=>{try{
 for(let n=0;n<100;n++){try{if((await fetch('http://127.0.0.1:'+port)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 for(const [suite,seed,years]of [['siege-battle','siege-defense-z10',0],['formation-management','royal-military-z11',0],['military-overlay','regional-1',0],['siege-turnover','regional-1',200],['royal-military','royal-military-z11',100],['siege-contest','siege-defense-z10',100],['military-secession','military-secession-z7',100],['resident-founder','resident-z6',100],['character-archive','archive-z10-500',500],['siege-defense','siege-defense-z10',100],['military-balance','regional-1',200]]){
  if(process.env.WANGUOJI_VERIFY_SUITES&&!process.env.WANGUOJI_VERIFY_SUITES.split(',').includes(suite))continue;
  const env={...process.env,WANGUOJI_CORE_URL:`http://127.0.0.1:${port}/?debug=1&avatarRenderer=plain`,WANGUOJI_CORE_SUITE:suite,WANGUOJI_CORE_SEEDS:process.env.WANGUOJI_VERIFY_SEEDS||process.env.WANGUOJI_VERIFY_SEED||seed,WANGUOJI_CORE_YEARS:process.env.WANGUOJI_VERIFY_YEARS||String(years),WANGUOJI_CORE_OUTPUT:path.join(repo,`scripts/testing/results/${suite}-${label}.json`)};
  delete env.ELECTRON_RUN_AS_NODE;delete env.WANGUOJI_CORE_LONG_SEEDS;
  await new Promise((resolve,reject)=>{const p=spawn(require('electron'),['scripts/testing/natural-core-runner.cjs'],{env,windowsHide:true,stdio:['ignore',out,out]});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(`${suite} exited ${code}`)));});
 }
}finally{server.kill();fs.closeSync(out);}})().catch(e=>{console.error(e);process.exitCode=1;});
