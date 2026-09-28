import { describe, expect, it } from "vitest";
import { cultureGivenNamePools } from "./NameCulture";
import { pickRulerGivenName } from "./SuccessionRules";
import { createRuntimeDynastyHouseName } from "./DynastySurnameGenerator";

describe("name culture generation", () => {
  it("uses atomic non-HAN given names without clan duplication", () => {
    const cases = [
      ["耶律", cultureGivenNamePools.KHITAN],
      ["完颜", cultureGivenNamePools.JURCHEN],
      ["孛儿只斤", cultureGivenNamePools.MONGOL],
      ["爱新觉罗", cultureGivenNamePools.MANCHU],
    ] as const;
    cases.forEach(([clan, pool]) => {
      const givenName = pickRulerGivenName(pool, [], () => 0);
      expect(givenName).not.toContain(clan);
      expect(`${clan}${givenName}`).not.toContain(`${clan}${clan}`);
    });
  });

  it("forces an explicitly selected minority culture clan", () => {
    expect(createRuntimeDynastyHouseName({ factionType: "REBEL", culture: "KHITAN", pickIndex: () => 0 })).toBe("耶律氏");
    expect(createRuntimeDynastyHouseName({ factionType: "REBEL", culture: "MONGOL", pickIndex: () => 0 })).toBe("孛儿只斤氏");
  });

  it("keeps automatic minority culture selection injectable and rare by contract", () => {
    expect(createRuntimeDynastyHouseName({ factionType: "REBEL", cultureRoll: () => 100, compoundRoll: () => 100, pickIndex: () => 0 })).toBe("刘氏");
    expect(createRuntimeDynastyHouseName({ factionType: "REBEL", cultureRoll: () => 1, pickIndex: () => 1 })).toBe("完颜氏");
  });
});
