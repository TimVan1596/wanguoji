import type City from "../Components/City";
import type Team from "../Components/Team";
import type Core from "../Game/Core";
import type User from "../Components/User";

export function isSiegePosition(city:City,x:number,y:number,blockSize:number,attacking:boolean){
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0)return false;
 const gx=Math.floor(x/blockSize),gy=Math.floor(y/blockSize),margin=attacking?1:0;
 return [city.block,...(city.fortifiedCells??[])].some(b=>Math.abs(gx-Math.round(b.x/blockSize))<=margin&&Math.abs(gy-Math.round(b.y/blockSize))<=margin);
}
/** One live User/Player/registry identity, one contribution. Both runtime authorities use the same area. */
export function siegeParticipants(city: City, team: Team, core: Core | undefined, blockSize: number, attacking: boolean) {
  const result: User[] = [], seen = new Set<string>();
  if (!core || !team.users || city.destroyed) return result;
  for (const u of team.users) {
    const p = u.player, id = p?.logicalUnitId;
    const e = id ? core.logicalUnitRegistry?.getEntry(id) : undefined;
    if (!id || seen.has(id) || !e || e.player !== p || !e.state.alive || e.state.userId !== u.id ||
      e.state.factionId !== team.name || e.state.unitId !== id || u.team !== team || u.isDestroyed ||
      p.user !== u || p.team !== team || !p.active || p.parent || p.children?.length) continue;
    const x = core.logicalGameplayAuthority ? e.state.logicalX : p.x;
    const y = core.logicalGameplayAuthority ? e.state.logicalY : p.y;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) continue;
    if(!isSiegePosition(city,x,y,blockSize,attacking))continue;
    seen.add(id); result.push(u);
  }
  return result;
}
