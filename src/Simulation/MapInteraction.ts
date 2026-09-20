export interface GridReadableMap<TBlock> {
  getBlock(x: number, y: number): TBlock | undefined;
}

export interface CityReadableBlock<TCity> {
  city?: TCity;
}

export function getGridCoordinateFromWorld(
  worldX: number,
  worldY: number,
  blockSize: number
) {
  return {
    x: Math.floor(worldX / blockSize),
    y: Math.floor(worldY / blockSize),
  };
}

export function resolveCityAtWorld<TCity, TBlock extends CityReadableBlock<TCity>>(
  map: GridReadableMap<TBlock> | undefined,
  worldX: number,
  worldY: number,
  blockSize: number
) {
  if (!map) {
    return undefined;
  }
  const grid = getGridCoordinateFromWorld(worldX, worldY, blockSize);
  return map.getBlock(grid.x, grid.y)?.city;
}

export function getCityCameraFocusTarget(
  cityX: number,
  cityY: number,
  blockSize: number,
  currentZoom: number
) {
  return {
    centerX: cityX + blockSize / 2,
    centerY: cityY + blockSize / 2,
    zoom: currentZoom,
  };
}
