import { measurePhase, type MonthlyPhaseProfiler } from "./MonthlyPhaseProfiler";
import Team from "../Components/Team";
import Danmu from "../Live/Danmu";
import { createLocalDanmu, getLocalUserId } from "../Live/LocalDanmaku";
import {
  BASE_GROWTH_CHANCE,
  BASE_POPULATION_CAPACITY,
  NATURAL_GROWTH_CHECK_MONTHS,
  TERRITORY_CELLS_PER_POPULATION,
  USER_NATURAL_LOYALTY_MAX,
  USER_NATURAL_LOYALTY_MIN,
} from "../config/simulation";
import { resolvePublicAssetUrl } from "../Runtime/PublicAssetUrl";
import type { PopulationMutationContext } from "./PopulationTransitionAudit";
import worldRandom from "./WorldRandom";

export type InitialPopulationMap = Record<string, number>;

export function selectNormalUsersForGodRemoval<T extends { id: number; name: string; role: string }>(users: Iterable<T>, requested: number) {
  return [...users]
    .filter((user) => user.role === "NORMAL")
    .sort((a, b) => a.id - b.id || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, Math.floor(requested)));
}

export function getPopulationCapacity(team: Team) {
  const territory = team.blocks.children.size;
  return (
    BASE_POPULATION_CAPACITY +
    Math.floor(territory / TERRITORY_CELLS_PER_POPULATION)
  );
}

export default class PopulationSystem {
  private counters: Record<string, number> = {};
  private lastGrowthMonth = 0;

  getRuntimeCardinality() { return { populationNameCounters: Object.keys(this.counters).length }; }

  exportState() {
    return { counters: { ...this.counters }, lastGrowthMonth: this.lastGrowthMonth };
  }

  importState(state: { counters: Record<string, number>; lastGrowthMonth: number }) {
    this.counters = { ...state.counters };
    this.lastGrowthMonth = state.lastGrowthMonth;
  }

  reset() {
    this.counters = {};
    this.lastGrowthMonth = 0;
  }

  initialize(teams: Team[], populations: InitialPopulationMap) {
    teams.forEach((team) => {
      const count = populations[team.name] ?? 0;
      for (let i = 0; i < count; i++) {
        this.spawn(team, undefined, false, { cause: "INITIALIZATION" });
      }
    });
  }

  update(
    worldMonth: number,
    teams: Team[],
    getGrowthMultiplier: (team: Team) => number = () => 1,
    profile?: MonthlyPhaseProfiler
  ) {
    if (worldMonth - this.lastGrowthMonth < NATURAL_GROWTH_CHECK_MONTHS) {
      return;
    }
    this.lastGrowthMonth = worldMonth;

    const aliveTeams = measurePhase(profile, "Population.active faction scan", () => teams.filter((team) => !team.isDie));
    aliveTeams.forEach((team) => {
      const { population, capacity } = measurePhase(profile, "Population.capacity", () => ({ population: this.getPopulation(team), capacity: this.getCapacity(team) }));
      if (population >= capacity) {
        return;
      }

      const roomRatio = (capacity - population) / capacity;
      const recoveryRatio = population <= 0 ? 0.25 : 1;
      const chance =
        BASE_GROWTH_CHANCE *
        roomRatio *
        recoveryRatio *
        measurePhase(profile, "Population.growth context", () => getGrowthMultiplier(team));
      if (worldRandom.next() <= chance) {
        measurePhase(profile, "Population.spawn/runtime creation", () => this.spawn(team, undefined, false, { cause: "NATURAL_GROWTH", month: worldMonth }, profile));
      }
    });
  }

  getPopulation(team: Team) {
    return team.users.size;
  }

  getCapacity(team: Team) {
    return getPopulationCapacity(team);
  }

  godAdd(team: Team, requested: number) {
    let affectedCount = 0;
    for (let index = 0; index < Math.max(0, Math.floor(requested)); index += 1) {
      const name = this.nextGodName(team);
      const user = this.spawn(team, name, true, { cause: "GOD_ACTION" });
      if (user) affectedCount += 1;
    }
    return affectedCount;
  }

  godRemove(team: Team, requested: number) {
    const users = selectNormalUsersForGodRemoval(team.users, requested);
    let affectedCount = 0;
    for (const user of users) {
      if (user.destroyUser(false, { cause: "GOD_ACTION" })) affectedCount += 1;
    }
    return affectedCount;
  }

  private nextGodName(team: Team) {
    const key = `god:${team.name}`;
    const count = (this.counters[key] ?? 0) + 1;
    this.counters[key] = count;
    return `God-${team.name}-${String(count).padStart(6, "0")}`;
  }

  private spawn(
    team: Team,
    forcedName?: string,
    bypassCapacity = false,
    populationMutation: PopulationMutationContext = { cause: "NATURAL_GROWTH" },
    profile?: MonthlyPhaseProfiler
  ) {
    if (team.isDie || (!bypassCapacity && this.getPopulation(team) >= this.getCapacity(team))) return undefined;
    const teamKey = team.shortName ?? team.name;
    let name = forcedName;
    if (!name) {
      const count = (this.counters[team.name] ?? 0) + 1;
      this.counters[team.name] = count;
      name = `${teamKey}-${String(count).padStart(3, "0")}`;
    }
    const id = measurePhase(profile, "Population.user id lookup", () => {
      let candidateId = getLocalUserId(name!);
      while (Team.GetUserById(candidateId)) candidateId = candidateId >= 1999999999 ? 1000000000 : candidateId + 1;
      return candidateId;
    });
    const user = measurePhase(profile, "Population.makeUser", () => team.makeUser(
      id,
      name!,
      resolvePublicAssetUrl("img/no-face.svg"),
      worldRandom.int(USER_NATURAL_LOYALTY_MIN, USER_NATURAL_LOYALTY_MAX),
      "NORMAL",
      undefined,
      populationMutation
    ));
    if (user) return user;
    // Legacy join-command routing remains the fallback for natural population.
    return Danmu.Apply(createLocalDanmu(name, team.name,
      worldRandom.int(USER_NATURAL_LOYALTY_MIN, USER_NATURAL_LOYALTY_MAX)), populationMutation);
  }
}
