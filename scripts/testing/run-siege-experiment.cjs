const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const manifest=JSON.parse(fs.readFileSync('siege-experiments.local','utf8')),repo=process.cwd();
const names=process.argv.slice(2);
const execute=(file,args,options)=>new Promise((resolve,reject)=>{const p=spawn(file,args,{windowsHide:true,...options});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error(`${file} exited ${code}`)));});
(async()=>{for(const name of names){
 const c=manifest.cases.find(c=>c.name===name);if(!c)throw new Error(`Unknown case ${name}`);
 const out=fs.openSync(`${name}-experiment.stdout.log`,'w'),err=fs.openSync(`${name}-experiment.stderr.log`,'w');
 const vite=spawn(process.execPath,[path.join(repo,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(c.port),'--strictPort'],{cwd:c.root,windowsHide:true,stdio:['ignore',out,err]});
 try{
  const url=`http://127.0.0.1:${c.port}`;
  for(let n=0;n<100;n++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  const env={...process.env,WANGUOJI_CORE_SUITE:'siege-turnover',WANGUOJI_CORE_URL:`${url}/?debug=1&avatarRenderer=plain`,
   WANGUOJI_CORE_SEEDS:process.env.WANGUOJI_CORE_SEEDS||Array.from({length:name==='baseline'?24:4},(_,i)=>`regional-${i+1}`).join(','),
   WANGUOJI_CORE_LONG_SEEDS:process.env.WANGUOJI_CORE_LONG_SEEDS||Array.from({length:name==='baseline'?6:2},(_,i)=>`regional-${i+1}`).join(','),
   WANGUOJI_CORE_OUTPUT:path.join(repo,`scripts/testing/results/siege-z9-${name}.json`)};
  delete env.ELECTRON_RUN_AS_NODE;
  await execute(path.join(repo,'node_modules/electron/dist/electron.exe'),[path.join(repo,'scripts/testing/natural-core-runner.cjs')],{cwd:repo,env,stdio:['ignore',out,err]});
 }finally{vite.kill();fs.closeSync(out);fs.closeSync(err);}
}})().catch(e=>{process.stderr.write(String(e.stack||e));process.exitCode=1;});
