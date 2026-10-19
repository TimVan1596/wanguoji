// Prepare an isolated REAL production source tree. Never edits the working tree or adds a gameplay switch.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
function patchMilitaryRegistry(source){
 const initial='.slice(0, MAX_FORMATION_UNITS);',annual='    this.advanceOffices(worldMonth,teams);',anchor='  private isUnitAssigned(';
 for(const marker of [initial,annual,anchor])if(source.split(marker).length!==2)throw new Error(`Baseline changed: ${marker}`);
 const replenish=`  private replenishOfficeFormations(teams:Team[]){
    for(const formation of this.formations.values()){
      if(formation.status!=="ACTIVE")continue;
      const person=this.people.get(formation.commanderPersonId),team=teams.find(t=>t.name===formation.factionId&&t.status==="ACTIVE");
      const appointment=person?.appointments.find(a=>a.commandId===formation.commandId&&a.endMonth===undefined);
      if(!person||!team||!appointment)continue;
      const office=appointment.officeHistory?.at(-1)?.office;
      const cap=office==="SHANGJIANGJUN"?6:office==="JIANGJUN"?4:2;
      const available=[...team.users].filter(u=>!u.isDestroyed&&u.team===team&&u.role==="NORMAL"&&!u.rulerId&&!u.player.rulerId&&u.player.active&&u.player.logicalUnitId&&!this.isUnitAssigned(u.player.logicalUnitId)).sort((a,b)=>a.id-b.id||a.name.localeCompare(b.name));
      formation.memberUnitIds.push(...available.slice(0,Math.max(0,cap-formation.memberUnitIds.length)).map(u=>u.player.logicalUnitId!));
    }
  }

`;
 return source.replace(initial,'.slice(0, 2);').replace(annual,annual+'\n    this.replenishOfficeFormations(teams);').replace(anchor,replenish+anchor);
}
function prepare(ref,variant,target){
 if(!['baseline','246'].includes(variant))throw new Error('variant must be baseline or 246');
 const root=path.resolve(__dirname,'../..'),dest=path.resolve(target);
 if(fs.existsSync(dest))throw new Error('Output must be a new directory');
 // git verifies the revision argument; archive is transferred directly to tar, without shell interpolation.
 const sha=cp.execFileSync('git',['rev-parse','--verify',`${ref}^{commit}`],{cwd:root,encoding:'utf8'}).trim();
 const archive=cp.execFileSync('git',['archive',sha,'src','desktop','public','index.html','vite.config.ts','package.json','tsconfig.json'],{cwd:root,maxBuffer:200*1024*1024});
 fs.mkdirSync(dest,{recursive:true});const untar=cp.spawnSync('tar',['-x','-C',dest],{input:archive});if(untar.status!==0)throw new Error(String(untar.stderr));
 fs.symlinkSync(path.join(root,'node_modules'),path.join(dest,'node_modules'),'dir');
 fs.copyFileSync(path.join(root,'src/Simulation/testing/MilitaryBalanceHarness.ts'),path.join(dest,'src/Simulation/testing/MilitaryBalanceHarness.ts'));
 if(variant==='246'){
   const file=path.join(dest,'src/Politics/MilitaryCommandRegistry.ts');fs.writeFileSync(file,patchMilitaryRegistry(fs.readFileSync(file,'utf8')));
 }
 return {sha,variant,directory:dest};
}
module.exports={patchMilitaryRegistry,prepare};
if(require.main===module){const [ref,variant,target]=process.argv.slice(2);if(!ref||!variant||!target)throw new Error('Usage: node scripts/testing/prepare-military-balance.cjs REF baseline|246 NEW_DIRECTORY');process.stdout.write(JSON.stringify(prepare(ref,variant,target))+'\n');}
