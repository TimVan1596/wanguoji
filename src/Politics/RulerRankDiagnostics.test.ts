import { describe, expect, it } from "vitest";
import { getRecordedAccessionRank, summarizeRulersByAccessionRank } from "./RulerRankDiagnostics";
import { summarizeProvisionalRulers } from "./ProvisionalRulerDiagnostics";
import worldRandom from "../Simulation/WorldRandom";

describe("historical accession-rank diagnostics", () => {
  it("groups by recorded accession rank even after a faction becomes an empire", () => {
    const factions = new Map([["a", { identityStage: "STATE", status: "ACTIVE", sovereigntyHistory: [
      { rank: "LEADER", startMonth: 0, endMonth: 100 },
      { rank: "KING", startMonth: 100, endMonth: 200 },
      { rank: "EMPEROR", startMonth: 200 },
    ] }]]);
    const dynasties = [{ factionId: "a", currentRulerId: "live", rulers: [
      { id: "leader", accessionYear: 0, endYear: 120, endReason: "战死" },
      { id: "king1", accessionYear: 100, endYear: 180, endReason: "去世" },
      { id: "king2", accessionYear: 180, endYear: 220, endReason: "战死" },
      { id: "emperor", accessionYear: 200, endYear: 280, endReason: "被俘处死" },
      { id: "live", accessionYear: 280 },
      { id: "heir", endYear: 250 },
    ] }] as never;
    const before = worldRandom.exportState();
    const result = summarizeRulersByAccessionRank(dynasties, factions);
    expect(result.LEADER).toEqual({ completedCount: 1, combatDeathCount: 1, combatDeathRatio: 1, medianTenureMonths: 120, minTenureMonths: 120, maxTenureMonths: 120 });
    expect(result.KING).toEqual({ completedCount: 2, combatDeathCount: 1, combatDeathRatio: 0.5, medianTenureMonths: 60, minTenureMonths: 40, maxTenureMonths: 80 });
    expect(result.EMPEROR).toEqual({ completedCount: 1, combatDeathCount: 0, combatDeathRatio: 0, medianTenureMonths: 80, minTenureMonths: 80, maxTenureMonths: 80 });
    expect(summarizeProvisionalRulers(dynasties, factions).completedProvisionalRulerCount).toBe(result.LEADER.completedCount);
    expect(worldRandom.exportState()).toEqual(before);
  });

  it("does not infer missing historical ranks from current UI identity", () => {
    expect(getRecordedAccessionRank(50, [{ rank: "KING", startMonth: 100 }])).toBeUndefined();
    const result = summarizeRulersByAccessionRank([{ factionId: "a", rulers: [{ accessionYear: 50, endYear: 100 }] }] as never,
      new Map([["a", { sovereigntyHistory: [{ rank: "KING", startMonth: 100 }] }]]));
    expect(result.unknownCompletedCount).toBe(1);
    expect(result.LEADER.completedCount).toBe(0);
    expect(result.KING.completedCount).toBe(0);
    expect(result.EMPEROR.combatDeathRatio).toBeUndefined();
    expect(result.EMPEROR.medianTenureMonths).toBeUndefined();
  });
});
