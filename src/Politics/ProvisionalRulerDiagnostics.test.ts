import { describe, expect, it } from "vitest";
import { ProvisionalRulerDiagnosticsSession, summarizeProvisionalRulers } from "./ProvisionalRulerDiagnostics";

describe("provisional ruler diagnostics", () => {
  it("counts current provisional rulers, combat deaths, and median completed tenure from recorded rank history", () => {
    const result = summarizeProvisionalRulers([
      { factionId: "rebel", currentRulerId: "r2", rulers: [
        { id: "r1", accessionYear: 0, endYear: 24, status: "dead", chronicle: { deathCause: "战死" } },
        { id: "r2", accessionYear: 24, status: "ruling" },
        { id: "r3", accessionYear: 48, endYear: 72, status: "dead" },
      ] },
      { factionId: "kingdom", currentRulerId: "k1", rulers: [
        { id: "k1", accessionYear: 0, status: "ruling" },
      ] },
    ] as never, new Map([
      ["rebel", { identityStage: "STATE", status: "ACTIVE", sovereigntyHistory: [{ rank: "LEADER", startMonth: 0, endMonth: 59 }, { rank: "KING", startMonth: 60 }] }],
      ["kingdom", { identityStage: "PROVISIONAL", status: "ACTIVE", sovereigntyHistory: [{ rank: "KING", startMonth: 0 }] }],
    ]));
    expect(result).toEqual({
      currentProvisionalRulerCount: 1,
      completedProvisionalRulerCount: 2,
      provisionalCombatDeathCount: 1,
      combatDeathRatio: 0.5,
      medianCompletedTenureMonths: 24,
      shortestCompletedTenureMonths: 24,
      longestCompletedTenureMonths: 24,
      topAbnormalFactions: [{
        factionId: "rebel",
        factionName: "rebel",
        completedRulerCount: 2,
        combatDeathCount: 1,
        combatDeathRatio: 0.5,
        medianCompletedTenureMonths: 24,
        shortestCompletedTenureMonths: 24,
        longestCompletedTenureMonths: 24,
      }],
    });
  });
});
