import { describe, expect, it } from "vitest";
import { createStateName, createStateNameCandidates } from "./StateNameGenerator";

describe("state name generator", () => {
  it("prefers a natural single-character name from the capital", () => {
    expect(createStateName({ capitalName: "大梁" })).toBe("梁");
  });

  it("avoids active formal state name collisions without numeric suffixes", () => {
    const name = createStateName({ capitalName: "大梁" }, ["梁"]);
    expect(name).not.toBe("梁");
    expect(name).not.toMatch(/\d/);
  });

  it("prioritizes names never used in the current world session", () => {
    const name = createStateName({ capitalName: "大梁" }, [], ["梁"]);
    expect(name).not.toBe("梁");
    expect(name).not.toMatch(/\d/);
  });

  it("falls back to non-numeric expanded names when the simple pool is exhausted", () => {
    const candidates = createStateNameCandidates({ capitalName: "大梁" });
    const name = createStateName({ capitalName: "大梁" }, candidates);
    expect(name).toMatch(/^[东西南北中后新]/);
    expect(name).not.toMatch(/\d/);
  });

  it("offers a broader classical state pool beyond city suffix fallback", () => {
    const candidates = createStateNameCandidates({ capitalName: "阳陵", founderCityName: "临江" });
    expect(candidates).toEqual(expect.arrayContaining(["周", "晋", "巴", "凉", "岐", "蔡", "徐"]));
    expect(candidates.filter((name) => name === "阳" || name === "陵")).toHaveLength(2);
  });

  it("uses expanded classical names when local candidates collide", () => {
    const used = new Set(createStateNameCandidates({ capitalName: "阳陵", founderCityName: "临江" }).slice(0, 4));
    const name = createStateName({ capitalName: "阳陵", founderCityName: "临江" }, used);
    expect(name).toBe("周");
    expect(name).not.toMatch(/\d/);
  });

  it("can reuse historical names only after never-used candidates are exhausted", () => {
    const candidates = createStateNameCandidates({ capitalName: "大梁" });
    const used = new Set(candidates);
    directionalTestPrefixes().forEach((prefix) =>
      candidates.forEach((candidate) => used.add(`${prefix}${candidate}`))
    );
    const name = createStateName({ capitalName: "大梁" }, [], used);
    expect(name).toBe("梁");
  });
});

function directionalTestPrefixes() {
  return ["东", "西", "南", "北", "中", "后", "新"];
}
