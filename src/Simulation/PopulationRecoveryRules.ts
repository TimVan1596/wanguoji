import type { WorldEvent } from "../History/WorldHistory";
import type Team from "../Components/Team";
import { BASE_POPULATION_CAPACITY, TERRITORY_CELLS_PER_POPULATION } from "../config/simulation";

/** Current political control, never inactive block tags or a displayed percentage. */
export function getEffectivePopulationCapacity(team: Team) {
  const territory = team.status === "ACTIVE" ? Math.max(0, team.blocks?.children?.size ?? 0) : 0;
  return territory > 0 ? BASE_POPULATION_CAPACITY + Math.floor(territory / TERRITORY_CELLS_PER_POPULATION) : 0;
}

export function getPopulationRecoveryContext(team: Team, worldMonth: number, recentEvents: readonly WorldEvent[] = []) {
  const capacity = getEffectivePopulationCapacity(team);
  const cities = (team.cities ?? []).filter(c => !c.destroyed && c.ownerFactionId === team.name);
  const count = cities.length;
  const stability = count ? cities.reduce((n,c) => n + c.loyalty, 0) / count / 100 : .5;
  const devastation = count ? cities.reduce((n,c) => n + c.devastation, 0) / count / 100 : 0;
  const siegeCount = cities.filter(c => c.underSiege).length;
  const recentWarCities = cities.filter(c =>
    c.lastCapturedYear !== undefined && c.lastCapturedYear <= worldMonth && worldMonth - c.lastCapturedYear < 24 ||
    c.lastSiegeDamageMonth !== undefined && c.lastSiegeDamageMonth >= 0 && c.lastSiegeDamageMonth <= worldMonth && worldMonth - c.lastSiegeDamageMonth < 24).length;
  const recentConflict = recentEvents.some(e => (e.monthIndex ?? e.year) <= worldMonth && (e.monthIndex ?? e.year) > worldMonth - 24 &&
    ["city-captured", "capital-fallen", "city-recovered", "city-revolt"].includes(e.type) && (e.actorFactionId === team.name || e.targetFactionId === team.name));
  const clamp = (v:number) => Math.max(0, Math.min(1,v));
  const pressure = count ? siegeCount / count : 0;
  const peace = siegeCount === 0 && recentWarCities === 0 && !recentConflict;
  const multiplier = Math.max(.15, Math.min(1.5,
    (.6 + .6 * clamp(stability)) * (1 - .65 * clamp(devastation)) * (1 - .65 * pressure) *
    (1 - .25 * Math.max(count ? recentWarCities / count : 0, recentConflict ? .5 : 0)) * (count ? 1 + Math.min(.25, count * .05) : .75) * (peace ? 1.25 : 1)));
  return { capacity, territory: team.status === "ACTIVE" ? team.blocks?.children?.size ?? 0 : 0,
    cityCount: count, siegeCount, recentWarCities, recentConflict, devastation, stability, multiplier,
    attempts: Math.max(1, Math.min(3, Math.ceil(capacity / 32))),
    state: capacity === 0 ? "无有效承载，不自然增员" : siegeCount ? "围城压力下恢复受抑" : recentWarCities || recentConflict ? "战后修复中" : devastation > .3 ? "城域破坏仍在抑制恢复" : "和平安定，逐步恢复" };
}

/** A national shared casualty clock; defense damage continues independently. No population floor. */
export function wartimePopulationLossInterval(population: number) {
  return population < 10 ? 12 : population < 24 ? 6 : 3;
}
