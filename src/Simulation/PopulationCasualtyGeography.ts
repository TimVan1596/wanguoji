import type Team from "../Components/Team";
import type Core from "../Game/Core";
import type User from "../Components/User";
import { getLogicalGridCoordinate } from "./LogicalUnitState";

/** A location preference, never a claim that this person defended the city. */
export function getVerifiedLocalCasualtyUsers(team: Team, triggerCityId: string | undefined, core: Core | undefined, blockSize: number) {
  const result = new Set<User>();
  const city = triggerCityId ? (core?.allCities ?? team.cities ?? []).find(c => c.id === triggerCityId && c.ownerFactionId === team.name && !c.destroyed) : undefined;
  if (!city || !Number.isFinite(blockSize) || blockSize <= 0) return result;
  const cells = new Set([city.block, ...(city.fortifiedCells ?? [])].filter(b => b?.team === team && (!b.city || b.city === city))
    .map(b => `${Math.round(b.x/blockSize)},${Math.round(b.y/blockSize)}`));
  for (const user of team.users) {
    if (user.team !== team || user.isDestroyed || !user.player?.active) continue;
    const player=user.player,unitId=player.logicalUnitId;
    const entry=unitId?core?.logicalUnitRegistry?.getEntry(unitId):undefined;
    if(!entry||entry.player!==player||!entry.state.alive||entry.state.unitId!==unitId||
      entry.state.userId!==user.id||entry.state.factionId!==team.name||player.user!==user||player.team!==team)continue;
    const x=core?.logicalGameplayAuthority?entry.state.logicalX:player.x;
    const y=core?.logicalGameplayAuthority?entry.state.logicalY:player.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const grid = getLogicalGridCoordinate(x!,y!,blockSize);
    if (cells.has(`${grid.gridX},${grid.gridY}`)) result.add(user);
  }
  return result;
}
