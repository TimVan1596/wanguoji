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

  it("does not reuse archived city names in the same world session", () => {
    CityNameRegistry.reserve("武陵", "archived-city", 12);
    const generated = CityNameRegistry.allocateCityName("武陵", "new-city", 120);
    expect(generated).not.toBe("武陵");
  });

  it("clears reserved names on new world reset", () => {
    CityNameRegistry.reserve("安邑", "city-a", 0);
    CityNameRegistry.reset();
    expect(CityNameRegistry.isAvailable("安邑")).toBe(true);
  });
});
