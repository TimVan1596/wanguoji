import { describe, expect, it } from "vitest";
import { createCityName, isForbiddenCityName } from "./CityNameGenerator";

describe("city name generator", () => {
  it("avoids duplicate active and archived city names", () => {
    expect(["安邑", "平阳"]).not.toContain(createCityName(["安邑", "平阳"]));
    expect(["安邑", "平阳", "武陵"]).not.toContain(
      createCityName(["安邑", "平阳", "武陵"])
    );
  });

  it("never returns numeric placeholder city names", () => {
    const used = [
      "安邑",
      "平阳",
      "武陵",
      "河阳",
      "晋阳",
      "广陵",
      "南阳",
      "安陵",
      "平陵",
      "武安",
    ];
    const name = createCityName(used);
    expect(name).not.toMatch(/^新城\d+$/);
    expect(name).not.toMatch(/^City-?\d+$/i);
    expect(isForbiddenCityName("新城6")).toBe(true);
  });

  it("uses recent suffix cooldown to reduce repeated morphology", () => {
    const name = createCityName(["安邑", "平阳", "武陵"], [
      "清阳",
      "河阳",
      "晋阳",
    ]);
    expect(name.endsWith("阳")).toBe(false);
  });

  it("keeps deterministic diversity across a larger generated set", () => {
    const used: string[] = [];
    for (let i = 0; i < 30; i++) {
      const name = createCityName(used, used.slice(-12));
      used.push(name);
    }
    const suffixes = new Set(used.map((name) => name.slice(-1)));
    expect(suffixes.size).toBeGreaterThanOrEqual(12);
    expect(used.filter((name) => /[陵阳平]$/.test(name)).length).toBeLessThan(18);
  });
});
