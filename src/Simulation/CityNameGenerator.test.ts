import { describe, expect, it } from "vitest";
import {
  CITY_NAME_CATEGORY_WEIGHTS,
  createCityName,
  createCityNameCandidates,
  getCityNameCandidateWeight,
  isForbiddenCityName,
} from "./CityNameGenerator";

function seededRng(seed: number) {
  let state = seed;
  return (maxExclusive: number) => {
    state = (state * 48271) % 2_147_483_647;
    return Math.floor((state / 2_147_483_647) * maxExclusive);
  };
}

describe("city name generator", () => {
  it("repeats exactly with the same injected random sequence", () => {
    const generate = (seed: number) => {
      const used = ["咸阳", "邯郸", "蓟", "临淄", "大梁", "新郑", "郢"];
      const rng = seededRng(seed);
      return Array.from({ length: 20 }, () => {
        const name = createCityName(used, used.slice(-15), rng);
        used.push(name);
        return name;
      });
    };
    expect(generate(1729)).toEqual(generate(1729));
  });

  it("does not always choose the first curated candidate", () => {
    const firstBiased = createCityName([], [], () => 0);
    const otherDraw = createCityName([], [], () => 900_000);
    expect(firstBiased).not.toBe(otherDraw);
  });

  it("allows different injected rolls to produce different first dynamic names", () => {
    expect(createCityName([], [], () => 1)).not.toBe(createCityName([], [], () => 700_000));
  });

  it("avoids duplicate active and archived city names", () => {
    expect(["安邑", "平阳"]).not.toContain(createCityName(["安邑", "平阳"], [], () => 0));
    expect(["安邑", "平阳", "武陵"]).not.toContain(
      createCityName(["安邑", "平阳", "武陵"], [], () => 0)
    );
  });

  it("never returns numeric placeholder city names", () => {
    const used: string[] = [];
    const rng = seededRng(991);
    for (let i = 0; i < 80; i++) {
      const name = createCityName(used, used.slice(-15), rng);
      expect(isForbiddenCityName(name)).toBe(false);
      used.push(name);
    }
  });

  it("softly reduces recent suffix and morphology repetition", () => {
    const candidate = createCityNameCandidates().find(({ name }) => name === "清阳")!;
    const freshWeight = getCityNameCandidateWeight(candidate, [], []);
    const recentWeight = getCityNameCandidateWeight(candidate, [], ["河阳", "晋阳"]);
    expect(recentWeight).toBeLessThan(freshWeight);
    expect(recentWeight).toBeGreaterThan(0);
  });

  it("applies a soft candidate-family penalty", () => {
    const candidate = { name: "清津", category: "GENERATED" as const, family: "river", baseWeight: 1 };
    const freshWeight = getCityNameCandidateWeight(candidate, [], []);
    const familyRecentWeight = getCityNameCandidateWeight(candidate, [], ["河津"]);
    expect(familyRecentWeight).toBeLessThan(freshWeight);
    expect(familyRecentWeight).toBeGreaterThan(0);
  });

  it("weights historical city names above generated and regional candidates", () => {
    const candidates = createCityNameCandidates();
    const city = candidates.find(({ name }) => name === "长安")!;
    const regional = candidates.find(({ name }) => name === "巴郡")!;
    const generated = candidates.find(({ category }) => category === "GENERATED")!;
    expect(city.category).toBe("HISTORICAL_CITY");
    expect(regional.category).toBe("HISTORICAL_REGIONAL");
    expect(city.baseWeight).toBeGreaterThan(generated.baseWeight);
    expect(regional.baseWeight).toBeLessThan(city.baseWeight);
    expect(CITY_NAME_CATEGORY_WEIGHTS.HISTORICAL_CITY).toBeGreaterThan(CITY_NAME_CATEGORY_WEIGHTS.GENERATED);
    expect(CITY_NAME_CATEGORY_WEIGHTS.HISTORICAL_REGIONAL).toBeLessThan(CITY_NAME_CATEGORY_WEIGHTS.HISTORICAL_CITY);
    expect(candidates.filter(({ category }) => category === "HISTORICAL_CITY").length).toBeGreaterThanOrEqual(120);
    expect(candidates.length).toBeGreaterThan(500);
  });

  it("softly downweights known aliases without banning them", () => {
    const candidates = createCityNameCandidates();
    const bianliang = candidates.find(({ name }) => name === "汴梁")!;
    const freshWeight = getCityNameCandidateWeight(bianliang, [], []);
    const aliasUsedWeight = getCityNameCandidateWeight(bianliang, ["大梁"], []);
    expect(aliasUsedWeight).toBeLessThan(freshWeight);
    expect(aliasUsedWeight).toBeGreaterThan(0);
    expect(getCityNameCandidateWeight(candidates.find(({ name }) => name === "开封")!, ["大梁"], []))
      .toBeLessThan(freshWeight);
  });

  it("keeps generated diversity across a larger allocation sequence", () => {
    const used: string[] = [];
    const rng = seededRng(2026);
    for (let i = 0; i < 30; i++) {
      used.push(createCityName(used, used.slice(-12), rng));
    }
    const suffixes = new Set(used.map((name) => [...name].at(-1)));
    expect(suffixes.size).toBeGreaterThanOrEqual(12);
    expect(used.filter((name) => /[陵阳平]$/.test(name)).length).toBeLessThan(18);
  });
});
