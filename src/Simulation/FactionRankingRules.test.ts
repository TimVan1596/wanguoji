import { describe, expect, it } from "vitest";
import {
  getActiveRankingFactions,
  getFactionStatusSummary,
} from "./FactionRankingRules";

function faction(name: string, status: string, territory: number) {
  return {
    name,
    status,
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

  it("counts active, exiled, and extinct factions for the summary", () => {
    expect(
      getFactionStatusSummary([
        faction("秦", "ACTIVE", 5),
        faction("赵", "EXILED", 0),
        faction("韩", "EXTINCT", 0),
        faction("楚", "ACTIVE", 12),
      ])
    ).toEqual({ active: 2, exiled: 1, extinct: 1 });
  });
});
