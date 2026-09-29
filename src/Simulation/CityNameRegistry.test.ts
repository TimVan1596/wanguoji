import { beforeEach, describe, expect, it } from "vitest";
import CityNameRegistry from "./CityNameRegistry";

describe("city name registry", () => {
  beforeEach(() => {
    CityNameRegistry.reset();
  });

  it("reserves initial city names before dynamic generation", () => {
    expect(CityNameRegistry.reserve("安邑", "initial-a", 0)).toBe(true);
    const generated = CityNameRegistry.allocateCityName(undefined, "dynamic-a", 60);
    expect(generated).not.toBe("安邑");
  });

  it("normalizes and rejects duplicate candidates", () => {
    expect(CityNameRegistry.reserve(" 安 邑 ", "city-a", 0)).toBe(true);
    expect(CityNameRegistry.isAvailable("安邑")).toBe(false);
    expect(CityNameRegistry.reserve("安邑", "city-b", 12)).toBe(false);
  });

  it("throws when a different city id attempts to reserve an existing name", () => {
    CityNameRegistry.reserveForCity("郢", "city-first", 0);
    expect(() => CityNameRegistry.reserveForCity("郢", "city-second", 12))
      .toThrow('"郢" is already reserved by city-first');
  });

  it("keeps generated active city names unique and bound to their actual city ids", () => {
    const names = Array.from({ length: 30 }, (_, index) =>
      CityNameRegistry.allocateCityName(undefined, `new-city-${index}`, index)
    );
    expect(new Set(names).size).toBe(names.length);
    expect(CityNameRegistry.entries().every((entry) => entry.cityId?.startsWith("new-city-"))).toBe(true);
  });

  it("does not reuse archived city names in the same world session", () => {
    CityNameRegistry.reserve("武陵", "archived-city", 12);
    const generated = CityNameRegistry.allocateCityName("武陵", "new-city", 120);
    expect(generated).not.toBe("武陵");
  });

  it("keeps the reserved/recent registry export contract through import", () => {
    CityNameRegistry.reserve("安邑", "archived-city", 12);
    CityNameRegistry.allocateCityName(undefined, "dynamic-city", 24);
    const exported = CityNameRegistry.exportState();
    expect(Object.keys(exported).sort()).toEqual(["recentDynamicNames", "reserved"]);
    CityNameRegistry.reset();
    CityNameRegistry.importState(exported);
    expect(CityNameRegistry.isAvailable("安邑")).toBe(false);
    expect(CityNameRegistry.exportState()).toEqual(exported);
  });

  it("clears reserved names on new world reset", () => {
    CityNameRegistry.reserve("安邑", "city-a", 0);
    CityNameRegistry.reset();
    expect(CityNameRegistry.isAvailable("安邑")).toBe(true);
  });
});
