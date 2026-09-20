import { describe, expect, it } from "vitest";
import {
  getRulerBattleDeathRisk,
  hasBattlefieldFatalityContext,
  shouldPreventRulerBattleDeath,
  shouldRulerBattleDeathOccur,
} from "./RulerBattleRules";

describe("ruler battle rules", () => {
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
