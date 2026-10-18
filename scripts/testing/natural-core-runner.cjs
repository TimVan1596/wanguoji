// Launch an isolated Electron session for real Core simulation metrics; no visual acceptance or screenshots.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
app.setPath('userData',fs.mkdtempSync('/tmp/wanguoji-core-'));
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.whenReady().then(async()=>{
 const results=[];
 try{
  const seeds=(process.env.WANGUOJI_CORE_SEEDS||'regional-1').split(',');
  for(const seed of seeds){
   const win=new BrowserWindow({show:false,webPreferences:{backgroundThrottling:false,partition:`natural-core-${seed}-${process.pid}`}});
   win.webContents.on('console-message',(_e,_l,message)=>{if(message.includes('Error'))process.stderr.write(message+'\n');});
   await win.loadURL(process.env.WANGUOJI_CORE_URL||'http://localhost:5197/?debug=1&avatarRenderer=plain');
   const result=await win.webContents.executeJavaScript(`(async()=>{const h=await import('/src/Simulation/testing/NaturalCoreHarness.ts');return h.runNaturalCore(${JSON.stringify(seed)},${Number(process.env.WANGUOJI_CORE_YEARS||100)});})()`);
   results.push(result);if(process.env.WANGUOJI_CORE_OUTPUT)fs.writeFileSync(process.env.WANGUOJI_CORE_OUTPUT,JSON.stringify(results,null,2));
   process.stdout.write(JSON.stringify(result)+'\n');win.destroy();
  }
  app.exit(0);
 }catch(e){process.stderr.write(String(e.stack||e)+'\n');app.exit(1);}
});
