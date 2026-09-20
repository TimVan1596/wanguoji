import { LogicalUnitState } from "./LogicalUnitState";

export function getLogicalSpatialKey(gridX: number, gridY: number) {
  return `${gridX},${gridY}`;
}

export default class LogicalSpatialIndex {
  private buckets = new Map<string, string[]>();
  private units = new Map<string, LogicalUnitState>();

  rebuild(units: LogicalUnitState[]) {
    this.buckets.clear();
    this.units.clear();
    units.forEach((unit) => {
      if (!unit.alive) {
        return;
      }
      this.units.set(unit.unitId, unit);
      const key = getLogicalSpatialKey(unit.currentGridX, unit.currentGridY);
      const bucket = this.buckets.get(key) ?? [];
      bucket.push(unit.unitId);
      this.buckets.set(key, bucket);
    });
  }

  getUnitsAt(gridX: number, gridY: number) {
    return (this.buckets.get(getLogicalSpatialKey(gridX, gridY)) ?? [])
      .map((unitId) => this.units.get(unitId))
      .filter((unit): unit is LogicalUnitState => Boolean(unit));
  }

  getNearbyEnemyPairs() {
    const pairs: Array<[LogicalUnitState, LogicalUnitState]> = [];
    const seen = new Set<string>();
    this.units.forEach((unit) => {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          this.getUnitsAt(unit.currentGridX + dx, unit.currentGridY + dy).forEach(
            (other) => {
              if (unit.unitId === other.unitId || unit.factionId === other.factionId) {
                return;
              }
              const key =
                unit.unitId < other.unitId
                  ? `${unit.unitId}:${other.unitId}`
                  : `${other.unitId}:${unit.unitId}`;
              if (seen.has(key)) {
                return;
              }
              seen.add(key);
              pairs.push([unit, other]);
            }
          );
        }
      }
    });
    return pairs;
  }
}
