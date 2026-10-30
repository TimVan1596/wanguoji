import History from "../History/WorldHistory";
import {deriveMilitaryCareer} from "../Politics/MilitaryCareerEvidence";
import Game from "../Game/Game";
import Military from "../Politics/MilitaryCommandRegistry";
import type User from "../Components/User";
import type City from "../Components/City";
import {buildPopularDistricts} from "./PopularDistricts";
import {localPoliticalPressure} from "./PopularRebellionSupport";
import {splitEstablishedPersonalName} from "../Politics/NameCulture";

export interface LocalMilitaryOpportunity {
 chance:number;roll:number;lastRebellionMonth?:number;
}
export interface MilitarySecessionEvidence {
 entryKind:'EMPIRE_SPLIT'|'LOCAL_CRISIS';
 localCrisis?:{facts:import('./MilitaryLocalRules').MilitaryLocalCrisisFacts;reason:string;chance:number;roll:number;lastRebellionMonth?:number;sourceCityCount:number;activeFactionCount:number;supporterKind?:"RESIDENT"|"COMMAND_FOLLOWER";supporter:{userId:number;bornMonth:number;unitId:string;x:number;y:number;loyalty:number;positionSource:"PHASER"|"LOGICAL";districtCityId:string;ownedFactionId:string}};
 personId:string; commandId:string; sourceFactionId:string; sourceFactionName:string; personalName:string;
 office:string; serviceMonths:number; localCareerEventIds?:string[]; capturedEventIds:string[]; defenseEventIds?:string[]; worldMonth:number; cityId:string; originalMemberUnitIds:string[];
 participants:Array<{userId:number;name:string;bornMonth:number;loyalty?:number;unitId:string;x:number;y:number;positionSource:"PHASER"|"LOGICAL";districtCityId:string;ownedFactionId:string}>;
}
/** Source substitution within an already eligible split. No lottery, new opportunity or extra population. */
export function assessMilitarySecession(city:City,month:number, observe?:(reason:string)=>void):{users:User[];evidence:MilitarySecessionEvidence}|undefined{
 const core=Game.Core,owner=city.ownerTeam;if(!core?.map||!owner)return;
 const districts=buildPopularDistricts(owner,core.map,Game.BlockSize);
 const local=(u:User)=>{
  const p=u.player,id=p?.logicalUnitId,e=id?core.logicalUnitRegistry.getEntry(id):undefined,s=e?.state;
  if(!id||!e||e.player!==p||!s?.alive||s.userId!==u.id||s.factionId!==owner.name||s.unitId!==id||s.role!=="NORMAL"||s.rulerId||u.isDestroyed||u.role!=="NORMAL"||u.rulerId||u.historicalPersonId||u.team!==owner||p.parent||p.children?.length||u.slaveGroup?.npcs?.size||u.slaveGroup?.children?.size||p.user!==u||p.team!==owner||!p.active||p.role!=="NORMAL"||p.rulerId)return false;
  const x=core.logicalGameplayAuthority?s.logicalX:p.x,y=core.logicalGameplayAuthority?s.logicalY:p.y;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0)return false;
  const gx=Math.floor(x/Game.BlockSize),gy=Math.floor(y/Game.BlockSize);
  return core.map!.blocks[gx]?.[gy]?.team===owner&&districts.district.get(`${gx},${gy}`)===city.id&&u.loyalty<95&&u.loyalty-localPoliticalPressure(city,month)<75;
 };
 const influence=Military.getPoliticalInfluence(owner,month,core.logicalUnitRegistry,false,false,true);
 for(const b of influence.blocked)observe?.(b.reason);
 if(!influence.candidates.length)observe?.("NO_QUALIFIED_COMMAND");
 for(const candidate of influence.candidates){
  observe?.("VALID_MILITARY_COMMAND");
  const person=Military.getPerson(candidate.personId),formation=Military.getFormation(candidate.commandId);
  const commander=[...owner.users].find(u=>u.id===candidate.sourceUserId&&u.militaryPersonId===candidate.personId);
  if(!person||person.royalIdentity||!formation||!commander||!commander.matchesMilitaryLife(person)||!splitEstablishedPersonalName(person.personalName)){observe?.("IDENTITY_OR_ROYAL");continue;}
  observe?.("SERVING_COMMANDER");
  if(!local(commander)){observe?.("COMMANDER_NOT_LOCAL_OR_WILLING");continue;}
  if(formation.memberUnitIds.length!==candidate.memberUnitIds.length||formation.memberUnitIds.some(id=>!candidate.memberUnitIds.includes(id)))continue;
  observe?.("LOCAL_COMMANDER");
  const office=Military.getCaptureOffice(formation.commandId,person.personId,owner.name,month);if(!office)continue;
  const followers=[...owner.users].filter(u=>u!==commander&&!u.militaryPersonId&&formation.memberUnitIds.includes(u.player.logicalUnitId??"")&&local(u))
   .sort((a,b)=>a.loyalty-b.loyalty||a.id-b.id||a.bornMonth-b.bornMonth).slice(0,Math.max(1,Math.floor((candidate.memberUnitIds.length-1)/2)));
  if(!followers.length){observe?.("NO_LOCAL_FOLLOWERS");continue;}
  observe?.("QUALIFIED_LOCAL_PARTY");
  const users=[commander,...followers];
  return {users,evidence:{entryKind:'EMPIRE_SPLIT',personId:person.personId,commandId:formation.commandId,sourceFactionId:owner.name,sourceFactionName:owner.displayName,
   personalName:person.personalName,office,serviceMonths:candidate.serviceMonths,localCareerEventIds:deriveMilitaryCareer(person,Military.getFormations(),History.getEventsForFaction(owner.name),month).activities.filter(a=>a.factionId===owner.name).map(a=>a.eventId).sort(),...(candidate.defenseEventIds?{defenseEventIds:candidate.defenseEventIds}:{}),capturedEventIds:[...candidate.capturedEventIds],worldMonth:month,cityId:city.id,originalMemberUnitIds:[...candidate.memberUnitIds],
   participants:users.map(u=>{const s=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId!)!.state;return {userId:u.id,name:u.name,bornMonth:u.bornMonth,loyalty:u.loyalty,unitId:u.player.logicalUnitId!,
     x:core.logicalGameplayAuthority?s.logicalX:u.player.x,y:core.logicalGameplayAuthority?s.logicalY:u.player.y,positionSource:core.logicalGameplayAuthority?"LOGICAL":"PHASER",districtCityId:city.id,ownedFactionId:owner.name};})}};
 }
 return undefined;
}
