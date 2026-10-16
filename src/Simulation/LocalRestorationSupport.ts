import { getControlledCityResponseCells } from "./CityZoneSpatial";
import type { LogicalUnitState } from "./LogicalUnitState";
import type City from "../Components/City";
import type Team from "../Components/Team";
import type User from "../Components/User";
import Game from "../Game/Game";
import DynastyRegistry from "../Politics/Dynasty";
import MilitaryCommandRegistry from "../Politics/MilitaryCommandRegistry";
import { isNaturallyDeadByMonth } from "../Politics/RulerLifespanRules";
import { hasFormalStateIdentity } from "./FactionIdentity";
import WorldExiles from "./WorldExiles";
import WorldRemnants from "./WorldRemnants";

export const LOCAL_RESTORATION_RADIUS_CELLS = 3;

/** Read-only; never creates an heir or consumes the succession RNG. */
export function getLocalRestorationClaimant(team: Team, worldMonth: number) {
  const exile = WorldExiles.get(team.name), dynasty = DynastyRegistry.get(team.name);
  if (team.status !== "EXILED" || team.terminationReason || !hasFormalStateIdentity(team) ||
      !Number.isSafeInteger(team.stateFoundedMonth) || team.stateFoundedMonth! < 0 || team.stateFoundedMonth! > worldMonth ||
      !exile || !Number.isFinite(exile.legitimacy) || exile.legitimacy <= 0 || (WorldRemnants.get(team.name)?.population ?? 0) > 0 || !dynasty) return undefined;
  const epoch = dynasty.houseEpochs?.[dynasty.houseEpochs.length - 1];
  if (!epoch || epoch.endMonth !== undefined || !Number.isSafeInteger(epoch.startMonth) || epoch.startMonth < 0 || epoch.startMonth > worldMonth ||
      !dynasty.rulers.some(r => r.id === epoch.foundingRulerId)) return undefined;
  const alive = (r: typeof dynasty.rulers[number]) => r.houseName === epoch.houseName &&
    !isNaturallyDeadByMonth(r.naturalDeathYear ?? r.plannedEndYear, worldMonth);
  const current = DynastyRegistry.getCurrentRuler(team.name);
  if (current && ["exiled", "ruling"].includes(current.status) && alive(current)) return current;
  return dynasty.heirIds.map(id => dynasty.rulers.find(r => r.id === id))
    .find(r => r?.status === "heir" && alive(r));
}

export const LOCAL_RESTORATION_ZONE_MAX_CELLS = 5;

export function getLocalRestorationArea(city: City) {
  const owner=city.ownerTeam, map=Game.Core?.map, size=Game.BlockSize;
  const center={x:Math.round(city.block.x/size),y:Math.round(city.block.y/size)};
  return getControlledCityResponseCells((city.fortifiedCells ?? []).filter(c=>c.city===city && c.team===owner)
    .map(c=>({x:Math.round(c.x/size),y:Math.round(c.y/size)})),center,p=>{
      const block=map?.getBlock?.(p.x,p.y);
      return Boolean(block && owner && block.team===owner && (!block.city || block.city===city));
    });
}

export function isInLocalRestorationArea(city: City, unit: LogicalUnitState, area=getLocalRestorationArea(city)) {
  const size=Game.BlockSize, distance=Math.hypot(unit.logicalX-(city.block.x+size/2),unit.logicalY-(city.block.y+size/2))/size;
  return Number.isFinite(distance) && (distance<=LOCAL_RESTORATION_RADIUS_CELLS ||
    (distance<=LOCAL_RESTORATION_ZONE_MAX_CELLS && area.has(`${Math.floor(unit.logicalX/size)},${Math.floor(unit.logicalY/size)}`)));
}

/** Ordinary formation members may respond only if their departure leaves a valid
 * formation and never removes its commander. Unassigned users are preferred. */
export function assessLocalRestorationPopulation(city: City) {
  const result={users:[] as User[], legacyEligible:0, nearbyNormal:0, identityBlocked:0, outsideArea:0, invalidUnit:0, observedUnitIds:[] as string[]};
  const core=Game.Core,owner=city.ownerTeam;
  if (!core?.logicalUnitRegistry || !owner || owner.status!=="ACTIVE" || city.destroyed) return result;
  const area=getLocalRestorationArea(city);
  const formations=MilitaryCommandRegistry.getFormations().filter(f=>f.status==="ACTIVE");
  const memberships=new Map<string,typeof formations>();
  for(const f of formations) for(const id of f.memberUnitIds) {const rows=memberships.get(id) ?? [];rows.push(f);memberships.set(id,rows);}
  const seen=new Set<string>();
  for(const user of owner.users) {
    const player=user.player,id=player?.logicalUnitId,entry=id?core.logicalUnitRegistry.getEntry(id):undefined,unit=entry?.state;
    if (!id || !unit || entry?.player!==player || !unit.alive || unit.userId!==user.id || unit.factionId!==owner.name ||
        !Number.isFinite(unit.logicalX) || !Number.isFinite(unit.logicalY) || seen.has(id) || player.user!==user) {result.invalidUnit++;continue;}
    seen.add(id);result.observedUnitIds.push(id);
    if (!isInLocalRestorationArea(city,unit,area)) {result.outsideArea++;continue;}
    if(user.role==="NORMAL") result.nearbyNormal++;
    const assigned=memberships.get(id) ?? [];
    const safeMember=!assigned.length || (assigned.length===1 && assigned[0].factionId===owner.name && assigned[0].memberUnitIds.length>=3 &&
      !user.militaryPersonId && assigned[0].commanderPersonId!==user.militaryPersonId);
    if (!Number.isSafeInteger(user.id) || !Number.isSafeInteger(user.bornMonth) || !user.name || user.team!==owner || user.isDestroyed ||
        unit.role!=="NORMAL" || unit.rulerId || user.role!=="NORMAL" || user.rulerId || user.militaryPersonId || !safeMember || player.role!=="NORMAL" || player.rulerId || !player.active || player.team!==owner ||
        player.parent || player.children.length || user.slaveGroup.npcs.size || user.slaveGroup.children.size) {result.identityBlocked++;continue;}
    if(!assigned.length && Math.hypot(unit.logicalX-(city.block.x+Game.BlockSize/2),unit.logicalY-(city.block.y+Game.BlockSize/2))<=Game.BlockSize*LOCAL_RESTORATION_RADIUS_CELLS) result.legacyEligible++;
    result.users.push(user);
  }
  result.users.sort((a,b)=>Number(memberships.has(a.player.logicalUnitId!))-Number(memberships.has(b.player.logicalUnitId!)) ||
    (a.player.logicalUnitId!<b.player.logicalUnitId! ? -1 : a.player.logicalUnitId!>b.player.logicalUnitId! ? 1 : 0));
  return result;
}

export function getLocalRestorationSupporters(city: City): User[] { return assessLocalRestorationPopulation(city).users; }
