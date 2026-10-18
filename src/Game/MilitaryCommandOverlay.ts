import type Core from "./Core";
import Military from "../Politics/MilitaryCommandRegistry";
import Diplomacy from "../Politics/Diplomacy";
import Game from "./Game";

/** Presentation only. Registry identity is checked in both runtimes; positions follow runtime authority. */
export function resolveMilitaryCommandView(core:Core,commandId:string){
  const formation=Military.getFormation(commandId);
  if(formation?.status!=="ACTIVE")return undefined;
  const person=Military.getPerson(formation.commanderPersonId);
  const team=formation&&core.teams.find(t=>t.name===formation.factionId&&t.status==="ACTIVE");
  if(!person||person.status!=="ACTIVE"||person.factionId!==formation.factionId||!team)return undefined;
  const commander=[...team.users].find(u=>!u.isDestroyed&&u.id===person.sourceUserId&&u.militaryPersonId===person.personId);
  const month=core.simulator?.year??0;
  if(!commander?.matchesMilitaryLife(person)||!person.appointments.some(a=>a.commandId===commandId&&a.factionId===team.name&&a.startMonth<=month&&a.endMonth===undefined))return undefined;
  const members=[...new Set(formation.memberUnitIds)].flatMap(id=>{
    const e=core.logicalUnitRegistry.getEntry(id),p=e?.player,s=e?.state,u=p?.user;
    if(!s?.alive||!p?.active||p.logicalUnitId!==id||s.unitId!==id||s.factionId!==team.name||p.team!==team||
      !u||u.isDestroyed||u.team!==team||!team.users.has(u)||s.userId!==u.id||u.player!==p||s.role!=="NORMAL"||p.role!=="NORMAL"||u.role!=="NORMAL"||s.rulerId||p.rulerId||u.rulerId)return [];
    const x=core.logicalGameplayAuthority?s.logicalX:p.x,y=core.logicalGameplayAuthority?s.logicalY:p.y;
    return Number.isFinite(x)&&Number.isFinite(y)?[{unitId:id,x,y}]:[];
  });
  if(!members.length||!members.some(m=>m.unitId===commander.player.logicalUnitId))return undefined;
  const target=core.allCities.find(c=>c.id===formation.targetCityId&&!c.destroyed&&c.ownerFactionId!==team.name&&c.ownerTeam?.status==="ACTIVE"&&Diplomacy.canAttack(team.name,c.ownerFactionId,month));
  return {commandId,factionId:team.name,members,center:{x:members.reduce((n,m)=>n+m.x,0)/members.length,y:members.reduce((n,m)=>n+m.y,0)/members.length},
    target:target?{cityId:target.id,name:target.name,x:target.block.x+Game.BlockSize/2,y:target.block.y+Game.BlockSize/2}:undefined};
}

/** One reusable noninteractive Graphics object, owned by one scene. Never serialized. */
export class MilitaryCommandOverlay {
  private graphics?:Phaser.GameObjects.Graphics;
  private selection?:{commandId:string;factionId:string;direction:boolean};
  constructor(private core:Core){}
  show(commandId:string,direction=false){
    const view=resolveMilitaryCommandView(this.core,commandId);
    if(!view){this.clear();return false;}
    this.selection={commandId,factionId:view.factionId,direction};this.update();return true;
  }
  clear(){this.selection=undefined;this.graphics?.clear();}
  destroy(){this.clear();this.graphics?.destroy();this.graphics=undefined;}
  update(){
    if(!this.selection)return;
    const view=resolveMilitaryCommandView(this.core,this.selection.commandId);
    if(!view||view.factionId!==this.selection.factionId){this.clear();return;}
    const g=this.graphics??(this.graphics=this.core.scene.add.graphics().setDepth(5500));
    g.clear();g.lineStyle(2,0xffdf83,.95);
    for(const m of view.members)g.strokeCircle(m.x,m.y,Game.BlockSize*.7);
    if(this.selection.direction&&view.target){
      const {center:a,target:b}=view,angle=Math.atan2(b.y-a.y,b.x-a.x),length=12;
      g.lineStyle(2,0xffdf83,.8);g.lineBetween(a.x,a.y,b.x,b.y);
      g.lineBetween(b.x,b.y,b.x-length*Math.cos(angle-.45),b.y-length*Math.sin(angle-.45));
      g.lineBetween(b.x,b.y,b.x-length*Math.cos(angle+.45),b.y-length*Math.sin(angle+.45));
      g.strokeCircle(b.x,b.y,Game.BlockSize); // current order direction, never a path or forecast
    }
  }
}
