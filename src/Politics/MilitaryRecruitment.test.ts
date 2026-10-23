import {expect,it} from 'vitest';
import {nearbyMilitaryRecruits} from './MilitaryRecruitment';
function fixture(){
 const team:any={name:'qin',users:new Set()},entries=new Map<string,any>();
 const add=(id:number,x:number)=>{const u:any={id,team,role:'NORMAL',player:{active:true,role:'NORMAL',logicalUnitId:'u'+id,x,y:0,team,children:[]}};u.player.user=u;team.users.add(u);entries.set('u'+id,{player:u.player,state:{unitId:'u'+id,userId:id,factionId:'qin',role:'NORMAL',alive:true,logicalX:x,logicalY:0}});return u;};
 const commander=add(1,0),near=add(2,32),edge=add(3,96),far=add(4,97);
 const context:any={registry:{getEntry:(id:string)=>entries.get(id)},logical:false};
 return {team,commander,near,edge,far,entries,context};
}
it('recruits only already assembled real bodies, preserves coordinates, and stops at the requested vacancy count',()=>{
 const f=fixture(),positions=[...f.team.users].map((u:any)=>[u.player.x,u.player.y]);
 expect(nearbyMilitaryRecruits(f.team,f.commander,()=>false,f.context,1)).toEqual([f.near]);
 expect(nearbyMilitaryRecruits(f.team,f.commander,()=>false,f.context,9)).toEqual([f.near,f.edge]);
 expect(nearbyMilitaryRecruits(f.team,f.commander,()=>false,f.context,0)).toEqual([]);
 expect([...f.team.users].map((u:any)=>[u.player.x,u.player.y])).toEqual(positions);
});
it.each(['dead','foreign','stale-player','user-mismatch','ruler','attached','assigned'])('refuses %s recruits rather than filling paper slots',reason=>{
 const f=fixture(),e=f.entries.get('u2');
 if(reason==='dead')e.state.alive=false;if(reason==='foreign')e.state.factionId='chu';if(reason==='stale-player')e.player={};if(reason==='user-mismatch')e.state.userId=999;if(reason==='ruler')f.near.rulerId='king';if(reason==='attached')f.near.player.parent={};
 const rows=nearbyMilitaryRecruits(f.team,f.commander,id=>reason==='assigned'&&id==='u2',f.context,9);
 expect(rows).not.toContain(f.near);expect(rows).toEqual([f.edge]);
});
it('uses the selected authority instead of a distant render position and refuses an invalid commander',()=>{
 const f=fixture();f.near.player.x=9999;
 expect(nearbyMilitaryRecruits(f.team,f.commander,()=>false,f.context,9)).toEqual([f.edge]);
 f.context.logical=true;expect(nearbyMilitaryRecruits(f.team,f.commander,()=>false,f.context,9)).toEqual([f.near,f.edge]);
 f.entries.get('u1').state.alive=false;expect(nearbyMilitaryRecruits(f.team,f.commander,()=>false,f.context,9)).toEqual([]);
});
