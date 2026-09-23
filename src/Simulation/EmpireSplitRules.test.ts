import { describe, expect, it } from "vitest";
import {
  selectSplitCities,
  selectSplitCore,
  shouldRestoreBeforeNewRebel,
} from "./EmpireSplitRules";

const capital = { name: "都城", loyalty: 5, isCapital: true, block: { x: 0, y: 0 } };
const low = { name: "低忠城", loyalty: 18, isCapital: false, block: { x: 10, y: 0 } };
const near = { name: "近城", loyalty: 40, isCapital: false, block: { x: 12, y: 0 } };
const far = { name: "远城", loyalty: 41, isCapital: false, block: { x: 80, y: 0 } };

describe("empire split rules", () => {
  it("does not select capital as first split core when alternatives exist", () => {
    expect(selectSplitCore([capital, low])?.name).toBe("低忠城");
  });

  it("selects nearby owned cities into a split region", () => {
    expect(selectSplitCities(low, [capital, low, far, near], 3).map((city) => city.name)).toEqual([
      "低忠城",
      "近城",
    ]);
  });

  it("keeps the core, excludes distant cities, and respects the city limit", () => {
    expect(selectSplitCities(low, [capital, low, near, far], 1).map((city) => city.name)).toEqual(["低忠城"]);
    expect(selectSplitCities(low, [capital, low, near, far], 3).some((city) => city.name === "都城")).toBe(false);
    expect(selectSplitCities(low, [capital, low, near, far], 3).some((city) => city.name === "远城")).toBe(false);
  });

  it("prioritizes restoration over a new rebel faction", () => {
    expect(shouldRestoreBeforeNewRebel(true, "EXILED")).toBe(true);
    expect(shouldRestoreBeforeNewRebel(false, "EXILED")).toBe(false);
  });
});
