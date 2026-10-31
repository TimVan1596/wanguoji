import Game from '../Game/Game';
import type Team from '../Components/Team';
import type Dynasty from './Dynasty';
import Military from './MilitaryCommandRegistry';
import History from '../History/WorldHistory';
import Effects from '../Simulation/FactionEffects';
import random from '../Simulation/WorldRandom';
import {beginPoliticalMutation,politicalMutationActive} from '../Simulation/PoliticalMutationScope';

/** Keep live object identities and Arcade bodies until all fallible canonical writes succeed.
 * This is a rollback journal, not hydration or a second simulation. */
export function successionTransaction<T>(team:Team,store:Pick<typeof Dynasty,'snapshotSuccessionTransaction'|'rollbackSuccessionTransaction'>,work:()=>T):T {
 const core=Game.Core;
 if(politicalMutationActive()||!core?.logicalUnitRegistry||!team.players?.getChildren)return work();
 const dynasty=store.snapshotSuccessionTransaction(),military=Military.snapshotTransaction(),history=History.exportState(),effects=Effects.exportState(),rng=random.exportState();
 const teams=core.teams.map(t=>({t,users:[...t.users],players:t.players.getChildren().slice(),rulerUser:t.rulerUser,
  displayName:t.displayName,houseName:t.houseName,color:t.color,colorHistory:structuredClone(t.colorHistory),nameHistory:structuredClone(t.nameHistory)}));
 const users=teams.flatMap(s=>s.users.map(u=>({u,state:u.capturePoliticalState()})));
 const players=teams.flatMap(s=>s.players).filter(p=>typeof (p as any).exportMovementState==='function').map(p=>({p:p as import('../Components/Player').default,state:(p as import('../Components/Player').default).exportMovementState((p as import('../Components/Player').default).logicalUnitId??''),crown:!!(p as import('../Components/Player').default).crownMarker}));
 const registry=core.logicalUnitRegistry,sequence=registry.exportState().nextUnitSequence,units=registry.getEntries().map(e=>({state:{...e.state},player:e.player,user:e.player?.user}));
 const scope=beginPoliticalMutation();
 let result:T;
 try{result=work();}
 catch(error){
  scope.cancel();
  const original=new Set(users.map(x=>x.u));
  for(const t of core.teams)for(const u of [...t.users])if(!original.has(u))u.destroyUser(true,{cause:'RULER_LIFECYCLE',deferPopulationAudit:true});
  store.rollbackSuccessionTransaction(dynasty);Military.rollbackTransaction(military);History.importState(history);Effects.importState(effects);
  for(const x of users)x.u.restorePoliticalState(x.state);
  for(const x of teams){Object.assign(x.t,{displayName:x.displayName,houseName:x.houseName,color:x.color,colorHistory:x.colorHistory,nameHistory:x.nameHistory,rulerUser:x.rulerUser});x.t.users.clear();x.users.forEach(u=>x.t.users.add(u));x.t.players.clear(false,false);x.players.forEach(p=>x.t.players.add(p));
   for(const block of x.t.blocks.getChildren() as any[])block.setFillStyle?.(x.color);
   for(const p of x.players as any[])p.factionRing?.setStrokeStyle(2,x.color,.85);
   x.t.cities.forEach(c=>c.refreshZoneVisual());
  }
  for(const x of players){x.p.applyHydratedMovementState(x.state);if(!x.crown&&x.p.crownMarker){x.p.crownMarker.destroy();x.p.crownMarker=undefined;}}
  registry.importState(sequence,units);random.restore(rng);
  throw error;
 }
 scope.commit();return result;
}
