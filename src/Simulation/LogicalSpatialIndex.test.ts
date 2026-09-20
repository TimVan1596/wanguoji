import { describe, expect, it } from "vitest";
import LogicalSpatialIndex from "./LogicalSpatialIndex";
import type { LogicalUnitState } from "./LogicalUnitState";

function unit(
  unitId: string,
  factionId: string,
  currentGridX: number,
  currentGridY: number
): LogicalUnitState {
  return {
    unitId,
    factionId,
    logicalX: currentGridX * 32,
    logicalY: currentGridY * 32,
    logicalVX: 0,
    logicalVY: 0,
    alive: true,
    currentGridX,
    currentGridY,
    radius: 16,
    speed: 0,
  };
}

describe("LogicalSpatialIndex", () => {
  it("indexes units by grid cell", () => {
    const index = new LogicalSpatialIndex();
    index.rebuild([unit("u1", "qin", 2, 3), unit("u2", "chu", 3, 3)]);
    expect(index.getUnitsAt(2, 3).map((item) => item.unitId)).toEqual(["u1"]);
  });

  it("finds enemy pairs in same or neighboring combat cells without duplicates", () => {
    const index = new LogicalSpatialIndex();
    index.rebuild([
      unit("u1", "qin", 2, 3),
      unit("u2", "chu", 3, 3),
      unit("u3", "qin", 2, 4),
    ]);
    const pairs = index.getNearbyEnemyPairs().map(([a, b]) =>
      [a.unitId, b.unitId].sort().join(":")
    );
    expect(pairs).toEqual(["u1:u2", "u2:u3"]);
  });
});
