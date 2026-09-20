import { describe, expect, it } from "vitest";
import { areFortifiedCellsOwnedBy, shouldApplySiegeDamage } from "./SiegeRules";

describe("siege rules", () => {
  it("does not apply unlimited siege damage in the same year", () => {
    expect(shouldApplySiegeDamage(42, -1, 1)).toBe(true);
    expect(shouldApplySiegeDamage(42, 42, 1)).toBe(false);
    expect(shouldApplySiegeDamage(43, 42, 1)).toBe(true);
  });

  it("checks fortified zone owner consistency", () => {
    expect(
      areFortifiedCellsOwnedBy(
        [{ ownerFactionId: "秦" }, { ownerFactionId: "秦" }],
        "秦"
      )
    ).toBe(true);
    expect(
      areFortifiedCellsOwnedBy(
        [{ ownerFactionId: "秦" }, { ownerFactionId: "楚" }],
        "秦"
      )
    ).toBe(false);
  });
});
