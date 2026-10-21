// Frozen real production sources; no runtime balancing switches or second simulator.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const repo=process.cwd(),base=fs.mkdtempSync(path.join(os.tmpdir(),'wanguoji-z9-'));
const cases=['baseline','A','B','C','BC','R','BCR'];
for(const [i,name] of cases.entries()){
 const root=path.join(base,name);fs.mkdirSync(root,{recursive:true});
 fs.cpSync(path.join(repo,'src'),path.join(root,'src'),{recursive:true});
 fs.mkdirSync(path.join(root,'desktop'));fs.copyFileSync(path.join(repo,'desktop/DesktopSecurity.ts'),path.join(root,'desktop/DesktopSecurity.ts'));
 for(const f of ['package.json','index.html','tsconfig.json','vite.config.ts'])fs.copyFileSync(path.join(repo,f),path.join(root,f));
 for(const f of ['public','node_modules'])fs.symlinkSync(path.join(repo,f),path.join(root,f),'junction');
 const edit=(file,fn)=>{const p=path.join(root,file);fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));};
 edit('vite.config.ts',s=>s.replace('base: getViteBase(mode),','base: getViteBase(mode),\n cacheDir: ".vite-experiment-cache",'));
 if(name.includes('B'))edit('src/config/simulation.ts',s=>s.replace('CITY_CAPTURED_DEFENSE_RATIO = 0.35','CITY_CAPTURED_DEFENSE_RATIO = 0.5'));
 if(name.includes('C'))edit('src/Components/Team.ts',s=>s.replace('...ordered.filter(c => !local.has(c.user))','...(damageSource === "CITY_SIEGE" ? [] : ordered.filter(c => !local.has(c.user)))'));
 if(name.includes('R'))edit('src/Politics/MilitaryCommandRegistry.ts',s=>s.replace('.slice(0, MAX_FORMATION_UNITS);','.slice(0, 3);'));
 if(name==='A')edit('src/Components/City.ts',s=>{
  s='import {siegeParticipants} from "../Simulation/SiegeParticipants";\n'+s;
  s=s.replace('const mainAttacker = contacts.sort((a, b) => b.count - a.count)[0];','const forces=contacts.map(c=>({...c,strength:siegeParticipants(this,c.team,Game.Core,Game.BlockSize,true).length}));\n const mainAttacker=forces.filter(c=>c.strength>0).sort((a,b)=>b.strength-a.strength||a.team.name.localeCompare(b.team.name))[0];');
  s=s.replace('CITY_SIEGE_DAMAGE_PER_TICK *','CITY_SIEGE_DAMAGE_PER_TICK * (siegeParticipants(this,this.ownerTeam!,Game.Core,Game.BlockSize,false).length>=Math.max(2,mainAttacker.strength*2)?0.5:1) *');
  s=s.replace('const siegeDamage = Math.max(1, Math.floor(rawSiegeDamage));','const siegeDamage = Math.floor(rawSiegeDamage);');
  return s.replace('    this.defense -= siegeDamage;','    if(siegeDamage<=0)return;\n    this.defense -= siegeDamage;');
 });
}
const manifest={baselineHead:require('node:child_process').execSync('git rev-parse HEAD',{encoding:'utf8'}).trim(),base,cases:cases.map((name,i)=>({name,root:path.join(base,name),port:5200+i}))};
fs.writeFileSync('siege-experiments.local',JSON.stringify(manifest,null,2));process.stdout.write(JSON.stringify(manifest,null,2));
