import { describe, expect, it, vi } from "vitest";
import { RevolutionGateDiagnostics } from "./RevolutionGateDiagnostics";
import { evaluateDynasticRevolution, type RevolutionContext } from "./DynasticRevolution";
import worldRandom from "../Simulation/WorldRandom";

const context = (): RevolutionContext => ({ worldMonth: 600, identityStage: "STATE", status: "ACTIVE", stability: 20, cityCount: 1,
  predecessor: { id: "old", houseName: "田氏", givenName: "平", bornYear: 0, accessionYear: 200, status: "ruling" },
  successor: { id: "heir", houseName: "田氏", givenName: "安", bornYear: 480, status: "heir" },
  successionReason: "natural", previousSuccessionMonths: [] });

describe("session-only observational Revolution Gate diagnostics", () => {
  it("counts all blockers and independent gates from already-computed boundary results", () => {
    const diagnostics = new RevolutionGateDiagnostics(() => true);
    const inputs = [context(), { ...context(), stability: 80 }, { ...context(), successor: undefined, identityStage: "PROVISIONAL", status: "EXILED", cityCount: 0 },
      { ...context(), cityCount: 5, successor: { ...context().successor!, bornYear: 200 } }];
    for (const input of inputs) diagnostics.record("id", "旧国", input, evaluateDynasticRevolution(input, () => 0.9));
    const snapshot = diagnostics.snapshot();
    expect(snapshot).toMatchObject({ successionBoundaryCheckCount: 4, hasLegitimateSuccessorCount: 3,
      crisisEligibleCount: 2, vulnerabilityEligibleCount: 2,
      hardEligibleBeforeRollCount: 2, rollAttemptCount: 2, rollFailedCount: 2, usurpationCount: 0,
      blockerCounts: { NO_ELIGIBLE_LEGITIMATE_SUCCESSOR: 1, NOT_STATE: 1, NOT_ACTIVE_STATE: 1,
        NO_SUCCESSION_CRISIS: 2, SUCCESSOR_NOT_VULNERABLE: 2, ROLL_FAILED: 2 } });
    expect(snapshot).not.toHaveProperty("stabilityEligibleCount");
    expect(snapshot.blockerCounts).not.toHaveProperty("STABILITY_TOO_HIGH");
    expect(snapshot.chanceBuckets).toMatchObject({ base: { "4%": 1, "14%": 1 }, final: { "9%": 1, "18%": 1 }, cappedCount: 1 });
    expect(snapshot.recentEligibleBoundaries[0]).toMatchObject({ factionId: "id", factionName: "旧国", month: 600,
      stability: 80, crisisLevel: "succession-crisis", computedChance: 0.09, rollResult: 0.9, successionReason: "natural", successorAgeMonths: 120, evidence: ["MINOR_SUCCESSOR", "ONE_CITY_REMAINING"] });
  });
  it("bounds eligible samples at ten and resets all observations", () => {
    const diagnostics = new RevolutionGateDiagnostics(() => true);
    for (let month = 600; month < 615; month++) {
      const input = { ...context(), worldMonth: month, successionReason: "combat" as const };
      diagnostics.record("id", "旧国", input, evaluateDynasticRevolution(input, () => 0));
    }
    const snapshot = diagnostics.snapshot();
    expect(snapshot.usurpationCount).toBe(15);
    expect(snapshot.hardEligibleBeforeRollCount).toBe(15);
    expect(snapshot.recentEligibleBoundaries.map(boundary => boundary.month)).toEqual([614, 613, 612, 611, 610, 609, 608, 607, 606, 605]);
    snapshot.recentEligibleBoundaries[0].evidence.push("not canonical");
    expect(diagnostics.snapshot().recentEligibleBoundaries[0].evidence).not.toContain("not canonical");
    diagnostics.reset();
    expect(diagnostics.snapshot()).toMatchObject({ successionBoundaryCheckCount: 0, usurpationCount: 0, recentEligibleBoundaries: [], recentBoundaryChecks: [], rollAttemptCount: 0, hardEligibleBeforeRollCount: 0 });
  });
  it("does not spend RNG for diagnostics and cannot change seeded decisions when enabled", () => {
    const saved = worldRandom.exportState();
    const run = (enabled: boolean) => {
      worldRandom.initialize("revolution-debug-observation");
      const diagnostics = new RevolutionGateDiagnostics(() => enabled);
      const results = [];
      for (let index = 0; index < 30; index++) {
        const input = context(), result = evaluateDynasticRevolution(input);
        const rng = worldRandom.exportState();
        diagnostics.record("id", "旧国", input, result); diagnostics.snapshot();
        expect(worldRandom.exportState()).toEqual(rng);
        results.push(result);
      }
      return { results, rng: worldRandom.exportState(), diagnostics: diagnostics.snapshot() };
    };
    try {
      const disabled = run(false), enabled = run(true);
      expect(enabled.results).toEqual(disabled.results); expect(enabled.rng).toEqual(disabled.rng);
      expect(disabled.diagnostics.successionBoundaryCheckCount).toBe(0);
      expect(enabled.diagnostics.successionBoundaryCheckCount).toBe(30);
    } finally { worldRandom.restore(saved); }
  });
  it("performs no draw when recording or reading a precomputed result", () => {
    const result = evaluateDynasticRevolution(context(), () => 0.9);
    const draw = vi.spyOn(worldRandom, "next");
    try {
      const diagnostics = new RevolutionGateDiagnostics(() => true);
      diagnostics.record("id", "旧国", context(), result); diagnostics.snapshot(); diagnostics.reset();
      expect(draw).not.toHaveBeenCalled();
    } finally { draw.mockRestore(); }
  });
});

describe("calibration expectation and session world-time rates", () => {
  it("sums actual attempted chances, including failed rolls and discounted lower tiers, without RNG", () => {
    const diagnostics = new RevolutionGateDiagnostics(() => true);
    diagnostics.reset(12000); // Load at year1000: no earlier world history in the denominator.
    const inputs = [
      { ...context(), worldMonth: 12120, stability: 80, cityCount: 3 }, // minor,6%
      { ...context(), worldMonth: 12240, stability: 80, cityCount: 1, successionReason: "combat" as const,
        successor: { ...context().successor!, bornYear: 0 } }, // shock,2%
      { ...context(), worldMonth: 12360, stability: 80, cityCount: 1, successionReason: "combat" as const,
        successor: { ...context().successor!, bornYear: 0 }, previousSuccessionMonths: [12300] }, // instability,4%
      { ...context(), worldMonth: 12480, stability: 80, cityCount: 4, successor: { ...context().successor!, bornYear: 0 } }, // blocked
    ];
    // Keep the minor successor young at the loaded world's actual month.
    inputs[0].successor!.bornYear = 12000;
    const results = inputs.map((input, i) => evaluateDynasticRevolution(input, () => i === 0 ? 0 : 0.99));
    const draw = vi.spyOn(worldRandom, "next");
    try {
      inputs.forEach((input, i) => diagnostics.record("id", "国", input, results[i]));
      const snapshot = diagnostics.snapshot(13200); //100 elapsed years
      expect(snapshot).toMatchObject({ worldMonth: 13200, sessionStartMonth: 12000, elapsedWorldYears: 100,
        rollAttemptCount: 3, crisisEligibleCount: 1, lowerRiskEligibleCount: 2, usurpationCount: 1,
        eligibleRollsPer1000Years: 30, actualUsurpationsPer1000Years: 10 });
      expect(snapshot.expectedUsurpationCount).toBeCloseTo(0.12);
      expect(snapshot.expectedUsurpationsPer1000Years).toBeCloseTo(1.2);
      expect(snapshot.estimatedWorldYearsPerExpectedUsurpation).toBeCloseTo(100 / 0.12);
      expect(snapshot.chanceBuckets.final["2%"]).toBe(1);
      expect(snapshot.chanceBuckets.tiers).toEqual({ CRISIS: 1, COMPOUND_SHOCK: 1, COMPOUND_INSTABILITY: 1 });
      const same = diagnostics.snapshot(13200);
      expect(same).toEqual(snapshot); // repeated UI reads don't accumulate expectation
      expect(draw).not.toHaveBeenCalled();
      diagnostics.reset(13200);
      expect(diagnostics.snapshot(13200)).toMatchObject({ elapsedWorldYears: 0, expectedUsurpationCount: 0,
        eligibleRollsPer1000Years: null, estimatedWorldYearsPerExpectedUsurpation: null });
      expect(diagnostics.snapshot(13320)).toMatchObject({ elapsedWorldYears: 10, expectedUsurpationsPer1000Years: 0,
        estimatedWorldYearsPerExpectedUsurpation: null });
    } finally { draw.mockRestore(); }
  });
  it("does not collect expectations or eligible samples when debug is off", () => {
    const diagnostics = new RevolutionGateDiagnostics(() => false), input = context();
    diagnostics.record("id", "国", input, evaluateDynasticRevolution(input, () => 0));
    expect(diagnostics.snapshot(1200)).toMatchObject({ expectedUsurpationCount: 0, rollAttemptCount: 0, recentEligibleBoundaries: [] });
  });
});
