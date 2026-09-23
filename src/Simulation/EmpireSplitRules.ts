export interface SplitCityLike {
  name: string;
  loyalty: number;
  isCapital: boolean;
  block: {
    x: number;
    y: number;
  };
}

export const EMPIRE_SPLIT_REGION_RADIUS_CELLS = 8;

export function selectSplitCore(cities: SplitCityLike[]) {
  const nonCapital = cities
    .filter((city) => !city.isCapital)
    .sort((a, b) => a.loyalty - b.loyalty)[0];
  return nonCapital ?? [...cities].sort((a, b) => a.loyalty - b.loyalty)[0];
}

export function selectSplitCities(
  coreCity: SplitCityLike,
  cities: SplitCityLike[],
  maxCities: number,
  cellSize = 1
) {
  return [coreCity, ...getNearestCities(coreCity, cities, cellSize)]
    .filter((city, index, array) => array.indexOf(city) === index)
    .slice(0, maxCities);
}

export function shouldRestoreBeforeNewRebel(
  founderCanRestore: boolean,
  founderStatus: string
) {
  return founderStatus === "EXILED" && founderCanRestore;
}

function getNearestCities(coreCity: SplitCityLike, cities: SplitCityLike[], cellSize: number) {
  return cities
    .filter((city) => city !== coreCity && !city.isCapital)
    .filter((city) => getCityDistance(coreCity, city) <= EMPIRE_SPLIT_REGION_RADIUS_CELLS * cellSize)
    .sort((a, b) => getCityDistance(coreCity, a) - getCityDistance(coreCity, b));
}

function getCityDistance(a: SplitCityLike, b: SplitCityLike) {
  return Math.abs(a.block.x - b.block.x) + Math.abs(a.block.y - b.block.y);
}
