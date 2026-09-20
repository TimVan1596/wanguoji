import { describe, expect, it } from "vitest";
import {
  getCandidateFortifiedGridCells,
  hasZoneOverlapOrGapViolation,
} from "./CityZoneSpatial";

describe("city zone spatial rules", () => {
  it("rejects overlapping candidate fortified zones", () => {
    const candidate = getCandidateFortifiedGridCells({ x: 10, y: 10 }, 5);
    const existing = [getCandidateFortifiedGridCells({ x: 11, y: 10 }, 5)];

    expect(hasZoneOverlapOrGapViolation(candidate, existing, 0)).toBe(true);
  });

  it("enforces a minimum gap between fortified zones", () => {
    const candidate = [{ x: 10, y: 10 }];
    const existing = [[{ x: 12, y: 10 }]];

    expect(hasZoneOverlapOrGapViolation(candidate, existing, 1)).toBe(false);
    expect(hasZoneOverlapOrGapViolation(candidate, existing, 2)).toBe(true);
  });
});
