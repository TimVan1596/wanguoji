// Compare the optimized read-only planner against the actual frozen baseline module.
// No alternative simulator, forged world, visual acceptance or snapshot migration.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path');
app.setPath('userData',fs.mkdtempSync(path.join(require('node:os').tmpdir(),'wanguoji-royal-oracle-')));
app.whenReady().then(async()=>{
 const windows=[];try{
  for(const url of [process.env.WANGUOJI_BASELINE_URL||'http://127.0.0.1:5470/',process.env.WANGUOJI_CORE_URL||'http://127.0.0.1:5471/']){const w=new BrowserWindow({show:false,webPreferences:{backgroundThrottling:false}});windows.push(w);await w.loadURL(url);}
  const rows=[];
  for(const dir of process.argv.slice(2))for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()){
   const snapshot=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'))[0].snapshot;
   const code=`(async()=>{const {nextRoyalNobleAct}=await import('/src/Politics/RoyalNobility.ts');const {importRulerSave}=await import('/src/Persistence/RulerSaveProjection.ts');const s=${JSON.stringify(snapshot)},before=JSON.stringify(s),events=s.worldHistory.events,positions=new Map(events.map((e,i)=>[e.id,i])),people=s.registries.militaryCommandRegistry.people,results=[];
    for(const saved of s.dynasties){const d={...saved,rulers:saved.rulers.map(importRulerSave)},status=s.factions.find(f=>f.factionId===d.factionId)?.status,cases=[[s.world.worldMonth,events.length]];
     for(const act of d.royalNobility??[]){const i=positions.get(act.eventId);if(i!==undefined)cases.push([act.month,i],[act.month,i+1]);}
     for(const [month,limit]of cases){const prior=events.slice(0,limit),ids=new Set(prior.map(e=>e.id)),historical={...d,royalNobility:d.royalNobility?.filter(a=>ids.has(a.eventId))};results.push([d.factionId,month,limit,nextRoyalNobleAct(historical,people,prior,month,status)]);}
    }if(JSON.stringify(s)!==before)throw Error('Planner mutated authority');return results;})()`;
   const old=await windows[0].webContents.executeJavaScript(code),current=await windows[1].webContents.executeJavaScript(code);
   if(JSON.stringify(old)!==JSON.stringify(current))throw Error(`Royal planner differs: ${file}`);rows.push({file,cases:current.length,equal:true,unchanged:true});
  }
  fs.writeFileSync(process.env.WANGUOJI_AUDIT_OUTPUT||'/tmp/beta68-royal-oracle.json',JSON.stringify(rows,null,2));console.log(JSON.stringify({snapshots:rows.length,cases:rows.reduce((n,r)=>n+r.cases,0),equal:true,unchanged:true}));app.exit(0);
 }catch(error){console.error(error.stack||error);app.exit(1);}finally{for(const w of windows)if(!w.isDestroyed())w.destroy();}
});
