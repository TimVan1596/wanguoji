import {describe,it,expect} from "vitest";
import {getVerifiedLocalCasualtyUsers} from "./PopulationCasualtyGeography";
describe("verified local casualties in both authorities",()=>{
 it.each([true,false])("uses the active position authority and requires full identity binding: logical=%s",logical=>{
  const team:any={name:"a",users:new Set()},city:any={id:"city",ownerFactionId:"a",block:{x:32,y:32,team},fortifiedCells:[]};
  const user:any={id:1,team,isDestroyed:false,player:{active:true,logicalUnitId:"u",x:40,y:40,team}};user.player.user=user;team.users.add(user);
  const entry={player:user.player,state:{unitId:"u",userId:1,factionId:"a",alive:true,logicalX:40,logicalY:40}};
  const core:any={allCities:[city],logicalGameplayAuthority:logical,logicalUnitRegistry:{getEntry:()=>entry}};
  const read=()=>getVerifiedLocalCasualtyUsers(team,"city",core,32);
  expect([...read()]).toEqual([user]);
  if(logical){user.player.x=999;expect(read().size).toBe(1);entry.state.logicalX=999;}
  else{entry.state.logicalX=999;expect(read().size).toBe(1);user.player.x=999;}
  expect(read().size).toBe(0);
  user.player.x=entry.state.logicalX=40;entry.state.userId=2;expect(read().size).toBe(0);
  entry.state.userId=1;entry.state.factionId="foreign";expect(read().size).toBe(0);
  entry.state.factionId="a";entry.state.alive=false;expect(read().size).toBe(0);
 });
});
