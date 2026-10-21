const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const repo=process.cwd(),baseline=process.argv.includes('--baseline'),port=baseline?5220:5221;
let root;
{
 root=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'wanguoji-founder-life-'));
 fs.cpSync('src',path.join(root,'src'),{recursive:true});
 fs.mkdirSync(path.join(root,'desktop'));fs.copyFileSync('desktop/DesktopSecurity.ts',path.join(root,'desktop/DesktopSecurity.ts'));
 for(const f of ['package.json','index.html','tsconfig.json','vite.config.ts'])fs.copyFileSync(f,path.join(root,f));
 for(const f of ['public','node_modules'])fs.symlinkSync(path.join(repo,f),path.join(root,f),'junction');
 if(baseline)for(const f of ['src/Politics/Dynasty.ts','src/Politics/RulerLifespanRules.ts'])fs.writeFileSync(path.join(root,f),require('node:child_process').execFileSync('git',['show',`32360f21fc269b6b90a19f1906ff6d8eb0bdd7bb:${f}`]));
 const p=path.join(root,'vite.config.ts');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('base: getViteBase(mode),','base: getViteBase(mode),\n cacheDir: ".vite-founder-cache",'));
 fs.writeFileSync(`founder-${baseline?'baseline':'candidate'}.local`,root);
}
const label=baseline?'baseline':'candidate',out=fs.openSync(`founder-${label}.log`,'w');
const server=spawn(process.execPath,[path.join(repo,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,windowsHide:true,stdio:['ignore',out,out]});
(async()=>{
 try{
  for(let n=0;n<100;n++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  const env={...process.env,WANGUOJI_CORE_SUITE:'founder-life',WANGUOJI_CORE_URL:`http://127.0.0.1:${port}/?debug=1&avatarRenderer=plain`,
   WANGUOJI_CORE_SEEDS:process.env.WANGUOJI_CORE_SEEDS||Array.from({length:24},(_,i)=>`regional-${i+1}`).join(','),
   WANGUOJI_CORE_LONG_SEEDS:process.env.WANGUOJI_CORE_LONG_SEEDS||Array.from({length:6},(_,i)=>`regional-${i+1}`).join(','),
   WANGUOJI_CORE_OUTPUT:path.join(repo,`scripts/testing/results/founder-life-${label}.json`)};
  delete env.ELECTRON_RUN_AS_NODE;
  await new Promise((resolve,reject)=>{const p=spawn(path.join(repo,'node_modules/electron/dist/electron.exe'),['scripts/testing/natural-core-runner.cjs'],{cwd:repo,env,windowsHide:true,stdio:['ignore',out,out]});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(`Core exited ${code}`)));});
 }finally{server.kill();fs.closeSync(out);}
})().catch(e=>{console.error(e);process.exitCode=1;});
