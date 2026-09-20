import { describe, expect, it } from "vitest";
import {
  CONSOLIDATION_CAP_MONTH,
  CONSOLIDATION_LEADER_SIEGE_MULTIPLIER_CAP,
  CONSOLIDATION_LEADER_START_FRAGMENTATION_MONTH,
  CONSOLIDATION_START_MONTH,
  DYNASTIC_FATIGUE_CAP_MONTH,
  DYNASTIC_FATIGUE_START_MONTH,
  FATIGUE_STRAIN_MULTIPLIER,
  HEGEMONIC_MOMENTUM_CAP_MONTHS,
  HEGEMONIC_MOMENTUM_START_MONTHS,
  HEGEMONIC_SIEGE_MULTIPLIER_CAP,
  UNIFIED_GRACE_END_MONTH,
  UNIFIED_GRACE_MONTH,
  createInitialWorldCycleState,
  getConsolidationImperialStrainMultiplier,
  getConsolidationPressure,
  getConsolidationRebellionChanceMultiplier,
  getDynasticFatigueMultiplier,
  getDynasticGraceMultiplier,
  getHegemonicCaptureLoyaltyBonus,
  getHegemonicSiegeMultiplier,
  getLeadingConsolidationFaction,
  getUnifiedImperialStrainMultiplier,
  getUnifiedRebellionChanceMultiplier,
  getWorldCycleDiagnostics,
  observeDynasticOrder,
  observeHegemonicMomentum,
  recordWorldFragmented,
  recordWorldUnified,
} from "./WorldCycleRules";

function team(overrides: Record<string, unknown>) {
  return {
    name: "team",
    status: "ACTIVE",
    identityStage: "STATE",
    sovereigntyRank: "KING",
    ...overrides,
  } as any;
}

describe("world cycle rules", () => {
  it("keeps fragmentation pressure at zero before 40 years", () => {
    expect(getConsolidationPressure(CONSOLIDATION_START_MONTH - 1)).toBe(0);
    expect(
      getWorldCycleDiagnostics(createInitialWorldCycleState(0), 40 * 12 - 1)
        .stage
    ).toBe("FRAGMENTED");
  });

  it("ramps consolidation pressure between 40 and 80 years", () => {
    const mid = getConsolidationPressure(
      (CONSOLIDATION_START_MONTH + CONSOLIDATION_CAP_MONTH) / 2
    );
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("caps consolidation pressure after 80 years", () => {
    expect(getConsolidationPressure(CONSOLIDATION_CAP_MONTH + 120)).toBe(1);
  });

  it("only grants consolidation leadership to stable formal frontrunners", () => {
    expect(
      getLeadingConsolidationFaction([
        { team: team({ identityStage: "PROVISIONAL" }), territoryShare: 50, stability: 90 },
      ])
    ).toBeUndefined();
    expect(
      getLeadingConsolidationFaction([
        { team: team({ name: "minor" }), territoryShare: 20, stability: 90 },
        { team: team({ name: "second" }), territoryShare: 18, stability: 90 },
      ])
    ).toBeUndefined();
    expect(
      getLeadingConsolidationFaction([
        { team: team({ name: "qin" }), territoryShare: 38, stability: 75 },
        { team: team({ name: "chu" }), territoryShare: 25, stability: 70 },
      ])
    ).toBe("qin");
  });

  it("records authoritative unification as early dynasty grace", () => {
    const state = recordWorldUnified(createInitialWorldCycleState(0), 100);
    const diagnostics = getWorldCycleDiagnostics(state, 100 + 12);
    expect(diagnostics.stage).toBe("UNIFIED_EARLY");
    expect(diagnostics.unifiedAge).toBe(12);
  });

  it("lowers early unified imperial strain without disabling unrest", () => {
    expect(getUnifiedImperialStrainMultiplier(12)).toBeLessThan(1);
    expect(getUnifiedRebellionChanceMultiplier(12)).toBeGreaterThan(0);
  });

  it("smoothly releases grace after 50 years", () => {
    expect(getDynasticGraceMultiplier(UNIFIED_GRACE_MONTH - 1)).toBeLessThan(1);
    const mid = getDynasticGraceMultiplier(
      (UNIFIED_GRACE_MONTH + UNIFIED_GRACE_END_MONTH) / 2
    );
    expect(mid).toBeGreaterThan(getDynasticGraceMultiplier(UNIFIED_GRACE_MONTH));
    expect(mid).toBeLessThan(1);
    expect(getDynasticGraceMultiplier(UNIFIED_GRACE_END_MONTH + 1)).toBe(1);
  });

  it("starts and caps dynastic fatigue after mature unification", () => {
    expect(getDynasticFatigueMultiplier(DYNASTIC_FATIGUE_START_MONTH - 1)).toBe(1);
    const mid = getDynasticFatigueMultiplier(
      (DYNASTIC_FATIGUE_START_MONTH + DYNASTIC_FATIGUE_CAP_MONTH) / 2
    );
    expect(mid).toBeGreaterThan(1);
    expect(mid).toBeLessThan(FATIGUE_STRAIN_MULTIPLIER);
    expect(getDynasticFatigueMultiplier(DYNASTIC_FATIGUE_CAP_MONTH + 1)).toBe(
      FATIGUE_STRAIN_MULTIPLIER
    );
  });

  it("does not encode a hard forced split at 100 years", () => {
    const state = recordWorldUnified(createInitialWorldCycleState(0), 0);
    const diagnostics = getWorldCycleDiagnostics(state, 120 * 12);
    expect(diagnostics.stage).toBe("DYNASTIC_FATIGUE");
    expect(diagnostics.dynasticFatigueMultiplier).toBeGreaterThan(1);
    expect(diagnostics.dynasticFatigueMultiplier).toBeLessThanOrEqual(
      FATIGUE_STRAIN_MULTIPLIER
    );
  });

  it("allows very stable dynasties to exceed 100 years by returning modifiers only", () => {
    const multiplier = getUnifiedImperialStrainMultiplier(130 * 12);
    expect(multiplier).toBeGreaterThan(1);
    expect(multiplier).toBeLessThanOrEqual(FATIGUE_STRAIN_MULTIPLIER);
  });

  it("resets fragmentation age after empire split", () => {
    const unified = recordWorldUnified(createInitialWorldCycleState(0), 240);
    const fragmented = recordWorldFragmented(unified, 360);
    const diagnostics = getWorldCycleDiagnostics(fragmented, 420);
    expect(diagnostics.stage).toBe("FRAGMENTED");
    expect(diagnostics.fragmentationAge).toBe(60);
    expect(diagnostics.unifiedAge).toBe(0);
  });

  it("does not let a new dynasty inherit old unification grace", () => {
    const first = recordWorldUnified(createInitialWorldCycleState(0), 0);
    const fractured = recordWorldFragmented(first, 1000);
    const second = recordWorldUnified(fractured, 1500);
    expect(getWorldCycleDiagnostics(second, 1512).unifiedAge).toBe(12);
  });

  it("keeps WorldEra out of cycle diagnostics", () => {
    const diagnostics = getWorldCycleDiagnostics(createInitialWorldCycleState(0), 960);
    expect(Object.keys(diagnostics)).not.toContain("era");
  });

  it("resets diagnostics for a new world", () => {
    const diagnostics = getWorldCycleDiagnostics(createInitialWorldCycleState(200), 200);
    expect(diagnostics.fragmentationAge).toBe(0);
    expect(diagnostics.unifiedAge).toBe(0);
  });

  it("uses soft consolidation modifiers instead of forced outcomes", () => {
    expect(getConsolidationRebellionChanceMultiplier(1)).toBeGreaterThan(0);
    expect(getConsolidationImperialStrainMultiplier(1)).toBeGreaterThan(0);
    expect(getConsolidationRebellionChanceMultiplier(0)).toBe(1);
    expect(getConsolidationImperialStrainMultiplier(0)).toBe(1);
  });

  it("does not create hegemonic momentum below candidate threshold", () => {
    const state = observeHegemonicMomentum(createInitialWorldCycleState(0), [
      { team: team({ name: "chu" }), territoryShare: 22, stability: 80 },
      { team: team({ name: "qin" }), territoryShare: 18, stability: 80 },
    ], 120);
    expect(getWorldCycleDiagnostics(state, 120).hegemonicMomentum).toBe(0);
  });

  it("enables soft consolidation leader momentum in long fragmentation once a controlled-share frontrunner emerges", () => {
    let state = createInitialWorldCycleState(0);
    const metrics = [
      { team: team({ name: "chu" }), territoryShare: 23.5, stability: 72 },
      { team: team({ name: "ying" }), territoryShare: 20.3, stability: 70 },
      { team: team({ name: "ping" }), territoryShare: 10.4, stability: 68 },
    ];
    state = observeHegemonicMomentum(
      state,
      metrics,
      CONSOLIDATION_LEADER_START_FRAGMENTATION_MONTH + 1
    );
    state = observeHegemonicMomentum(
      state,
      metrics,
      CONSOLIDATION_LEADER_START_FRAGMENTATION_MONTH + 121
    );
    const diagnostics = getWorldCycleDiagnostics(
      state,
      CONSOLIDATION_LEADER_START_FRAGMENTATION_MONTH + 121
    );
    expect(diagnostics.hegemonicMomentum).toBe(0);
    expect(diagnostics.consolidationLeaderId).toBe("chu");
    expect(diagnostics.consolidationLeaderMomentum).toBeGreaterThan(0);
    expect(diagnostics.hegemonicSiegeMultiplier).toBeGreaterThan(1);
    expect(diagnostics.hegemonicSiegeMultiplier).toBeLessThanOrEqual(
      CONSOLIDATION_LEADER_SIEGE_MULTIPLIER_CAP
    );
  });

  it("does not grant momentum before sixty months of qualified leadership", () => {
    let state = observeHegemonicMomentum(createInitialWorldCycleState(0), [
      { team: team({ name: "chu" }), territoryShare: 34, stability: 80 },
      { team: team({ name: "qin" }), territoryShare: 20, stability: 80 },
    ], 0);
    state = observeHegemonicMomentum(state, [
      { team: team({ name: "chu" }), territoryShare: 34, stability: 80 },
      { team: team({ name: "qin" }), territoryShare: 20, stability: 80 },
    ], HEGEMONIC_MOMENTUM_START_MONTHS - 1);
    expect(getWorldCycleDiagnostics(state, HEGEMONIC_MOMENTUM_START_MONTHS).hegemonicMomentum).toBe(0);
  });

  it("ramps and caps hegemonic momentum between five and fifteen years", () => {
    let state = observeHegemonicMomentum(createInitialWorldCycleState(0), [
      { team: team({ name: "chu" }), territoryShare: 34, stability: 80 },
      { team: team({ name: "qin" }), territoryShare: 20, stability: 80 },
    ], 0);
    state = observeHegemonicMomentum(state, [
      { team: team({ name: "chu" }), territoryShare: 32, stability: 80 },
      { team: team({ name: "qin" }), territoryShare: 20, stability: 80 },
    ], (HEGEMONIC_MOMENTUM_START_MONTHS + HEGEMONIC_MOMENTUM_CAP_MONTHS) / 2);
    const mid = getWorldCycleDiagnostics(state, 120).hegemonicMomentum;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);

    state = observeHegemonicMomentum(state, [
      { team: team({ name: "chu" }), territoryShare: 35, stability: 80 },
      { team: team({ name: "qin" }), territoryShare: 20, stability: 80 },
    ], HEGEMONIC_MOMENTUM_CAP_MONTHS + 1);
    expect(getWorldCycleDiagnostics(state, HEGEMONIC_MOMENTUM_CAP_MONTHS + 1).hegemonicMomentum).toBe(1);
  });

  it("decays momentum instead of instantly transferring it to a new frontrunner", () => {
    let state = observeHegemonicMomentum(createInitialWorldCycleState(0), [
      { team: team({ name: "chu" }), territoryShare: 35, stability: 80 },
      { team: team({ name: "qin" }), territoryShare: 20, stability: 80 },
    ], 0);
    state = observeHegemonicMomentum(state, [
      { team: team({ name: "chu" }), territoryShare: 35, stability: 80 },
      { team: team({ name: "qin" }), territoryShare: 20, stability: 80 },
    ], HEGEMONIC_MOMENTUM_CAP_MONTHS + 1);
    expect(getWorldCycleDiagnostics(state, HEGEMONIC_MOMENTUM_CAP_MONTHS + 1).hegemonicCandidateId).toBe("chu");

    state = observeHegemonicMomentum(state, [
      { team: team({ name: "qin" }), territoryShare: 36, stability: 80 },
      { team: team({ name: "chu" }), territoryShare: 28, stability: 80 },
    ], HEGEMONIC_MOMENTUM_CAP_MONTHS + 2);
    const diagnostics = getWorldCycleDiagnostics(state, HEGEMONIC_MOMENTUM_CAP_MONTHS + 2);
    expect(diagnostics.hegemonicCandidateId).toBe("chu");
    expect(diagnostics.hegemonicMomentum).toBeLessThan(1);
    expect(diagnostics.hegemonicMomentum).toBeGreaterThan(0);
  });

  it("bounds hegemonic siege and capture integration modifiers", () => {
    expect(getHegemonicSiegeMultiplier(1, 1, false)).toBeLessThanOrEqual(
      HEGEMONIC_SIEGE_MULTIPLIER_CAP
    );
    expect(getHegemonicSiegeMultiplier(1, 1, false)).toBeGreaterThan(1);
    expect(getHegemonicCaptureLoyaltyBonus(1, 1, false)).toBeGreaterThan(0);
    expect(getHegemonicSiegeMultiplier(1, 1, true)).toBeLessThan(
      getHegemonicSiegeMultiplier(1, 1, false)
    );
  });

  it("establishes dynastic order for a 60 percent dominant state after persistence", () => {
    let state = createInitialWorldCycleState(0);
    const metrics = [
      { team: team({ name: "qin" }), territoryShare: 63, cityShare: 58, stability: 72 },
      { team: team({ name: "chu" }), territoryShare: 18, cityShare: 20, stability: 70 },
    ];
    state = observeDynasticOrder(state, metrics, 100);
    expect(getWorldCycleDiagnostics(state, 110).stage).toBe("FRAGMENTED");
    state = observeDynasticOrder(state, metrics, 124);
    const diagnostics = getWorldCycleDiagnostics(state, 124);
    expect(diagnostics.stage).toBe("UNIFIED_EARLY");
    expect(diagnostics.unifiedAge).toBe(24);
  });

  it("does not end dynastic order for minor unrest", () => {
    let state = observeDynasticOrder(createInitialWorldCycleState(0), [
      { team: team({ name: "qin" }), territoryShare: 64, cityShare: 60, stability: 75 },
      { team: team({ name: "minor" }), territoryShare: 12, cityShare: 10, stability: 50 },
    ], 0);
    state = observeDynasticOrder(state, [
      { team: team({ name: "qin" }), territoryShare: 64, cityShare: 60, stability: 75 },
      { team: team({ name: "minor" }), territoryShare: 12, cityShare: 10, stability: 50 },
    ], 24);
    state = observeDynasticOrder(state, [
      { team: team({ name: "qin" }), territoryShare: 55, cityShare: 56, stability: 68 },
      { team: team({ name: "minor" }), territoryShare: 11, cityShare: 10, stability: 50 },
    ], 60);
    expect(getWorldCycleDiagnostics(state, 60).stage).toBe("UNIFIED_EARLY");
  });

  it("exits dynastic order after sustained territorial loss or challenger growth", () => {
    let state = observeDynasticOrder(createInitialWorldCycleState(0), [
      { team: team({ name: "qin" }), territoryShare: 64, cityShare: 60, stability: 75 },
      { team: team({ name: "chu" }), territoryShare: 18, cityShare: 20, stability: 70 },
    ], 0);
    state = observeDynasticOrder(state, [
      { team: team({ name: "qin" }), territoryShare: 64, cityShare: 60, stability: 75 },
      { team: team({ name: "chu" }), territoryShare: 18, cityShare: 20, stability: 70 },
    ], 24);
    state = observeDynasticOrder(state, [
      { team: team({ name: "qin" }), territoryShare: 48, cityShare: 50, stability: 65 },
      { team: team({ name: "chu" }), territoryShare: 26, cityShare: 25, stability: 70 },
    ], 60);
    state = observeDynasticOrder(state, [
      { team: team({ name: "qin" }), territoryShare: 48, cityShare: 50, stability: 65 },
      { team: team({ name: "chu" }), territoryShare: 26, cityShare: 25, stability: 70 },
    ], 72);
    expect(getWorldCycleDiagnostics(state, 72).stage).toBe("FRAGMENTED");
  });
});
