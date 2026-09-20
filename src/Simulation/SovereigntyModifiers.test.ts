import { describe, expect, it } from "vitest";
import { calculateImperialStrain } from "./ImperialStrain";
import {
  getEffectiveStability,
  getExileLegitimacyDecayMultiplier,
  getRestorationWeightMultiplier,
  getSuccessionShockMultiplier,
} from "./SovereigntyModifiers";

function createTeam(loyalty: number) {
  const capital = { block: { x: 0, y: 0 }, loyalty, isCapital: true };
  return {
    sovereigntyRank: "EMPEROR",
    users: { size: 20 },
    blocks: { children: { size: 760 } },
    cities: [
      capital,
      { block: { x: 160, y: 0 }, loyalty, isCapital: false },
      { block: { x: 240, y: 0 }, loyalty, isCapital: false },
      { block: { x: 320, y: 0 }, loyalty, isCapital: false },
      { block: { x: 400, y: 0 }, loyalty, isCapital: false },
      { block: { x: 480, y: 0 }, loyalty, isCapital: false },
    ],
    capitalCity: capital,
  } as any;
}

describe("sovereignty modifiers", () => {
  it("adds a small effective stability bonus for emperors only", () => {
    expect(getEffectiveStability(58, "EMPEROR")).toBe(66);
    expect(getEffectiveStability(99, "EMPEROR")).toBe(100);
    expect(getEffectiveStability(58, "KING")).toBe(58);
  });

  it("does not feed emperor bonus into imperial strain base stability", () => {
    const team = createTeam(55);
    const strain = calculateImperialStrain(team, 1000, 120);
    team.sovereigntyRank = "KING";
    expect(calculateImperialStrain(team, 1000, 120)).toBe(strain);
  });

  it("slows emperor exile decay and increases restoration weight", () => {
    expect(getExileLegitimacyDecayMultiplier("EMPEROR")).toBeLessThan(1);
    expect(getRestorationWeightMultiplier("EMPEROR")).toBeGreaterThan(1);
    expect(getSuccessionShockMultiplier("EMPEROR")).toBeLessThan(1);
  });
});
