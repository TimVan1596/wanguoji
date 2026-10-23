import type Team from '../../Components/Team';
/** Renderer-free positioned identities for unit fixtures. Never imported by gameplay. */
export function attachSiegeFixtureUnits(core:any,team:Team,x:number,y:number,count=4){
 const previous=core.logicalUnitRegistry,entries=new Map<string,any>();
 for(let n=0;n<count;n++){
  const id=900000+team.users.size,unitId=`fixture-assault-${team.name}-${id}`,u:any={id,name:'攻方'+id,bornMonth:-300,team,role:'NORMAL',isDestroyed:false};
  u.player={user:u,team,role:'NORMAL',active:true,logicalUnitId:unitId,x,y,children:[]};
  u.destroyUser=(_silent=false,context:any={})=>{const before=team.users.size;u.isDestroyed=true;u.player.active=false;team.users.delete(u);core.simulator?.recordPopulationMutation?.(team,before,team.users.size,context);return true;};team.users.add(u);
  entries.set(unitId,{player:u.player,state:{unitId,userId:id,factionId:team.name,role:'NORMAL',alive:true,logicalX:x,logicalY:y}});
 }
 core.logicalUnitRegistry={...previous,getEntry:(id:string)=>entries.get(id)??previous?.getEntry(id)};
}
