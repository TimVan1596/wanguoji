// Read actual Core snapshots; this script never simulates or repairs a world.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function audit(file){
 const s=JSON.parse(fs.readFileSync(file,'utf8'))[0].snapshot,r=s.registries.militaryCommandRegistry;
 const members=new Map((r.families??[]).flatMap(h=>h.members.map(m=>[`${m.sourceUserId}:${m.bornMonth}`,m]))),people=new Map(r.people.map(p=>[p.personId,p])),conflicts=[],links=[];
 for(const d of s.dynasties)for(const king of d.rulers){
  const i=king.residentIdentity,m=i&&members.get(`${i.sourceUserId}:${i.bornMonth}`),name=king.houseName.replace(/氏$/,'')+king.givenName;
  if(i){
   if(s.saveSchemaVersion>=50&&i.personalName!==name)conflicts.push({kind:'frozen-name',id:king.rulerId});
   if(m){links.push({memberId:m.memberId,rulerId:king.rulerId,familyName:m.name,royalName:name,military:!!i.military,entryMonth:m.enteredMonth,foundingMonth:i.foundedMonth});if(m.name!==name)conflicts.push({kind:'family-royal',id:m.memberId});}
   const p=i.military&&people.get(i.military.personId);if(p&&p.personalName!==name)conflicts.push({kind:'military-royal',id:p.personId});
  }
 }
 for(const p of r.people){const m=members.get(`${p.sourceUserId}:${p.bornMonth}`);if(m&&m.name!==p.personalName)conflicts.push({kind:'family-military',id:p.personId});}
 const ids=s.worldHistory.events.map(e=>e.id),userIds=s.users.map(u=>u.userId),hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 return {file,sha256:hash,month:s.world.worldMonth,schema:s.saveSchemaVersion,population:s.users.length,factions:s.factions.length,families:(r.families??[]).length,members:[...members].length,military:r.people.length,residentFounders:s.dynasties.flatMap(d=>d.rulers).filter(k=>k.residentIdentity).length,familyFounderLinks:links,conflicts,duplicateUsers:userIds.length-new Set(userIds).size,duplicateHistory:ids.length-new Set(ids).size};
}
const dirs=process.argv.slice(2),report=dirs.map(dir=>({dir,worlds:fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort().map(f=>audit(path.join(dir,f)))}));
process.stdout.write(JSON.stringify(report,null,2)+'\n');
