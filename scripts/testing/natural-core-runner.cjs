// Launch an isolated Electron session for real Core simulation metrics; no visual acceptance or screenshots.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
app.setPath('userData',fs.mkdtempSync(require('node:path').join(require('node:os').tmpdir(),'wanguoji-core-')));
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 const results=[];
 try{
  const seeds=(process.env.WANGUOJI_CORE_SEEDS||'regional-1').split(',');
  if(process.env.WANGUOJI_CORE_RESUME==='1'&&process.env.WANGUOJI_CORE_OUTPUT&&fs.existsSync(process.env.WANGUOJI_CORE_OUTPUT)){
   const completed=JSON.parse(fs.readFileSync(process.env.WANGUOJI_CORE_OUTPUT,'utf8'));
   if(!Array.isArray(completed)||completed.some((r,i)=>r.seed!==seeds[i]||r.years!==((process.env.WANGUOJI_CORE_LONG_SEEDS||'').split(',').includes(r.seed)?Number(process.env.WANGUOJI_CORE_LONG_YEARS||200):Number(process.env.WANGUOJI_CORE_YEARS||100))))throw Error('Resume must preserve exact predetermined seed order and duration');
   results.push(...completed);
  }
  for(const seed of seeds){
   if(results.some(r=>r.seed===seed))continue;
   process.stderr.write(`[CoreTest] starting ${seed}\n`);
   const win=new BrowserWindow({show:false,webPreferences:{backgroundThrottling:false,partition:`natural-core-${seed}-${process.pid}`}});
   win.webContents.on('console-message',(_e,_l,message)=>{process.stderr.write(String(message)+'\n');});
   await win.loadURL(process.env.WANGUOJI_CORE_URL||'http://localhost:5197/?debug=1&avatarRenderer=plain');
   const years=(process.env.WANGUOJI_CORE_LONG_SEEDS||'').split(',').includes(seed)?Number(process.env.WANGUOJI_CORE_LONG_YEARS||200):Number(process.env.WANGUOJI_CORE_YEARS||100);
   const deposition=process.env.WANGUOJI_CORE_SUITE==='deposition';
   const secession=process.env.WANGUOJI_CORE_SUITE==='military-secession';
   const resident=process.env.WANGUOJI_CORE_SUITE==='resident-founder';
   const identity=process.env.WANGUOJI_CORE_SUITE==='rebel-military-identity';
   const archive=process.env.WANGUOJI_CORE_SUITE==='character-archive';
   const balance=process.env.WANGUOJI_CORE_SUITE==='military-balance';
   const turnover=process.env.WANGUOJI_CORE_SUITE==='siege-turnover';
   const military=process.env.WANGUOJI_CORE_SUITE==='military-overlay';
   const calibration=process.env.WANGUOJI_CORE_SUITE==='military-office-calibration';
   const invocation=deposition?`const h=await import('/src/Simulation/testing/DepositionCoreHarness.ts');return h.runDepositionCore(${JSON.stringify(seed)});`:secession?`const h=await import('/src/Simulation/testing/MilitarySecessionCoreHarness.tsx');return h.runMilitarySecessionCore(${JSON.stringify(seed)});`:resident?`const h=await import('/src/Simulation/testing/ResidentFounderCoreHarness.ts');return h.runResidentFounderCore(${JSON.stringify(seed)});`:identity?`const h=await import('/src/Simulation/testing/RebelMilitaryIdentityHarness.ts');return h.runRebelMilitaryIdentity(${JSON.stringify(seed)});`:archive?`const h=await import('/src/Simulation/testing/CharacterArchivePerformanceHarness.tsx');return h.runCharacterArchivePerformance(${JSON.stringify(seed)},${years});`:balance?`const h=await import('/src/Simulation/testing/MilitaryBalanceHarness.ts');return h.runMilitaryBalance(${JSON.stringify(seed)},${years},${process.env.WANGUOJI_CORE_INCLUDE_SNAPSHOT==='1'});`:calibration?`const h=await import('/src/Simulation/testing/MilitaryOfficeCalibrationHarness.ts');return h.runMilitaryOfficeCalibration(${JSON.stringify(seed)},${Number(process.env.WANGUOJI_CORE_YEARS||200)});`:military?`const h=await import('/src/Simulation/testing/MilitaryOverlayCoreHarness.ts');return h.runMilitaryOverlayCore(${JSON.stringify(seed)});`:`const h=await import('/src/Simulation/testing/NaturalCoreHarness.ts');return h.runNaturalCore(${JSON.stringify(seed)},${Number(process.env.WANGUOJI_CORE_YEARS||100)});`;
   process.stderr.write('[CoreTest] page loaded, invoking harness\n');
   const call=process.env.WANGUOJI_CORE_SUITE==='siege-contest'?`const h=await import('/src/Simulation/testing/SiegeContestCoreHarness.ts');return h.runSiegeContestCore(${JSON.stringify(seed)},${process.env.Z14_CANDIDATE==='1'});`:process.env.WANGUOJI_CORE_SUITE==='royal-military'?`const h=await import('/src/Simulation/testing/RoyalMilitaryCoreHarness.ts');return h.runRoyalMilitaryCore(${JSON.stringify(seed)});`:process.env.WANGUOJI_CORE_SUITE==='founder-life'?`const h=await import('/src/Simulation/testing/FounderLifeHarness.ts');return h.runFounderLife(${JSON.stringify(seed)},${years});`:process.env.WANGUOJI_CORE_SUITE==='siege-defense'?`const h=await import('/src/Simulation/testing/SiegeDefenseCoreHarness.ts');return h.runSiegeDefenseCore(${JSON.stringify(seed)});`:turnover?`const h=await import('/src/Simulation/testing/SiegeTurnoverHarness.ts');return h.runSiegeTurnover(${JSON.stringify(seed)},${years});`:invocation;
   const navigationFailure=new Promise((_,reject)=>win.webContents.on('did-start-navigation',(_event,_url,inPlace,mainFrame)=>{
    if(mainFrame&&!inPlace)reject(Error(`Test page navigated during ${seed}; rerun this predetermined seed after dependency optimization`));
   }));
   let result;
   try{result=await Promise.race([win.webContents.executeJavaScript(`(async()=>{${call}})()`),navigationFailure]);}
   catch(error){if(process.env.WANGUOJI_CORE_KEEP_FAILURES!=='1')throw error;result={seed,years,failed:true,error:String(error.stack||error)};}

   results.push(result);if(process.env.WANGUOJI_CORE_OUTPUT)fs.writeFileSync(process.env.WANGUOJI_CORE_OUTPUT,JSON.stringify(results,null,2));
   process.stdout.write(JSON.stringify(result)+'\n');win.destroy();
  }
  app.exit(results.some(r=>r.failed)?1:0);
 }catch(e){process.stderr.write(String(e.stack||e)+'\n');app.exit(1);}
});
