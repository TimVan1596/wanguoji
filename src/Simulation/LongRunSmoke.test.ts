import { describe, expect, it } from "vitest";
import { canDestroyCity, getCaptureDevastationIncrease, recoverDevastation } from "./CityLifecycle";
import { createCityName } from "./CityNameGenerator";
import { selectSplitCities, selectSplitCore } from "./EmpireSplitRules";
import { RuntimeFactionRegistry } from "./RuntimeFactionRegistry";
import { getWorldPhase } from "./WorldPhase";

interface SmokeFaction {
  name: string;
}

interface SmokeCity {
  name: string;
  loyalty: number;
  isCapital: boolean;
  block: { x: number; y: number };
  devastation: number;
}

describe("long run simulation smoke", () => {
  it("runs a lightweight political cycle for 1000 months without throwing", () => {
    const registry = new RuntimeFactionRegistry<SmokeFaction>();
    registry.reset(Object.freeze([{ name: "秦" }, { name: "楚" }, { name: "齐" }]));
    const cities: SmokeCity[] = [
      { name: "咸阳", loyalty: 85, isCapital: true, block: { x: 0, y: 0 }, devastation: 0 },
      { name: "郢", loyalty: 80, isCapital: true, block: { x: 12, y: 0 }, devastation: 0 },
      { name: "临淄", loyalty: 82, isCapital: true, block: { x: 24, y: 0 }, devastation: 0 },
      { name: "大梁", loyalty: 38, isCapital: false, block: { x: 18, y: 8 }, devastation: 0 },
    ];

    expect(() => {
      for (let month = 0; month <= 1000; month += 1) {
        if (month === 120) {
          registry.register({ name: "大梁军" });
        }
        if (month === 240) {
          const core = selectSplitCore(cities);
          const splitCities = core ? selectSplitCities(core, cities, 2) : [];
          expect(splitCities.length).toBeGreaterThan(0);
          registry.register({ name: "临淄军" });
        }
        if (month % 60 === 0) {
          cities[3].devastation += getCaptureDevastationIncrease(24);
        }
        if (month % 12 === 0) {
          cities.forEach((city) => {
            city.devastation = recoverDevastation(city.devastation);
          });
        }
        if (month === 600) {
          const nextName = createCityName(cities.map((city) => city.name));
          cities.push({
            name: nextName,
            loyalty: 86,
            isCapital: false,
            block: { x: 32, y: 12 },
            devastation: 0,
          });
        }
        canDestroyCity(cities.length, cities[3].devastation);
        getWorldPhase(registry.size);
      }
    }).not.toThrow();

    expect(registry.size).toBeGreaterThanOrEqual(5);
    expect(cities.some((city) => city.name !== "咸阳" && city.name !== "郢")).toBe(true);
  });
});
