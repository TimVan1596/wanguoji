import type User from '../../Components/User';
import type Team from '../../Components/Team';
import type Core from '../../Game/Core';
import type {MilitaryFormation,MilitaryPerson} from '../../Politics/MilitaryCommandRegistry';
import {siegeParticipants} from '../SiegeParticipants';
interface Registry {isAssigned(id:string):boolean;getPerson(id:string):MilitaryPerson|undefined;}
/** Experimental recruitment only. Population, movement and military identity remain production objects. */
export function recruitmentPool(team:Team,core:Core|undefined,registry:Registry,exclude?:User){
 return [...team.users].filter(u=>{const id=u.player?.logicalUnitId,e=id&&core?.logicalUnitRegistry.getEntry(id);return u!==exclude&&u.team===team&&!u.isDestroyed&&u.role==='NORMAL'&&!u.rulerId&&!u.player.rulerId&&u.player.active&&!u.player.parent&&!u.player.children?.length&&!!id&&!!e&&e.player===u.player&&e.state.alive&&e.state.userId===u.id&&e.state.factionId===team.name&&u.player.user===u&&u.player.team===team&&!registry.isAssigned(id);});
}
export function localRecruitmentReserves(team:Team,core:Core|undefined,registry:Registry){
 const result=new Set<User>(),pool=new Set(recruitmentPool(team,core,registry));
 for(const city of team.cities){const local=siegeParticipants(city,team,core,32,false).filter(u=>!registry.isAssigned(u.player.logicalUnitId!));
  const protectedCount=Math.max(0,(city===team.capitalCity?2:1)-local.filter(u=>!pool.has(u)).length);
  for(const u of local.filter(u=>pool.has(u)).sort((a,b)=>a.id-b.id).slice(0,protectedCount))result.add(u);
 }return result;
}
function position(u:User,core:Core){const e=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId!)!;return core.logicalGameplayAuthority?{x:e.state.logicalX,y:e.state.logicalY}:u.player;}
export function nearbyRecruitment(team:Team,core:Core|undefined,registry:Registry,center:{x:number;y:number},count:number,exclude?:User){
 if(!core)return [];const reserved=localRecruitmentReserves(team,core,registry);
 return recruitmentPool(team,core,registry,exclude).filter(u=>!reserved.has(u)).map(u=>({u,p:position(u,core)})).filter(({p})=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.hypot(p.x-center.x,p.y-center.y)<=96).sort((a,b)=>Math.hypot(a.p.x-center.x,a.p.y-center.y)-Math.hypot(b.p.x-center.x,b.p.y-center.y)||a.u.id-b.u.id).slice(0,count).map(v=>v.u);
}
export function initialLightMembers(user:User,core:Core|undefined,registry:Registry){
 if(!core||localRecruitmentReserves(user.team,core,registry).has(user)||!recruitmentPool(user.team,core,registry).includes(user))return [];
 const members=nearbyRecruitment(user.team,core,registry,position(user,core),1,user);return members.length?[user,...members]:[];
}
export function reinforceLightFormation(formation:MilitaryFormation,team:Team,core:Core|undefined,registry:Registry,month:number,exclude?:User){
 const person=registry.getPerson(formation.commanderPersonId),appointment=person?.appointments.find(a=>a.commandId===formation.commandId&&a.endMonth===undefined),commander=person&&team.getUserById(person.sourceUserId);
 if(!core||formation.status!=='ACTIVE'||person?.status!=='ACTIVE'||!commander?.matchesMilitaryLife(person)||commander===exclude||commander.isDestroyed)return;
 const office=appointment?.officeHistory?.filter(g=>g.month<=month).at(-1)?.office,limit=office==='SHANGJIANGJUN'?4:office==='JIANGJUN'?3:2;
 for(const u of nearbyRecruitment(team,core,registry,position(commander,core),Math.max(0,limit-formation.memberUnitIds.length),exclude))formation.memberUnitIds.push(u.player.logicalUnitId!);
}
