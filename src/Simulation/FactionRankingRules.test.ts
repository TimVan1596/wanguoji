import { describe, expect, it } from "vitest";
import {
  getActiveRankingFactions,
  getFactionStatusSummary,
} from "./FactionRankingRules";

function faction(name: string, status: string, territory: number) {
  return {
    name,
    status,
    stateFoundedMonth: name === "秦" ? 0 : undefined,
    blocks: {
      children: {
        size: territory,
      },
    },
  };
}

describe("faction ranking rules", () => {
  it("keeps only active factions in the current ranking", () => {
    const ranked = getActiveRankingFactions([
      faction("秦", "ACTIVE", 5),
      faction("赵", "EXILED", 20),
      faction("韩", "EXTINCT", 30),
      faction("楚", "ACTIVE", 12),
    ]);
    expect(ranked.map((item) => item.name)).toEqual(["楚", "秦"]);
  });

  it("counts only founded states as nations and active unfounded factions as provisional", () => {
    expect(
      getFactionStatusSummary([
        faction("秦", "ACTIVE", 5),
        faction("赵", "EXILED", 0),
        faction("韩", "EXTINCT", 0),
        faction("楚", "ACTIVE", 12),
      ])
    ).toEqual({ active: 1, exiled: 0, extinct: 0, provisionalActive: 1 });
  });

  it("counts founded rebel factions as states and omits extinct provisional factions", () => {
    expect(getFactionStatusSummary([
      { status: "ACTIVE", stateFoundedMonth: 10 },
      { status: "EXILED", stateFoundedMonth: 20 },
      { status: "EXTINCT", stateFoundedMonth: 30 },
      { status: "ACTIVE" },
      { status: "EXTINCT" },
    ])).toEqual({ active: 1, exiled: 1, extinct: 1, provisionalActive: 1 });
  });
});
