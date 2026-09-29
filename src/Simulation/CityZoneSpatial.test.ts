import { describe, expect, it } from "vitest";
import {
  getCandidateFortifiedGridCells,
  getFortifiedGridOffsets,
  hasZoneOverlapOrGapViolation,
} from "./CityZoneSpatial";

describe("city zone spatial rules", () => {
  it("rejects overlapping candidate fortified zones", () => {
    const candidate = getCandidateFortifiedGridCells({ x: 10, y: 10 }, 8);
    const existing = [getCandidateFortifiedGridCells({ x: 11, y: 10 }, 8)];

    expect(hasZoneOverlapOrGapViolation(candidate, existing, 0)).toBe(true);
  });

  it("enforces a minimum gap between fortified zones", () => {
    const candidate = [{ x: 10, y: 10 }];
    const existing = [[{ x: 12, y: 10 }]];

    expect(hasZoneOverlapOrGapViolation(candidate, existing, 1)).toBe(false);
    expect(hasZoneOverlapOrGapViolation(candidate, existing, 2)).toBe(true);
  });

  it("preserves e1 geometry at each defense value after the numeric +2 shift", () => {
    expect(getFortifiedGridOffsets(6)).toHaveLength(1);
    expect(getFortifiedGridOffsets(8)).toHaveLength(5);
    expect(getFortifiedGridOffsets(10)).toHaveLength(9);
    expect(getFortifiedGridOffsets(12)).toHaveLength(13);
  });
});
