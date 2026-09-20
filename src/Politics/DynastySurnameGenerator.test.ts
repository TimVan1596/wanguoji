import { describe, expect, it } from "vitest";
import {
  createRuntimeDynastyHouseName,
  getRuntimeDynastySurnamePools,
} from "./DynastySurnameGenerator";

describe("dynasty surname generator", () => {
  it("provides a broad runtime surname pool", () => {
    const pools = getRuntimeDynastySurnamePools();
    expect(pools.singleSurnames.length).toBeGreaterThanOrEqual(50);
    expect(pools.compoundSurnames.length).toBeGreaterThanOrEqual(6);
  });

  it("prefers unused and non-recent surnames deterministically", () => {
    const name = createRuntimeDynastyHouseName({
      factionType: "REBEL",
      existingHouseNames: ["刘氏", "陈氏", "杨氏"],
      recentHouseNames: ["李氏"],
      pickIndex: () => 0,
      compoundRoll: () => 100,
    });
    expect(name).toBe("王氏");
  });

  it("can generate compound surnames without suffix numbers", () => {
    const name = createRuntimeDynastyHouseName({
      factionType: "SPLIT",
      pickIndex: () => 2,
      compoundRoll: () => 1,
    });
    expect(name).toBe("欧阳氏");
    expect(name).not.toMatch(/\d/);
  });

  it("keeps seeded diversity across many runtime dynasties", () => {
    const used: string[] = [];
    for (let index = 0; index < 40; index += 1) {
      const name = createRuntimeDynastyHouseName({
        factionType: "REBEL",
        existingHouseNames: used,
        recentHouseNames: used.slice(-20),
        pickIndex: (max) => index % max,
        compoundRoll: () => (index % 7 === 0 ? 1 : 100),
      });
      used.push(name);
    }
    expect(new Set(used).size).toBeGreaterThanOrEqual(32);
  });
});
