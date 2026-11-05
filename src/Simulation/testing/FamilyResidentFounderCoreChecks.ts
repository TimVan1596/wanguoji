import Factions from '../FactionRegistry';
import Dynasty from '../../Politics/Dynasty';
import Military from '../../Politics/MilitaryCommandRegistry';
import {assessPopularSupport} from '../PopularRebellionSupport';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {personAbilities,rulerAbilities} from '../../Politics/PersonAbilities';
/** Called after an actual natural population spawn, not an invented or renamed adult. */
export function checkFamilyResidentFounder(core:any,child:any,month:number,check:(v:unknown,s:string)=>void){
 const original=exportWorldSave(core),sourceId=child.team.name,id=child.id,born=child.bornMonth;
 try{
  const team=child.team,city=team.cities[0],member=Military.getFamilyMember(id,born)!.member;
  check(child.name===member.name&&!child.militaryPersonId,'real natural-entry civilian already has its one family name before political promotion');
  for(const c of team.cities)c.loyalty=0;city.devastation=100;
  for(const u of team.users){u.loyalty=u===child?0:10;if(u.role==='NORMAL'){u.player.setPosition(city.block.x+1,city.block.y+1);u.player.body.reset(u.player.x,u.player.y);}}
  check(assessPopularSupport(city,month).users[0]===child,'the actual family civilian is the first legally eligible local political founder');
  const before=exportWorldSave(core),count=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),name=child.name,ability=personAbilities({kind:'RESIDENT',sourceUserId:id,bornMonth:born}),create=()=>Factions.createRebelFaction({city,year:month,factionType:'REBEL'});
  const register=core.addRuntimeTeam;core.addRuntimeTeam=()=>false;try{check(!create(),'failed actual family founding is refused');}finally{core.addRuntimeTeam=register;}
  const rolled=exportWorldSave(core);rolled.worldRandom=structuredClone(before.worldRandom);const rollbackDiff=diffCanonicalWorldSave(before,rolled);if(!rollbackDiff.matched)console.error('Family founding rollback diff',JSON.stringify(rollbackDiff));check(rollbackDiff.matched,'failed family founding restores names, parents, dynasty and complete population; outer attempted founding draws retain the existing RNG boundary');
  const polity=create();check(polity,'actual family civilian can found a polity through the normal city transaction');if(!polity)throw Error("family founding failed");
  const ruler=Dynasty.getCurrentRuler(polity.name)!,identity=ruler.residentIdentity!,actual=polity.rulerUser!;
  check(actual===child&&actual.name===name&&ruler.houseName.replace(/氏$/,'')+ruler.givenName===name&&identity.personalName===name&&identity.nameSource==='FAMILY_ENTRY','family, original User and royal archive keep the identical complete name and frozen natural-entry source');
  check(identity.sourceUserId===id&&ruler.bornYear===born&&Military.getFamilyMember(id,born)!.member.parentMemberId===member.parentMemberId&&core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===count,'real founding preserves the original birthday, parent and world population');
  check(JSON.stringify(rulerAbilities(ruler,Military.getPeople()))===JSON.stringify(ability),'ordinary family founder keeps the same personal abilities');
  const save=exportWorldSave(core);check(validateWorldSave(save).valid,'family resident founding has a strict valid save');
  for(const mutate of [(r:any)=>r.givenName='伪名',(r:any)=>r.residentIdentity.personalName='伪名',(r:any)=>r.residentIdentity.nameSource='POLITICAL_ENTRY']){const bad=structuredClone(save),r=(bad.dynasties.find(d=>d.factionId===polity.name)!.rulers as any[]).find(r=>r.rulerId===ruler.id);mutate(r);check(!validateWorldSave(bad).valid,'strict save rejects a renamed family founder or forged source');}
  hydrateWorldSave(core,structuredClone(save));check(diffCanonicalWorldSave(save,exportWorldSave(core)).matched,'same-name family founder survives strict hydration without new historical identities');
 }finally{hydrateWorldSave(core,structuredClone(original));}
 check(core.teams.find((t:any)=>t.name===sourceId).getUserById(id).name===Military.getFamilyMember(id,born)!.member.name,'isolated founding check restores the actual original civilian');
}
