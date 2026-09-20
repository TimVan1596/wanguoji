import { describe, expect, it } from "vitest";
import {
  createPopulationTicks,
  createTimeTicks,
  normalizeMarkerEvents,
  TERRITORY_TICKS,
} from "./TrendChartRules";
import type { FactionSnapshot } from "./FactionSnapshots";
import type { WorldEvent } from "../History/WorldHistory";

function snapshot(year: number, population = 0): FactionSnapshot {
  return {
    year,
    population,
    absoluteTerritoryShare: 0,
    controlledTerritoryShare: 0,
    territoryShare: 0,
    cityCount: 1,
    stability: 60,
  };
}

function event(year: number): WorldEvent {
  return {
    id: String(year),
    year,
    monthIndex: year,
    category: "politics",
    type: "state-founded",
    title: "建国",
    importance: "major",
  };
}

describe("trend chart rules", () => {
  it("creates readable time ticks across the snapshot range", () => {
    expect(createTimeTicks([snapshot(120), snapshot(240), snapshot(360)])).toEqual([
      120,
      240,
      360,
    ]);
  });

  it("creates nice population ticks from zero", () => {
    expect(createPopulationTicks([13, 82, 177])).toEqual([0, 50, 100, 150, 200]);
  });

  it("uses fixed territory ticks", () => {
    expect(TERRITORY_TICKS).toEqual([0, 25, 50, 75, 100]);
  });

  it("keeps marker events inside the snapshot time range", () => {
    expect(
      normalizeMarkerEvents([event(50), event(120), event(240)], [
        snapshot(100),
        snapshot(200),
      ]).map((item) => item.year)
    ).toEqual([120]);
  });
});
