import { describe, expect, it } from "vitest";
import {
  validateCityNameUniqueness,
  validateCityInteractionIndex,
  validateCityZoneMappings,
} from "./WorldInvariant";
import { CityInteractionIndex } from "./CityInteractionIndex";

function createCity(name: string, ownerFactionId = "秦") {
  const center: any = { team: { name: ownerFactionId } };
  const city = {
    name,
    ownerFactionId,
    block: center,
    fortifiedCells: [center],
  } as any;
  center["city"] = city;
  return { city, center };
}

describe("world invariant city zone mapping", () => {
  it("accepts initial city fortified cells with correct city refs", () => {
    const { city } = createCity("咸阳");
    expect(validateCityZoneMappings([city])).toEqual([]);
  });

  it("accepts zone rebuild when new cells resolve to the same city", () => {
    const { city, center } = createCity("咸阳");
    const newCell = { city, team: { name: "秦" } };
    city.fortifiedCells = [center, newCell];

    expect(validateCityZoneMappings([city])).toEqual([]);
  });

  it("keeps old cells detached after a zone shrink", () => {
    const { city, center } = createCity("咸阳");
    const staleCell = { city, team: { name: "秦" } };
    staleCell.city = undefined;
    city.fortifiedCells = [center];

    expect(validateCityZoneMappings([city])).toEqual([]);
    expect(staleCell.city).toBeUndefined();
  });

  it("reports broken fortified cell refs and owner mismatches", () => {
    const { city } = createCity("咸阳");
    city.fortifiedCells = [{ city: undefined, team: { name: "楚" } }];

    const issues = validateCityZoneMappings([city]);
    expect(issues.some((issue) => issue.includes("center block"))).toBe(true);
    expect(issues.some((issue) => issue.includes("city ref mismatch"))).toBe(true);
    expect(issues.some((issue) => issue.includes("owner mismatch"))).toBe(true);
  });

  it("reports one block assigned to two cities", () => {
    const shared: any = { team: { name: "秦" } };
    const cityA = {
      name: "咸阳",
      ownerFactionId: "秦",
      block: shared,
      fortifiedCells: [shared],
    } as any;
    const cityB = {
      name: "大梁",
      ownerFactionId: "秦",
      block: shared,
      fortifiedCells: [shared],
    } as any;
    shared["city"] = cityA;

    const issues = validateCityZoneMappings([cityA, cityB]);
    expect(issues.some((issue) => issue.includes("multiple cities"))).toBe(true);
  });

  it("validates city interaction index mappings", () => {
    const { city, center } = createCity("咸阳");
    city.id = "city-xianyang";
    center.x = 64;
    center.y = 96;
    const index = new CityInteractionIndex();
    index.registerCity(city, 32);

    expect(validateCityInteractionIndex([city], index, 32)).toEqual([]);
    index.unregisterCity("city-xianyang");
    expect(
      validateCityInteractionIndex([city], index, 32).some((issue) =>
        issue.includes("interaction index mismatch")
      )
    ).toBe(true);
  });

  it("reports stale city interaction entries", () => {
    const index = new CityInteractionIndex();
    index.registerCity(
      {
        id: "archived",
        fortifiedCells: [{ x: 32, y: 32 }],
      },
      32
    );
    expect(
      validateCityInteractionIndex([], index, 32).some((issue) =>
        issue.includes("stale city")
      )
    ).toBe(true);
  });

  it("reports duplicate active city names", () => {
    const issues = validateCityNameUniqueness(
      [
        { id: "city-a", name: "安邑", foundedYear: 0 },
        { id: "city-b", name: "安邑", foundedYear: 120 },
      ],
      []
    );
    expect(issues.some((issue) => issue.includes("duplicate city name"))).toBe(true);
  });

  it("reports active city names reused from archived cities", () => {
    const issues = validateCityNameUniqueness(
      [{ id: "city-new", name: "武陵", foundedYear: 120 }],
      [{ id: "city-old", name: "武陵", foundedMonth: 12 }]
    );
    expect(
      issues.some((issue) => issue.includes("duplicate city name with archive"))
    ).toBe(true);
  });
});
