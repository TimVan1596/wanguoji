import Team from "../Components/Team";
import {
  IMPERIAL_STRAIN_CITY_HIGH,
  IMPERIAL_STRAIN_CITY_START,
  IMPERIAL_STRAIN_DISTANCE_FACTOR,
  IMPERIAL_STRAIN_TERRITORY_HIGH,
  IMPERIAL_STRAIN_TERRITORY_START,
  IMPERIAL_STRAIN_UNIFIED_MONTH_FACTOR,
} from "../config/simulation";

export function calculateImperialStrain(
  team: Team,
  totalCells: number,
  unifiedDurationMonths = 0
) {
  const territoryShare = (team.blocks.children.size / Math.max(totalCells, 1)) * 100;
  const cityCount = team.cities.length;
  const stability = getLocalFactionStability(team);
  const territoryPressure =
    territoryShare < IMPERIAL_STRAIN_TERRITORY_START
      ? 0
      : territoryShare >= IMPERIAL_STRAIN_TERRITORY_HIGH
      ? 34 + (territoryShare - IMPERIAL_STRAIN_TERRITORY_HIGH) * 0.8
      : (territoryShare - IMPERIAL_STRAIN_TERRITORY_START) * 1.2;
  const cityPressure =
    cityCount < IMPERIAL_STRAIN_CITY_START
      ? 0
      : cityCount >= IMPERIAL_STRAIN_CITY_HIGH
      ? 24 + (cityCount - IMPERIAL_STRAIN_CITY_HIGH) * 8
      : (cityCount - IMPERIAL_STRAIN_CITY_START + 1) * 8;
  const distancePressure = getAverageCapitalDistance(team) * IMPERIAL_STRAIN_DISTANCE_FACTOR;
  const stabilityPressure = Math.max(0, 62 - stability) * 0.8;
  const durationPressure = Math.min(24, unifiedDurationMonths * IMPERIAL_STRAIN_UNIFIED_MONTH_FACTOR);
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        territoryPressure +
          cityPressure +
          distancePressure +
          stabilityPressure +
          durationPressure
      )
    )
  );
}

export function getImperialStrainLevel(strain: number) {
  if (strain >= 80) {
    return "极高";
  }
  if (strain >= 60) {
    return "高";
  }
  if (strain >= 35) {
    return "中";
  }
  return "低";
}

export function getCityDistanceFromCapital(team: Team, city: { block: { x: number; y: number } }) {
  const capital = team.capitalCity;
  if (!capital) {
    return 0;
  }
  const dx = Math.abs(city.block.x - capital.block.x);
  const dy = Math.abs(city.block.y - capital.block.y);
  return Math.round((dx + dy) / 20);
}

function getAverageCapitalDistance(team: Team) {
  if (team.cities.length <= 1) {
    return 0;
  }
  const total = team.cities.reduce(
    (sum, city) => sum + getCityDistanceFromCapital(team, city),
    0
  );
  return total / team.cities.length;
}

function getLocalFactionStability(team: Team) {
  if (team.cities.length === 0) {
    return 100;
  }
  return Math.round(
    team.cities.reduce((sum, city) => sum + city.loyalty, 0) / team.cities.length
  );
}
