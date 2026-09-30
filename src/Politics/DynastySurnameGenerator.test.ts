import { describe, expect, it } from "vitest";
import {
  createRuntimeDynastyHouseName,
  createSuccessorDynastyHouseName,
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

  it("can inject a rare minority culture clan", () => {
    expect(createRuntimeDynastyHouseName({ factionType: "REBEL", cultureRoll: () => 1, pickIndex: () => 0 })).toBe("耶律氏");
  });

  it("creates formal new houses from the surname generator, never from faction identity", () => {
    const name = createSuccessorDynastyHouseName({
      factionType: "STATE",
      existingHouseNames: ["王氏", "刘氏"],
      recentHouseNames: ["刘氏", "陈氏", "杨氏"],
      compoundRoll: () => 100,
      cultureRoll: () => 100,
      pickIndex: () => 0,
    });
    expect(name).toBe("张氏");
    expect(name).not.toMatch(/义军|东义军|固氏|龙编/);
  });

  it("uses actual recent houses, not only leader-successor entries, for reuse avoidance", () => {
    const name = createSuccessorDynastyHouseName({
      factionType: "STATE",
      existingHouseNames: ["王氏", "李氏"],
      recentHouseNames: ["刘氏"],
      compoundRoll: () => 100,
      cultureRoll: () => 100,
      pickIndex: () => 0,
    });
    expect(name).not.toBe("刘氏");
  });
});
