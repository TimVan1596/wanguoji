import Game from "../Game/Game";
import City from "../Components/City";
import type Team from "../Components/Team";
import type User from "../Components/User";
import Dynasty from "../Politics/Dynasty";
import Military from "../Politics/MilitaryCommandRegistry";
import History from "../History/WorldHistory";
import Lifetime from "./FactionLifetimeRecord";
/** Rare split transaction only. Keep existing live objects; do not hydrate a second world mid-step. */
export function captureMilitarySplitRollback(parent:Team,created:Team,participants:User[]){
 const core=Game.Core,teams=new Map(core.teams.map(t=>[t.name,t]));
 const cities=parent.cities.map(c=>({city:c,state:c.exportState(Math.round(c.block.x/Game.BlockSize),Math.round(c.block.y/Game.BlockSize)),cells:[...c.fortifiedCells]}));
 const oldCities=[...parent.cities],home=parent.homeBlock;
 const blocks=core.map!.blocks.flat().map(b=>({b,state:{owner:b.team,isHome:b.isHome,hp:b.hp,city:b.city,isCityCenter:b.isCityCenter}}));
 const military=Military.snapshotTransaction(),dynasty=Dynasty.exportState(),history=History.exportState(),lifetime=Lifetime.exportState();
 const people=participants.map(u=>({u,team:u.team,role:u.role,rulerId:u.rulerId,historicalPersonId:u.historicalPersonId}));
 return ()=>{
  created.rulerUser=undefined;
  for(const x of people){x.u.role=x.role;x.u.rulerId=x.rulerId;x.u.historicalPersonId=x.historicalPersonId;x.u.player.setRole(x.role,x.rulerId,true);
   x.u.setTeam(x.team,{cause:"EMPIRE_SPLIT_TRANSFER",month:core.simulator?.year,deferPopulationAudit:true,context:"军事建势回退"});
   core.logicalUnitRegistry.updateRole(x.u.player.logicalUnitId,x.role,x.rulerId);
  }
  parent.cities=oldCities;parent.homeBlock=home;created.cities=[];
  for(const x of cities){const restored=City.hydrate(x.state,x.city.block,teams);const {zoneOutline:_outline,zoneHighlighted:_highlight,...canonical}=restored as any;Object.assign(x.city,canonical);x.city.fortifiedCells=x.cells;}
  for(const x of blocks)x.b.restoreCanonicalState(x.state);
  Dynasty.importState(dynasty);Military.rollbackTransaction(military);History.importState(history);Lifetime.importState(lifetime);
  core.rollbackRuntimeTeam(created);
  for(const x of cities){core.registerCityInteraction(x.city);try{x.city.rebuildRuntimeVisuals();}catch{/* Canonical state and interaction bounds are already restored. */}}
 };
}
