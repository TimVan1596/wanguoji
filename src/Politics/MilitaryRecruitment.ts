import type User from '../Components/User';
import type Team from '../Components/Team';
import type LogicalUnitRegistry from '../Simulation/LogicalUnitRegistry';
export interface MilitaryRecruitmentContext {registry:Pick<LogicalUnitRegistry,'getEntry'>;logical:boolean;}
/** Only already assembled real bodies may reinforce. Joining never changes position,
 * creates population, draws random numbers, or counts a distant body as present. */
export function nearbyMilitaryRecruits(team:Team,commander:User,assigned:(id:string)=>boolean,context:MilitaryRecruitmentContext,limit:number){
 const position=(u:User)=>{const id=u.player?.logicalUnitId,e=id&&context.registry.getEntry(id);
  if(!id||!e||!e.state.alive||e.player!==u.player||e.state.unitId!==id||e.state.userId!==u.id||e.state.factionId!==team.name||e.state.role!=='NORMAL'||e.state.rulerId||
    u.isDestroyed||u.team!==team||!team.users.has(u)||u.role!=='NORMAL'||u.rulerId||u.player.rulerId||!u.player.active||u.player.user!==u||u.player.team!==team||u.player.role!=='NORMAL'||u.player.parent||u.player.children?.length)return undefined;
  const p=context.logical?{x:e.state.logicalX,y:e.state.logicalY}:u.player;
  return Number.isFinite(p.x)&&Number.isFinite(p.y)?p:undefined;
 };
 const center=position(commander);if(!center||limit<=0)return [];
 return [...team.users].filter(u=>u!==commander&&u.player.logicalUnitId&&!assigned(u.player.logicalUnitId)).map(u=>({u,p:position(u)}))
  .filter((v):v is {u:User;p:{x:number;y:number}}=>!!v.p&&Math.hypot(v.p.x-center.x,v.p.y-center.y)<=96)
  .sort((a,b)=>Math.hypot(a.p.x-center.x,a.p.y-center.y)-Math.hypot(b.p.x-center.x,b.p.y-center.y)||a.u.id-b.u.id).slice(0,limit).map(v=>v.u);
}
