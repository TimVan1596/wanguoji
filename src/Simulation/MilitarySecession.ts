import Game from "../Game/Game";
import Military from "../Politics/MilitaryCommandRegistry";
import type User from "../Components/User";
import type City from "../Components/City";
import {buildPopularDistricts} from "./PopularDistricts";
import {localPoliticalPressure} from "./PopularRebellionSupport";
import {splitEstablishedPersonalName} from "../Politics/NameCulture";

export interface MilitarySecessionEvidence {
 personId:string; commandId:string; sourceFactionId:string; sourceFactionName:string; personalName:string;
 office:string; worldMonth:number; cityId:string; originalMemberUnitIds:string[];
 participants:Array<{userId:number;name:string;bornMonth:number;unitId:string}>;
}
/** Source substitution within an already eligible split. No lottery, new opportunity or extra population. */
export function assessMilitarySecession(city:City,month:number):{users:User[];evidence:MilitarySecessionEvidence}|undefined{
 const core=Game.Core,owner=city.ownerTeam;if(!core?.map||!owner)return;
 const districts=buildPopularDistricts(owner,core.map,Game.BlockSize);
 const local=(u:User)=>{
  const p=u.player,id=p?.logicalUnitId,e=id?core.logicalUnitRegistry.getEntry(id):undefined,s=e?.state;
  if(!id||!e||e.player!==p||!s?.alive||s.userId!==u.id||s.factionId!==owner.name||s.unitId!==id||s.role!=="NORMAL"||s.rulerId||u.isDestroyed||u.role!=="NORMAL"||u.rulerId||u.historicalPersonId||u.team!==owner||p.user!==u||p.team!==owner||!p.active||p.role!=="NORMAL"||p.rulerId)return false;
  const x=core.logicalGameplayAuthority?s.logicalX:p.x,y=core.logicalGameplayAuthority?s.logicalY:p.y;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0)return false;
  const gx=Math.floor(x/Game.BlockSize),gy=Math.floor(y/Game.BlockSize);
  return core.map!.blocks[gx]?.[gy]?.team===owner&&districts.district.get(`${gx},${gy}`)===city.id&&u.loyalty-localPoliticalPressure(city,month)<50;
 };
 for(const candidate of Military.getPoliticalInfluence(owner,month,core.logicalUnitRegistry).candidates){
  const person=Military.getPerson(candidate.personId),formation=Military.getFormation(candidate.commandId);
  const commander=[...owner.users].find(u=>u.id===candidate.sourceUserId&&u.militaryPersonId===candidate.personId);
  if(!person||!formation||!commander||!commander.matchesMilitaryLife(person)||!local(commander)||!splitEstablishedPersonalName(person.personalName))continue;
  const office=Military.getCaptureOffice(formation.commandId,person.personId,owner.name,month);if(!office)continue;
  const followers=[...owner.users].filter(u=>u!==commander&&!u.militaryPersonId&&formation.memberUnitIds.includes(u.player.logicalUnitId??"")&&local(u))
   .sort((a,b)=>a.loyalty-b.loyalty||a.id-b.id||a.bornMonth-b.bornMonth).slice(0,Math.max(1,Math.floor((candidate.memberUnitIds.length-1)/2)));
  if(!followers.length)continue;
  const users=[commander,...followers];
  return {users,evidence:{personId:person.personId,commandId:formation.commandId,sourceFactionId:owner.name,sourceFactionName:owner.displayName,
   personalName:person.personalName,office,worldMonth:month,cityId:city.id,originalMemberUnitIds:[...candidate.memberUnitIds],
   participants:users.map(u=>({userId:u.id,name:u.name,bornMonth:u.bornMonth,unitId:u.player.logicalUnitId!}))}};
 }
 return undefined;
}
