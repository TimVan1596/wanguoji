import Team from "../Components/Team";
import Danmu from "../Live/Danmu";
import { createLocalDanmu } from "../Live/LocalDanmaku";
import {
  BASE_GROWTH_CHANCE,
  BASE_POPULATION_CAPACITY,
  NATURAL_GROWTH_CHECK_MONTHS,
  TERRITORY_CELLS_PER_POPULATION,
  USER_NATURAL_LOYALTY_MAX,
  USER_NATURAL_LOYALTY_MIN,
} from "../config/simulation";

export type InitialPopulationMap = Record<string, number>;

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

  reset() {
    this.counters = {};
    this.lastGrowthMonth = 0;
  }

  initialize(teams: Team[], populations: InitialPopulationMap) {
    teams.forEach((team) => {
      const count = populations[team.name] ?? 0;
      for (let i = 0; i < count; i++) {
        this.spawn(team);
      }
    });
  }

  update(
    worldMonth: number,
    teams: Team[],
    getGrowthMultiplier: (team: Team) => number = () => 1
  ) {
    if (worldMonth - this.lastGrowthMonth < NATURAL_GROWTH_CHECK_MONTHS) {
      return;
    }
    this.lastGrowthMonth = worldMonth;

    teams.filter((team) => !team.isDie).forEach((team) => {
      const population = this.getPopulation(team);
      const capacity = this.getCapacity(team);
      if (population >= capacity) {
        return;
      }

      const roomRatio = (capacity - population) / capacity;
      const recoveryRatio = population <= 0 ? 0.25 : 1;
      const chance =
        BASE_GROWTH_CHANCE *
        roomRatio *
        recoveryRatio *
        getGrowthMultiplier(team);
      if (Math.random() <= chance) {
        this.spawn(team);
      }
    });
  }

  getPopulation(team: Team) {
    return team.users.size;
  }

  getCapacity(team: Team) {
    return getPopulationCapacity(team);
  }

  private spawn(team: Team) {
    const teamKey = team.shortName ?? team.name;
    const count = (this.counters[team.name] ?? 0) + 1;
    this.counters[team.name] = count;
    const name = `${teamKey}-${String(count).padStart(3, "0")}`;
    Danmu.Apply(
      createLocalDanmu(
        name,
        team.name,
        Phaser.Math.Between(USER_NATURAL_LOYALTY_MIN, USER_NATURAL_LOYALTY_MAX)
      )
    );
  }
}
