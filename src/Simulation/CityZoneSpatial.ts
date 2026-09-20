import { FORTIFIED_ZONE_TIERS } from "../config/simulation";

export interface GridPoint {
  x: number;
  y: number;
}

export function getFortifiedGridOffsets(maxDefense: number) {
  const tier = FORTIFIED_ZONE_TIERS.find(
    (item) => maxDefense >= item.minDefense && maxDefense <= item.maxDefense
  );
  if (tier?.shape === "cross") {
    return [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
  }
  if (tier?.shape === "square") {
    return [
      { x: 0, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 1 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ];
  }
  if (tier?.shape === "diamond") {
    return [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
      { x: -1, y: -1 },
      { x: 2, y: 0 },
      { x: -2, y: 0 },
      { x: 0, y: 2 },
      { x: 0, y: -2 },
    ];
  }
  return [{ x: 0, y: 0 }];
}

export function getCandidateFortifiedGridCells(center: GridPoint, maxDefense: number) {
  return getFortifiedGridOffsets(maxDefense).map((offset) => ({
    x: center.x + offset.x,
    y: center.y + offset.y,
  }));
}

export function hasZoneOverlapOrGapViolation(
  candidateCells: GridPoint[],
  existingZones: GridPoint[][],
  minGap: number
) {
  return existingZones.some((zone) =>
    candidateCells.some((candidate) =>
      zone.some(
        (existing) =>
          Math.abs(candidate.x - existing.x) + Math.abs(candidate.y - existing.y) <=
          minGap
      )
    )
  );
}
