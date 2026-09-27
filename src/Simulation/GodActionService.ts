import City, { getFactionStability } from "../Components/City";
import Team from "../Components/Team";
import Game from "../Game/Game";
import DynastyRegistry from "../Politics/Dynasty";
import { CITY_MAX_STABLE_LOYALTY, MAX_ACTIVE_FACTIONS, REBEL_LOYALTY_THRESHOLD_V095 } from "../config/simulation";
import { store } from "../store";
import { updateTeams } from "../store/rootSlice";
import WorldRemnants from "./WorldRemnants";
import FactionRegistry from "./FactionRegistry";

export interface GodActionResult<T = Record<string, number>> {
  success: boolean;
  message: string;
  before: T;
  after: T;
  affectedCount?: number;
}

export function resolveGodFactionTarget<T extends { name: string }>(teams: T[], selectedFactionName?: string) {
  return selectedFactionName ? teams.find((team) => team.name === selectedFactionName) : undefined;
}

export function canRunGodMutation(state: { worldStarted: boolean; saving: boolean; backgroundCatchUpActive: boolean; bootstrapBusy?: boolean }) {
  return state.worldStarted && !state.saving && !state.backgroundCatchUpActive && !state.bootstrapBusy;
}

const fail = (message: string): GodActionResult => ({ success: false, message, before: {}, after: {} });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default class GodActionService {
  static addPopulation(team: Team | undefined, count: number): GodActionResult {
    if (!team || team.isDie) return fail("未选择有效的存活势力");
    const before = team.users.size;
    const affectedCount = Game.Core?.simulator?.godAddPopulation(team, count) ?? 0;
    store.dispatch(updateTeams());
    return { success: affectedCount > 0, message: `人口 ${before} → ${team.users.size}`, before: { population: before }, after: { population: team.users.size }, affectedCount };
  }

  static removePopulation(team: Team | undefined, count: number): GodActionResult {
    if (!team || team.isDie) return fail("未选择有效的存活势力");
    const before = team.users.size;
    const affectedCount = Game.Core?.simulator?.godRemovePopulation(team, count) ?? 0;
    store.dispatch(updateTeams());
    return { success: affectedCount > 0, message: `人口 ${before} → ${team.users.size}`, before: { population: before }, after: { population: team.users.size }, affectedCount };
  }

  static changeStability(team: Team | undefined, delta: number): GodActionResult {
    if (!team || team.isDie) return fail("未选择有效的存活势力");
    const cities = team.cities.filter((city) => !city.destroyed && city.ownerFactionId === team.name);
    if (!cities.length) return fail("该势力没有可调整忠诚度的有效城市");
    const beforeStability = getFactionStability(team) ?? 0;
    let affectedCount = 0;
    cities.forEach((city) => {
      const before = city.loyalty;
      city.loyalty = clamp(before + delta, 0, CITY_MAX_STABLE_LOYALTY);
      if (city.loyalty !== before) affectedCount += 1;
      city.block.updateCityDisplay();
    });
    const afterStability = getFactionStability(team) ?? 0;
    store.dispatch(updateTeams());
    return { success: affectedCount > 0, message: `稳定度 ${beforeStability} → ${afterStability}（请求 ${delta >= 0 ? "+" : ""}${delta}）`, before: { requestedDelta: delta, stability: beforeStability }, after: { requestedDelta: delta, stability: afterStability }, affectedCount };
  }

  static setStabilityTarget(team: Team | undefined, target: number): GodActionResult {
    if (!team || team.isDie) return fail("未选择有效的存活势力");
    const cities = team.cities.filter((city) => !city.destroyed && city.ownerFactionId === team.name);
    if (!cities.length) return fail("该势力没有可调整忠诚度的有效城市");
    const beforeStability = getFactionStability(team) ?? 0;
    const requestedTarget = clamp(Math.round(target), 0, CITY_MAX_STABLE_LOYALTY);
    let affectedCount = 0;
    cities.forEach((city) => {
      if (city.loyalty !== requestedTarget) affectedCount += 1;
      city.loyalty = requestedTarget;
      city.block.updateCityDisplay();
    });
    const afterStability = getFactionStability(team) ?? 0;
    store.dispatch(updateTeams());
    return { success: affectedCount > 0, message: `稳定度 ${beforeStability} → ${afterStability}（目标 ${requestedTarget}）`, before: { requestedTarget, stability: beforeStability }, after: { requestedTarget, stability: afterStability }, affectedCount };
  }

  static changeCity(city: City | undefined, field: "loyalty" | "defense" | "devastation", operation: "delta" | "set" | "full", value: number): GodActionResult {
    if (!city || city.destroyed) return fail("未选择有效城市");
    const before = { [field]: city[field] };
    if (field === "loyalty") city.loyalty = clamp(operation === "set" ? value : city.loyalty + value, 0, CITY_MAX_STABLE_LOYALTY);
    if (field === "defense") city.defense = operation === "full" ? city.maxDefense : clamp(operation === "set" ? value : city.defense + value, 1, city.maxDefense);
    if (field === "devastation") city.devastation = clamp(operation === "set" ? value : city.devastation + value, 0, 99);
    if (field === "defense") city.fortifiedCells.forEach((cell) => cell.updateCityDisplay());
    else city.block.updateCityDisplay();
    const after = { [field]: city[field] };
    store.dispatch(updateTeams());
    return { success: before[field] !== after[field], message: `${city.name} ${field} ${before[field]} → ${after[field]}`, before, after, affectedCount: before[field] === after[field] ? 0 : 1 };
  }

  static foundRebel(city: City | undefined): GodActionResult {
    if (!city) return fail("未选择城市");
    const success = Game.Core?.simulator?.foundRebelByGod(city) ?? false;
    return { success: Boolean(success), message: success ? `${city.name} 已响应叛乱干预` : "叛乱条件未满足", before: {}, after: {}, affectedCount: success ? 1 : 0 };
  }

  static restoreFaction(city: City | undefined): GodActionResult {
    if (!city) return fail("未选择城市");
    const success = Game.Core?.simulator?.restoreFactionByGod(city) ?? false;
    return { success: Boolean(success), message: success ? `${city.name} 已响应复国干预` : "复国条件未满足", before: {}, after: {}, affectedCount: success ? 1 : 0 };
  }
}

export function describePoliticalAvailability(city: City | undefined, currentMonth: number) {
  if (!city) return { rebellion: "未选择城市", restoration: "未选择城市" };
  const activeCount = Game.Core?.teams.filter((team) => !team.isDie).length ?? 0;
  const rebellion = city.isInCaptureGrace(currentMonth) ? "capture grace" : city.loyalty > REBEL_LOYALTY_THRESHOLD_V095 ? "忠诚过高" : activeCount >= MAX_ACTIVE_FACTIONS ? "达到 active faction limit" : "可尝试";
  const founder = city.founderTeam;
  const remnants = founder ? WorldRemnants.get(founder.name) : undefined;
  const restoration = !founder?.isDie ? "founder 未灭亡" : founder.cities.length > 0 ? "势力尚存" : !remnants || remnants.population <= 0 ? "无 remnants" : !DynastyRegistry.hasClaimant(founder.name) ? "无 claimant" : !FactionRegistry.canRestoreFaction(founder) ? "复国资格未满足" : "可尝试";
  return { rebellion, restoration };
}
