// Read-only strict validation of the exact predetermined production snapshots.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path');
app.setPath('userData',fs.mkdtempSync(path.join(require('node:os').tmpdir(),'wanguoji-civil-audit-')));
app.whenReady().then(async()=>{
 try{
  const win=new BrowserWindow({show:false,webPreferences:{backgroundThrottling:false}});
  await win.loadURL(process.env.WANGUOJI_CORE_URL||'http://127.0.0.1:5471/?debug=1&avatarRenderer=plain');
  const results=[];
  for(const dir of process.argv.slice(2))for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()){
   const snapshot=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'))[0].snapshot;
   const result=await win.webContents.executeJavaScript(`(async()=>{const {validateWorldSave}=await import('/src/Persistence/WorldSaveValidator.ts');const s=${JSON.stringify(snapshot)},before=JSON.stringify(s),result=validateWorldSave(s);return {...result,unchanged:before===JSON.stringify(s)};})()`);
   results.push({file,...result});if(!result.valid||!result.unchanged)throw Error(JSON.stringify(results.at(-1)));
  }
  fs.writeFileSync(process.env.WANGUOJI_AUDIT_OUTPUT||'/tmp/beta67-strict-audit.json',JSON.stringify(results,null,2));console.log(JSON.stringify({snapshots:results.length,valid:true,unchanged:true}));win.destroy();app.exit(0);
 }catch(e){console.error(e.stack||e);app.exit(1);}
});
