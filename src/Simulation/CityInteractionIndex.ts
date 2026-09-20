export interface CityInteractionCell {
  x: number;
  y: number;
}

export interface CityInteractionCity {
  id: string;
  name?: string;
  destroyed?: boolean;
  fortifiedCells: CityInteractionCell[];
}

export function getCityInteractionGridKey(gridX: number, gridY: number) {
  return `${gridX},${gridY}`;
}

export function getCityInteractionGridFromWorld(
  worldX: number,
  worldY: number,
  blockSize: number
) {
  return {
    x: Math.floor(worldX / blockSize),
    y: Math.floor(worldY / blockSize),
  };
}

export function getCityInteractionGridFromCell(
  cell: CityInteractionCell,
  blockSize: number
) {
  return {
    x: Math.round(cell.x / blockSize),
    y: Math.round(cell.y / blockSize),
  };
}

export class CityInteractionIndex {
  private cellToCityId = new Map<string, string>();

  reset() {
    this.cellToCityId.clear();
  }

  rebuild(cities: CityInteractionCity[], blockSize: number) {
    this.reset();
    cities.forEach((city) => this.registerCity(city, blockSize));
  }

  registerCity(city: CityInteractionCity, blockSize: number) {
    if (city.destroyed) {
      this.unregisterCity(city.id);
      return;
    }
    this.unregisterCity(city.id);
    city.fortifiedCells.forEach((cell) => {
      const grid = getCityInteractionGridFromCell(cell, blockSize);
      this.cellToCityId.set(getCityInteractionGridKey(grid.x, grid.y), city.id);
    });
  }

  unregisterCity(cityId: string) {
    [...this.cellToCityId.entries()].forEach(([key, value]) => {
      if (value === cityId) {
        this.cellToCityId.delete(key);
      }
    });
  }

  resolveGrid(gridX: number, gridY: number) {
    return this.cellToCityId.get(getCityInteractionGridKey(gridX, gridY));
  }

  resolveWorld(worldX: number, worldY: number, blockSize: number) {
    const grid = getCityInteractionGridFromWorld(worldX, worldY, blockSize);
    return this.resolveGrid(grid.x, grid.y);
  }

  entries() {
    return [...this.cellToCityId.entries()];
  }
}
