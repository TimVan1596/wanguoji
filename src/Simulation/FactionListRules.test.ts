import { describe, expect, it } from "vitest";
import { getVisibleFactions } from "./FactionListRules";

describe("faction list rules", () => {
  const factions = [
    { name: "秦", status: "ACTIVE" as const },
    {
      name: "齐",
      status: "EXILED" as const,
      identityStage: "STATE" as const,
      stateFoundedMonth: 0,
    },
    {
      name: "梁",
      status: "EXTINCT" as const,
      identityStage: "STATE" as const,
      stateFoundedMonth: 72,
    },
    {
      name: "新郑义军",
      status: "EXTINCT" as const,
      identityStage: "PROVISIONAL" as const,
    },
  ];

  it("filters factions by lifecycle status", () => {
    expect(getVisibleFactions(factions, "all").map((faction) => faction.name)).toEqual([
      "秦",
      "齐",
      "梁",
    ]);
    expect(getVisibleFactions(factions, "active").map((faction) => faction.name)).toEqual([
      "秦",
    ]);
    expect(getVisibleFactions(factions, "exiled").map((faction) => faction.name)).toEqual([
      "齐",
    ]);
    expect(getVisibleFactions(factions, "extinct").map((faction) => faction.name)).toEqual([
      "梁",
    ]);
  });
});
