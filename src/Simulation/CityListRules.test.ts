import { describe, expect, it } from "vitest";
import { getVisibleCities } from "./CityListRules";

const cities = [
  {
    id: "archived",
    name: "废城",
    ownerFactionId: "秦",
    isCapital: false,
    defense: 0,
    maxDefense: 0,
    loyalty: 0,
    devastation: 100,
    underSiege: false,
    destroyed: true,
  },
  {
    id: "xianyang",
    name: "咸阳",
    ownerFactionId: "秦",
    isCapital: true,
    defense: 8,
    maxDefense: 9,
    loyalty: 91,
    devastation: 4,
    underSiege: false,
  },
  {
    id: "daliang",
    name: "大梁",
    ownerFactionId: "燕",
    isCapital: false,
    defense: 4,
    maxDefense: 7,
    loyalty: 28,
    devastation: 62,
    underSiege: true,
  },
];

describe("city list rules", () => {
  it("does not include archived or destroyed cities in active lists", () => {
    expect(getVisibleCities(cities, "all").map((city) => city.id)).toEqual([
      "xianyang",
      "daliang",
    ]);
  });

  it("filters city list by state", () => {
    expect(getVisibleCities(cities, "capital").map((city) => city.name)).toEqual([
      "咸阳",
    ]);
    expect(getVisibleCities(cities, "siege").map((city) => city.name)).toEqual([
      "大梁",
    ]);
    expect(getVisibleCities(cities, "abnormal").map((city) => city.name)).toEqual([
      "大梁",
    ]);
  });
});
