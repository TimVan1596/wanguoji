import { describe, expect, it } from "vitest";
import { calculateTerritoryMetrics } from "./TerritoryMetrics";

function team(name: string, blocks: number, status = "ACTIVE") {
  return {
    name,
    status,
    blocks: { children: { size: blocks } },
  } as any;
}

describe("TerritoryMetrics", () => {
  it("reports seven equal factions as roughly one seventh of controlled territory", () => {
    const teams = Array.from({ length: 7 }, (_, index) =>
      team(`f${index}`, 10)
    );
    const metrics = calculateTerritoryMetrics(teams, 1000);
    expect(metrics.byFactionId.get("f0")?.controlledTerritoryShare).toBeCloseTo(
      100 / 7,
      4
    );
  });

  it("keeps neutral blocks out of the controlled denominator", () => {
    const metrics = calculateTerritoryMetrics(
      [team("qin", 20), team("chu", 10)],
      1000
    );
    expect(metrics.controlledBlocks).toBe(30);
    expect(metrics.neutralBlocks).toBe(970);
    expect(metrics.byFactionId.get("qin")?.absoluteWorldShare).toBe(2);
    expect(metrics.byFactionId.get("qin")?.controlledTerritoryShare).toBeCloseTo(
      66.666,
      2
    );
  });

  it("excludes extinct faction land from the active controlled denominator", () => {
    const metrics = calculateTerritoryMetrics(
      [team("qin", 20), team("han", 80, "EXTINCT")],
      100
    );
    expect(metrics.controlledBlocks).toBe(20);
    expect(metrics.byFactionId.get("qin")?.controlledTerritoryShare).toBe(100);
    expect(metrics.byFactionId.get("han")?.controlledTerritoryShare).toBe(0);
  });

  it("includes active provisional land in the political denominator", () => {
    const metrics = calculateTerritoryMetrics(
      [team("qin", 30), team("rebel", 10)],
      100
    );
    expect(metrics.controlledBlocks).toBe(40);
    expect(metrics.byFactionId.get("rebel")?.controlledTerritoryShare).toBe(25);
  });
});
