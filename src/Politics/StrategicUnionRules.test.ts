import { describe, expect, it } from "vitest";
import { areSameOriginFactions, canFormStrategicUnion, haveOrthogonalTerritoryAdjacency } from "./StrategicUnionRules";

describe("strategic union rules", () => {
  it("recognizes recorded sibling-split and parent-child origins, but not similar initial factions", () => {
    expect(areSameOriginFactions(
      { name: "split-a", origin: { type: "SPLIT", parentFactionId: "parent" } },
      { name: "split-b", origin: { type: "REBEL", parentFactionId: "parent" } },
    )).toBe(true);
    expect(areSameOriginFactions(
      { name: "child", origin: { type: "REBEL", parentFactionId: "parent" } },
      { name: "parent", origin: { type: "INITIAL" } },
    )).toBe(true);
    expect(areSameOriginFactions(
      { name: "qin", origin: { type: "INITIAL" } },
      { name: "chu", origin: { type: "INITIAL" } },
    )).toBe(false);
  });

  it("uses orthogonal territory edges, not diagonal contact", () => {
    expect(haveOrthogonalTerritoryAdjacency([{ x: 0, y: 0 }], [{ x: 1, y: 0 }])).toBe(true);
    expect(haveOrthogonalTerritoryAdjacency([{ x: 0, y: 0 }], [{ x: 1, y: 1 }])).toBe(false);
  });

  it("requires long alliance, adjacency, same origin, strength asymmetry, and a real pressure trigger", () => {
    const qualifies = {
      sameOrigin: true, bothActive: true, allianceMonths: 72, adjacent: true,
      bilateralWarFreeMonths: 60, weakerTerritoryShare: 12, strongerTerritoryShare: 30,
      weakerCityCount: 1, strongerCityCount: 3, weakerStability: 60,
      commonThreatStillRelevant: true,
    };
    expect(canFormStrategicUnion(qualifies)).toBe(true);
    expect(canFormStrategicUnion({ ...qualifies, adjacent: false })).toBe(false);
    expect(canFormStrategicUnion({ ...qualifies, sameOrigin: false })).toBe(false);
    expect(canFormStrategicUnion({ ...qualifies, allianceMonths: 59 })).toBe(false);
    expect(canFormStrategicUnion({ ...qualifies, weakerTerritoryShare: 20, strongerTerritoryShare: 30, weakerCityCount: 3, strongerCityCount: 3 })).toBe(false);
    expect(canFormStrategicUnion({ ...qualifies, commonThreatStillRelevant: false })).toBe(false);
    expect(canFormStrategicUnion({ ...qualifies, weakerTerritoryShare: 5, weakerCityCount: 1, weakerStability: 30, commonThreatStillRelevant: false })).toBe(true);
  });
});
