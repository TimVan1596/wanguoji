// Freeze the real working production source once: no hot reloads, candidates or alternative simulator.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const repo=process.cwd(),root=fs.mkdtempSync(path.join(os.tmpdir(),'wanguoji-battle-z19-')),port=5230;
for(const name of ['src','public','index.html','vite.config.ts','tsconfig.json','package.json'])fs.cpSync(path.join(repo,name),path.join(root,name),{recursive:true});
fs.mkdirSync(path.join(root,'desktop'));fs.copyFileSync(path.join(repo,'desktop/DesktopSecurity.ts'),path.join(root,'desktop/DesktopSecurity.ts'));
fs.symlinkSync(path.join(repo,'node_modules'),path.join(root,'node_modules'),'dir');
const source=[];function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())scan(p);else if(/\.tsx?$/.test(p)&&!p.includes('.test.')&&!p.includes('/testing/'))source.push(p);}}scan(path.join(root,'src'));
const hash=crypto.createHash('sha256');for(const p of source.sort()){hash.update(path.relative(root,p));hash.update(fs.readFileSync(p));}
const seeds=Array.from({length:16},(_,i)=>'regional-'+(i+1)),out=path.join(repo,'scripts/testing/results/military-balance-z19-final100.json');
fs.writeFileSync(path.join(repo,'scripts/testing/results/battle-z19-source.json'),JSON.stringify({productionSha256:hash.digest('hex'),seeds,years:100,scope:'real frozen production Core; original four + twelve additional fixed seeds; no candidate rule patches'},null,2));
fs.writeFileSync(path.join(root,'frozen.vite.config.ts'),"import configure from './vite.config';export default env=>{const c=configure(env);return {...c,optimizeDeps:{include:['react','react-dom','react-dom/client','react-dom/server']},server:{...c.server,hmr:false,watch:{ignored:['**/*']}},cacheDir:'.vite-battle-z19'}};");
const log=fs.openSync(path.join(os.tmpdir(),'battle-z19-frozen.log'),'w'),server=spawn(process.execPath,[path.join(repo,'node_modules/vite/bin/vite.js'),'--config',path.join(root,'frozen.vite.config.ts'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:['ignore',log,log]});
(async()=>{try{
 let ready=false;for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error('Frozen Vite stopped');try{if((await fetch('http://127.0.0.1:'+port)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}if(!ready)throw Error('Frozen server did not start');
 const env={...process.env,WANGUOJI_CORE_URL:`http://127.0.0.1:${port}/?debug=1&avatarRenderer=plain`,WANGUOJI_CORE_SUITE:'military-balance',WANGUOJI_CORE_SEEDS:seeds.join(','),WANGUOJI_CORE_YEARS:'100',WANGUOJI_CORE_OUTPUT:out};delete env.ELECTRON_RUN_AS_NODE;delete env.WANGUOJI_CORE_LONG_SEEDS;
 await new Promise((resolve,reject)=>{const p=spawn(require('electron'),[path.join(repo,'scripts/testing/natural-core-runner.cjs')],{env,stdio:['ignore',log,log]});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error('Frozen battle cohort failed: '+code)));});
}finally{server.kill();fs.closeSync(log);}})().catch(e=>{console.error(e);process.exitCode=1;});
