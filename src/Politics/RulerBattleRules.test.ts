import { describe, expect, it, vi } from "vitest";
import worldRandom from "../Simulation/WorldRandom";
import {
  getRulerBattleDeathRisk,
  hasBattlefieldFatalityContext,
  shouldPreventRulerBattleDeath,
  shouldRulerBattleDeathOccur,
  checkRulerBattleHazard,
} from "./RulerBattleRules";

describe("ruler battle rules", () => {
  it("requires political context for leaders and keeps their non-guaranteed risk above kings", () => {
    expect(hasBattlefieldFatalityContext({ reignMonths: 100, sovereigntyRank: "LEADER" })).toBe(false);
    expect(shouldRulerBattleDeathOccur({ reignMonths: 100, randomRoll: 0 })).toBe(false);
    expect(getRulerBattleDeathRisk("LEADER")).toBeGreaterThan(getRulerBattleDeathRisk("KING"));
    expect(getRulerBattleDeathRisk("LEADER")).toBeLessThan(1);
    for (const context of [{ rulerInSiege: true }, { capitalUnderSiege: true }]) {
      expect(shouldRulerBattleDeathOccur({ reignMonths: 100, ...context, randomRoll: 0 })).toBe(true);
      expect(shouldRulerBattleDeathOccur({ reignMonths: 100, ...context, randomRoll: 0.99 })).toBe(false);
    }
  });

  it("rolls at most once per leader hazard window, without spending draws on ordinary contacts", () => {
    const ruler = { lastBattleHazardCheckMonth: undefined as number | undefined };
    const next = vi.spyOn(worldRandom, "next").mockReturnValue(0.99);
    try {
      expect(checkRulerBattleHazard(ruler, 100, { reignMonths: 100 })).toBe(false);
      expect(next).not.toHaveBeenCalled();
      const context = { reignMonths: 100, capitalUnderSiege: true };
      expect(checkRulerBattleHazard(ruler, 100, context)).toBe(false);
      for (let index = 0; index < 100; index += 1) checkRulerBattleHazard(ruler, 100, context);
      checkRulerBattleHazard(ruler, 111, context);
      expect(next).toHaveBeenCalledTimes(1);
      expect(ruler.lastBattleHazardCheckMonth).toBe(100);
      checkRulerBattleHazard(ruler, 112, context);
      expect(next).toHaveBeenCalledTimes(2);
      // A crisis still uses the existing terminal path even inside a hazard window.
      expect(checkRulerBattleHazard(ruler, 112, { reignMonths: 1, severeCrisis: true })).toBe(true);
      expect(next).toHaveBeenCalledTimes(2);
    } finally { next.mockRestore(); }
  });

  it("keeps formal-ruler risks and context rules while suppressing same-month repeats", () => {
    expect(getRulerBattleDeathRisk("KING")).toBe(0.25);
    expect(getRulerBattleDeathRisk("EMPEROR")).toBe(0.08);
    const next = vi.spyOn(worldRandom, "next").mockReturnValue(0.99);
    try {
      for (const rank of ["KING", "EMPEROR"] as const) {
        const ruler = {};
        const context = { reignMonths: 100, sovereigntyRank: rank, rulerInSiege: true };
        const before = next.mock.calls.length;
        checkRulerBattleHazard(ruler, 100, context);
        checkRulerBattleHazard(ruler, 100, context);
        expect(next.mock.calls.length - before).toBe(1);
        checkRulerBattleHazard(ruler, 101, context);
        expect(next.mock.calls.length - before).toBe(1);
        checkRulerBattleHazard(ruler, 112, context);
        expect(next.mock.calls.length - before).toBe(2);
      }
    } finally { next.mockRestore(); }
  });

  it("reproduces same-seed results and resumes hazard/RNG state after JSON round trip", () => {
    const initial = worldRandom.exportState();
    const context = { reignMonths: 100, rulerInSiege: true };
    const run = () => {
      worldRandom.initialize("leader-hazard-repro");
      const ruler = { lastBattleHazardCheckMonth: undefined as number | undefined };
      const results = Array.from({ length: 60 }, (_, index) => checkRulerBattleHazard(ruler, 100 + index, context));
      return { results, ruler, rng: worldRandom.exportState() };
    };
    try {
      const before = run();
      expect(run()).toEqual(before);
      worldRandom.initialize("leader-hazard-save");
      const ruler = {};
      checkRulerBattleHazard(ruler, 100, context);
      const snapshot = JSON.parse(JSON.stringify({ ruler, rng: worldRandom.exportState() }));
      const expected = [checkRulerBattleHazard(ruler, 100, context), checkRulerBattleHazard(ruler, 112, context)];
      const expectedRng = worldRandom.exportState();
      worldRandom.restore(snapshot.rng);
      expect([checkRulerBattleHazard(snapshot.ruler, 100, context), checkRulerBattleHazard(snapshot.ruler, 112, context)]).toEqual(expected);
      expect(worldRandom.exportState()).toEqual(expectedRng);
    } finally { worldRandom.restore(initial); }
  });
  it("protects a newly acceded ruler from ordinary battle death", () => {
    expect(
      shouldPreventRulerBattleDeath({
        reignMonths: 3,
      })
    ).toBe(true);
  });

  it("blocks chain battle deaths within the cooldown", () => {
    expect(
      shouldPreventRulerBattleDeath({
        reignMonths: 30,
        monthsSinceLastBattleDeath: 12,
      })
    ).toBe(true);
  });

  it("allows battle death after grace and cooldown", () => {
    expect(
      shouldPreventRulerBattleDeath({
        reignMonths: 30,
        monthsSinceLastBattleDeath: 30,
      })
    ).toBe(false);
  });

  it("does not suppress battle death in severe crises", () => {
    expect(
      shouldPreventRulerBattleDeath({
        reignMonths: 3,
        severeCrisis: true,
      })
    ).toBe(false);
  });

  it("makes king and emperor ordinary battle death rarer than leaders", () => {
    expect(getRulerBattleDeathRisk("KING")).toBeLessThan(
      getRulerBattleDeathRisk("LEADER")
    );
    expect(getRulerBattleDeathRisk("EMPEROR")).toBeLessThan(
      getRulerBattleDeathRisk("KING")
    );
    expect(
      shouldRulerBattleDeathOccur({
        reignMonths: 90,
        monthsSinceLastBattleDeath: 90,
        sovereigntyRank: "KING",
        randomRoll: 0.5,
      })
    ).toBe(false);
    expect(
      shouldRulerBattleDeathOccur({
        reignMonths: 90,
        monthsSinceLastBattleDeath: 90,
        sovereigntyRank: "EMPEROR",
        randomRoll: 0.2,
      })
    ).toBe(false);
  });

  it("uses longer accession and chain protection for kings and emperors", () => {
    expect(
      shouldPreventRulerBattleDeath({
        reignMonths: 47,
        sovereigntyRank: "KING",
      })
    ).toBe(true);
    expect(
      shouldPreventRulerBattleDeath({
        reignMonths: 71,
        sovereigntyRank: "EMPEROR",
      })
    ).toBe(true);
    expect(
      shouldPreventRulerBattleDeath({
        reignMonths: 90,
        monthsSinceLastBattleDeath: 70,
        sovereigntyRank: "EMPEROR",
      })
    ).toBe(true);
  });

  it("lets severe capital collapse crisis bypass ordinary protection", () => {
    expect(
      shouldRulerBattleDeathOccur({
        reignMonths: 1,
        sovereigntyRank: "EMPEROR",
        severeCrisis: true,
        randomRoll: 1,
      })
    ).toBe(true);
  });

  it("blocks ordinary collision fatality for kings and emperors without siege context", () => {
    expect(
      hasBattlefieldFatalityContext({
        reignMonths: 100,
        sovereigntyRank: "KING",
      })
    ).toBe(false);
    expect(
      shouldRulerBattleDeathOccur({
        reignMonths: 100,
        monthsSinceLastBattleDeath: 100,
        sovereigntyRank: "KING",
        randomRoll: 0,
      })
    ).toBe(false);
    expect(
      shouldRulerBattleDeathOccur({
        reignMonths: 100,
        monthsSinceLastBattleDeath: 100,
        sovereigntyRank: "EMPEROR",
        capitalUnderSiege: true,
        randomRoll: 0,
      })
    ).toBe(false);
  });

  it("allows king and emperor battle fatality only in command or collapse contexts", () => {
    expect(
      shouldRulerBattleDeathOccur({
        reignMonths: 100,
        monthsSinceLastBattleDeath: 100,
        sovereigntyRank: "KING",
        rulerInSiege: true,
        randomRoll: 0,
      })
    ).toBe(true);
    expect(
      shouldRulerBattleDeathOccur({
        reignMonths: 100,
        monthsSinceLastBattleDeath: 100,
        sovereigntyRank: "EMPEROR",
        rulerInSiege: true,
        randomRoll: 0,
      })
    ).toBe(true);
  });
});
