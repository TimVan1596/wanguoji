import { describe, expect, it, vi } from "vitest";
import { evaluateDynasticRevolution, getDynasticRevolutionChance, getRevolutionEligibility, type RevolutionContext } from "./DynasticRevolution";
import worldRandom from "../Simulation/WorldRandom";

function context(stability = 80): RevolutionContext {
  return { worldMonth: 1200, identityStage: "STATE", status: "ACTIVE", stability, cityCount: 3,
    predecessor: { id: "old", houseName: "田氏", givenName: "平", bornYear: 100, accessionYear: 1180, status: "ruling" },
    successor: { id: "heir", houseName: "田氏", givenName: "安", bornYear: 900, status: "heir" },
    successionReason: "natural", previousSuccessionMonths: [1180, 1160] };
}
describe("contextual dynastic revolution chance", () => {
  it.each([{ stability: 80, base: 0.04 }, { stability: 61, base: 0.04 }, { stability: 60, base: 0.06 },
    { stability: 46, base: 0.06 }, { stability: 45, base: 0.10 }, { stability: 31, base: 0.10 },
    { stability: 30, base: 0.14 }, { stability: 20, base: 0.14 }])
    ("stability$stability influences base chance, never the hard gate", ({ stability, base }) => {
      const input = context(stability), roll = vi.fn(() => 0.99), result = evaluateDynasticRevolution(input, roll);
      expect(result).toMatchObject({ hardEligible: true, rollAttempted: true, baseChance: base, blockers: ["ROLL_FAILED"],
        evidence: ["RECENT_SUCCESSION_CHAIN"], modifierChance: 0.02 });
      expect(result.chance).toBeCloseTo(base + 0.02);
      expect(roll).toHaveBeenCalledTimes(1);
      expect(getRevolutionEligibility(input).blockers).not.toContain("STABILITY_TOO_HIGH");
    });
  it("uses only recorded modifiers, once each, and caps at18%", () => {
    const high = context();
    expect(getDynasticRevolutionChance(high)).toBe(0.06);
    expect(getDynasticRevolutionChance({ ...high, successionReason: "combat" })).toBe(0.07);
    expect(getDynasticRevolutionChance({ ...high, successionReason: "captured" })).toBe(0.09);
    expect(getDynasticRevolutionChance({ ...high, cityCount: 1 })).toBe(0.09);
    const minor = { ...high, previousSuccessionMonths: [], successor: { ...high.successor!, bornYear: 1100 } };
    expect(getRevolutionEligibility(minor).evidence).toEqual(["MINOR_SUCCESSOR"]);
    expect(getDynasticRevolutionChance(minor)).toBe(0.06);
    const severe = { ...context(20), successor: minor.successor, cityCount: 1, successionReason: "captured" as const };
    const result = evaluateDynasticRevolution(severe, () => 0.179);
    expect(result).toMatchObject({ chance: 0.18, baseChance: 0.14, modifierChance: 0.10, capped: true, usurpation: true });
    expect(evaluateDynasticRevolution(severe, () => 0.18).usurpation).toBe(false);
  });
  it("keeps every hard gate, no-crisis and no-evidence boundaries at chance0 with zero RNG draws", () => {
    const noCrisis = { ...context(), previousSuccessionMonths: [], successionReason: "captured" as const };
    const noEvidence = { ...context(), previousSuccessionMonths: [] };
    expect(getRevolutionEligibility(noCrisis).evidence).toContain("PREDECESSOR_CAPTURED");
    expect(getRevolutionEligibility(noCrisis).blockers).toContain("NO_SUCCESSION_CRISIS");
    expect(getRevolutionEligibility(noEvidence).blockers).toContain("SUCCESSOR_NOT_VULNERABLE");
    for (const input of [noCrisis, noEvidence, { ...context(), successor: undefined },
      { ...context(), identityStage: "PROVISIONAL" }, { ...context(), status: "MERGED" }, { ...context(), cityCount: 0 }]) {
      const roll = vi.fn(() => 0);
      expect(getDynasticRevolutionChance(input)).toBe(0);
      expect(evaluateDynasticRevolution(input, roll)).toMatchObject({ hardEligible: false, chance: 0, rollAttempted: false, rollResult: undefined, usurpation: false });
      expect(roll).not.toHaveBeenCalled();
    }
    expect(getRevolutionEligibility({ ...context(), cityCount: 0 }).evidence).not.toContain("ONE_CITY_REMAINING");
  });
  it("is pure and repeatable for the same deterministic rolls, with one WorldRandom draw per eligible boundary", () => {
    const input = context(20); const original = JSON.stringify(input), saved = worldRandom.exportState();
    try {
      const evaluate = () => {
        worldRandom.initialize("dynastic-calibration");
        const before = worldRandom.exportState();
        getDynasticRevolutionChance(input); getRevolutionEligibility(input);
        expect(worldRandom.exportState()).toEqual(before);
        return { results: Array.from({ length: 100 }, () => evaluateDynasticRevolution(input)), rng: worldRandom.exportState() };
      };
      const draw = vi.spyOn(worldRandom, "next");
      try { const first = evaluate(); expect(draw).toHaveBeenCalledTimes(100); expect(evaluate()).toEqual(first); expect(draw).toHaveBeenCalledTimes(200); }
      finally { draw.mockRestore(); }
      expect(JSON.stringify(input)).toBe(original);
    } finally { worldRandom.restore(saved); }
  });
  it("fixed-roll frequency sanity: severity increases chance, stays rare, and cannot force a real-world occurrence", () => {
    const high = context(), medium = context(55), low = context(20);
    const inputs = [high, medium, low, { ...high, previousSuccessionMonths: [], successor: { ...high.successor!, bornYear: 1100 } },
      { ...high, successionReason: "captured" as const }, { ...high, cityCount: 1 }];
    // Fixed ordered midpoint quantiles, not Monte Carlo or a parallel world simulator.
    const rolls = Array.from({ length: 1000 }, (_, i) => (i + 0.5) / 1000);
    const sample = () => inputs.map(input => {
      const results = rolls.map(value => evaluateDynasticRevolution(input, () => value));
      expect(results.every(result => result.rollAttempted && result.chance <= 0.18)).toBe(true);
      return results.filter(result => result.usurpation).length;
    });
    const counts = sample(); expect(sample()).toEqual(counts);
    expect(counts[2]).toBeGreaterThan(counts[1]); expect(counts[1]).toBeGreaterThan(counts[0]);
    expect(counts[4]).toBeGreaterThan(counts[0]); expect(counts[5]).toBeGreaterThan(counts[0]);
    for (const count of counts) { expect(count).toBeGreaterThan(0); expect(count).toBeLessThanOrEqual(200); }
  });
});

describe("calibration closure compound lower-risk boundaries", () => {
  const shock = (): RevolutionContext => ({ ...context(), previousSuccessionMonths: [], cityCount: 1, successionReason: "combat" });
  it("requires both violent predecessor loss and one-city exposure outside the highest crisis tier", () => {
    for (const reason of ["combat", "captured"] as const) {
      const input = { ...shock(), successionReason: reason }, roll = vi.fn(() => 0.99);
      const result = evaluateDynasticRevolution(input, roll);
      expect(result).toMatchObject({ hardEligible: true, riskTier: "COMPOUND_SHOCK", riskMultiplier: 0.25, crisis: { level: "succession-shock" } });
      expect(result.chance).toBe(reason === "combat" ? 0.02 : 0.025);
      expect(roll).toHaveBeenCalledTimes(1);
      for (const change of [{ cityCount: 2 }, { successionReason: "natural" as const }, { successor: undefined },
        { identityStage: "PROVISIONAL" }, { status: "EXILED" }, { cityCount: 0 }]) {
        const blockedRoll = vi.fn(() => 0);
        expect(evaluateDynasticRevolution({ ...input, ...change }, blockedRoll).rollAttempted).toBe(false);
        expect(blockedRoll).not.toHaveBeenCalled();
      }
    }
  });
  it("uses unchanged SuccessionRules levels and progressively discounts lower tiers", () => {
    for (const stability of [20, 45, 60, 80]) {
      const input = { ...shock(), stability };
      const lower = evaluateDynasticRevolution(input, () => 0.99);
      const instability = evaluateDynasticRevolution({ ...input, previousSuccessionMonths: [1180] }, () => 0.99);
      const crisis = evaluateDynasticRevolution({ ...input, previousSuccessionMonths: [1180, 1160] }, () => 0.99);
      expect(instability).toMatchObject({ riskTier: "COMPOUND_INSTABILITY", riskMultiplier: 0.5, crisis: { level: "succession-instability" } });
      expect(lower.chance).toBeLessThan(instability.chance);
      expect(instability.chance).toBeLessThan(crisis.chance);
      expect(crisis.riskMultiplier).toBe(1);
      expect(lower.chance).toBeLessThanOrEqual(0.045);
      expect(instability.chance).toBeLessThanOrEqual(0.09);
      expect(crisis.chance).toBeLessThanOrEqual(0.18);
    }
  });
  it("keeps lower-tier RNG consumption and decisions reproducible", () => {
    const saved = worldRandom.exportState();
    try {
      const run = () => {
        worldRandom.initialize("closure-compound-boundaries");
        const results = Array.from({ length: 100 }, () => evaluateDynasticRevolution(shock()));
        return { results, rng: worldRandom.exportState() };
      };
      const draw = vi.spyOn(worldRandom, "next");
      try { const first = run(); expect(draw).toHaveBeenCalledTimes(100); expect(run()).toEqual(first); expect(draw).toHaveBeenCalledTimes(200); }
      finally { draw.mockRestore(); }
    } finally { worldRandom.restore(saved); }
  });
});
