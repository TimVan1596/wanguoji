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

/** Only independent, unassigned, non-historical NORMAL users near this city's logical location. */
export function getLocalRestorationSupporters(city: City): User[] {
  const core = Game.Core, owner = city.ownerTeam;
  if (!core?.logicalUnitRegistry || !owner || owner.status !== "ACTIVE" || city.destroyed) return [];
  const assigned = new Set(MilitaryCommandRegistry.getFormations().filter(f => f.status === "ACTIVE").flatMap(f => f.memberUnitIds));
  return [...owner.users].filter(user => {
    const player = user.player, unitId = player?.logicalUnitId;
    if (!Number.isSafeInteger(user.id) || !Number.isSafeInteger(user.bornMonth) || !user.name || user.team !== owner || user.isDestroyed || user.role !== "NORMAL" || user.rulerId || user.militaryPersonId ||
        !unitId || assigned.has(unitId) || player.role !== "NORMAL" || player.rulerId || !player.active || player.team !== owner || player.user !== user ||
        player.parent || player.children.length || user.slaveGroup.npcs.size || user.slaveGroup.children.size) return false;
    const entry = core.logicalUnitRegistry.getEntry(unitId), unit = entry?.state;
    return entry?.player === player && unit?.alive === true && unit.userId === user.id &&
      unit.factionId === owner.name && unit.role === "NORMAL" && !unit.rulerId &&
      Number.isFinite(unit.logicalX) && Number.isFinite(unit.logicalY) &&
      Math.hypot(unit.logicalX - (city.block.x + Game.BlockSize / 2), unit.logicalY - (city.block.y + Game.BlockSize / 2)) <= Game.BlockSize * LOCAL_RESTORATION_RADIUS_CELLS;
  }).sort((a,b) => a.player.logicalUnitId! < b.player.logicalUnitId! ? -1 : a.player.logicalUnitId! > b.player.logicalUnitId! ? 1 : 0);
}
