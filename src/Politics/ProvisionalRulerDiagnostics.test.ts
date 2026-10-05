import { describe, expect, it } from "vitest";
import { ProvisionalRulerDiagnosticsSession, summarizeProvisionalRulers } from "./ProvisionalRulerDiagnostics";

describe("provisional ruler diagnostics", () => {
  it("separates session completions from old history, including a new completion in the load month", () => {
    const dynasties = [{ factionId: "rebel", currentRulerId: "new", rulers: [
      { id: "old", accessionYear: 0, endYear: 100, endReason: "战死" },
      { id: "new", accessionYear: 50 },
    ] }] as never as Parameters<typeof summarizeProvisionalRulers>[0];
    const factions = new Map([["rebel", { identityStage: "PROVISIONAL", status: "ACTIVE", sovereigntyHistory: [{ rank: "LEADER", startMonth: 0 }] }]]);
    const session = new ProvisionalRulerDiagnosticsSession();
    session.reset(dynasties);
    expect(session.summarize(dynasties, factions).completedProvisionalRulerCount).toBe(0);
    dynasties[0].rulers[1].endYear = 100;
    dynasties[0].rulers[1].endReason = "去世";
    expect(session.summarize(dynasties, factions)).toMatchObject({
      completedProvisionalRulerCount: 1, provisionalCombatDeathCount: 0,
      combatDeathRatio: 0, medianCompletedTenureMonths: 50,
      shortestCompletedTenureMonths: 50, longestCompletedTenureMonths: 50,
    });
    expect(summarizeProvisionalRulers(dynasties, factions).completedProvisionalRulerCount).toBe(2);
    session.reset(dynasties); // Save/Load starts a new observational session.
    expect(session.summarize(dynasties, factions).completedProvisionalRulerCount).toBe(0);
    session.reset([]); // New world can reuse ids without excluding its new samples.
    expect(session.summarize(dynasties, factions).completedProvisionalRulerCount).toBe(2);
  });

  it("filters recent completions by end month and ranks factions using only that window", () => {
    const dynasties = [{ factionId: "rebel", currentRulerId: "live", rulers: [
      { id: "old", accessionYear: 0, endYear: 24, endReason: "战死" },
      { id: "recent1", accessionYear: 100, endYear: 200, endReason: "战死" },
      { id: "recent2", accessionYear: 0, endYear: 201, endReason: "去世" },
      { id: "live", accessionYear: 201 },
    ] }] as never;
    const factions = new Map([["rebel", { identityStage: "PROVISIONAL", status: "ACTIVE", sovereigntyHistory: [{ rank: "LEADER", startMonth: 0 }] }]]);
    const recent = summarizeProvisionalRulers(dynasties, factions, { completedSinceMonth: 200 });
    expect(recent).toMatchObject({ completedProvisionalRulerCount: 2, provisionalCombatDeathCount: 1,
      combatDeathRatio: 0.5, medianCompletedTenureMonths: 150.5,
      shortestCompletedTenureMonths: 100, longestCompletedTenureMonths: 201 });
    expect(recent.topAbnormalFactions[0]).toMatchObject({ completedRulerCount: 2, combatDeathCount: 1 });
    expect(summarizeProvisionalRulers(dynasties, factions, { completedSinceMonth: 300 }))
      .toMatchObject({ completedProvisionalRulerCount: 0, combatDeathRatio: undefined, medianCompletedTenureMonths: undefined, topAbnormalFactions: [] });
  });
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
