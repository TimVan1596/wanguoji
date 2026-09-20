import { describe, expect, it } from "vitest";
import {
  canCreateFallbackSuccessor,
  canInheritInExile,
  canRestoreExiledFaction,
  decayExileLegitimacy,
  decayRemnantPopulation,
  shouldCreateActiveHeir,
  shouldExileBecomeExtinct,
} from "./ExileRules";

describe("exile rules", () => {
  it("forbids creating random successors for EXILED factions", () => {
    expect(canCreateFallbackSuccessor("ACTIVE")).toBe(true);
    expect(canCreateFallbackSuccessor("EXILED")).toBe(false);
    expect(canCreateFallbackSuccessor("EXTINCT")).toBe(false);
  });

  it("does not create new heirs after exile begins", () => {
    expect(shouldCreateActiveHeir("ACTIVE")).toBe(true);
    expect(shouldCreateActiveHeir("EXILED")).toBe(false);
    expect(shouldCreateActiveHeir("EXTINCT")).toBe(false);
  });

  it("allows exiled succession only with an existing heir", () => {
    expect(canInheritInExile(true)).toBe(true);
    expect(canInheritInExile(false)).toBe(false);
  });

  it("marks the final claimant line as extinct when no remnants and no claimant remain", () => {
    expect(shouldExileBecomeExtinct(0, 0, false)).toBe(true);
    expect(shouldExileBecomeExtinct(1, 0, false)).toBe(false);
    expect(shouldExileBecomeExtinct(0, 0, true)).toBe(false);
  });

  it("reduces remnant population slowly", () => {
    expect(decayRemnantPopulation(5)).toBe(4);
    expect(decayRemnantPopulation(1)).toBe(0);
  });

  it("reduces exile legitimacy more slowly with more remnants", () => {
    expect(decayExileLegitimacy(70, 0, 4)).toBe(66);
    expect(decayExileLegitimacy(70, 12, 4)).toBe(69);
  });

  it("requires remnants, claimant, and legitimacy for restoration", () => {
    expect(canRestoreExiledFaction(4, true, 63)).toBe(true);
    expect(canRestoreExiledFaction(0, true, 63)).toBe(false);
    expect(canRestoreExiledFaction(4, false, 63)).toBe(false);
    expect(canRestoreExiledFaction(4, true, 0)).toBe(false);
  });
});
