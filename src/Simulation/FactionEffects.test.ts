import { describe, expect, it } from "vitest";
import FactionEffects from "./FactionEffects";

describe("faction effects", () => {
  it("expires succession effects by month", () => {
    FactionEffects.reset();
    FactionEffects.addSuccessionEffect("秦", 10, {
      level: "succession-shock",
      durationYears: 8,
      loyaltyRecoveryMultiplier: 0.8,
      rebellionRiskMultiplier: 1.15,
      recentSuccessionCount: 1,
    });
    expect(FactionEffects.getEffects("秦")).toHaveLength(1);
    FactionEffects.update(17);
    expect(FactionEffects.getEffects("秦")).toHaveLength(1);
    FactionEffects.update(18);
    expect(FactionEffects.getEffects("秦")).toHaveLength(0);
  });

  it("stores and clears strategic siege/capture modifiers", () => {
    FactionEffects.reset();
    FactionEffects.setStrategicModifier("秦", {
      siegeMultiplier: 1.1,
      captureLoyaltyBonus: 6,
    });
    expect(FactionEffects.getSiegeMultiplier("秦")).toBe(1.1);
    expect(FactionEffects.getCaptureLoyaltyBonus("秦")).toBe(6);
    FactionEffects.reset();
    expect(FactionEffects.getSiegeMultiplier("秦")).toBe(1);
    expect(FactionEffects.getCaptureLoyaltyBonus("秦")).toBe(0);
  });
});
