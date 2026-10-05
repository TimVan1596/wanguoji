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
      crisisEligibleCount: 2, vulnerabilityEligibleCount: 3, stabilityEligibleCount: 3,
      fullyEligibleBeforeRollCount: 1, rollFailedCount: 1, usurpationCount: 0,
      blockerCounts: { NO_ELIGIBLE_LEGITIMATE_SUCCESSOR: 1, NOT_STATE: 1, NOT_ACTIVE_STATE: 1,
        STABILITY_TOO_HIGH: 1, NO_SUCCESSION_CRISIS: 2, SUCCESSOR_NOT_VULNERABLE: 1, ROLL_FAILED: 1 } });
    expect(snapshot.recentFullyEligibleBoundaries[0]).toMatchObject({ factionId: "id", factionName: "旧国", month: 600,
      stability: 20, successionReason: "natural", successorAgeMonths: 120, evidence: ["MINOR_SUCCESSOR", "ONE_CITY_REMAINING"] });
  });
  it("bounds eligible samples at ten and resets all observations", () => {
    const diagnostics = new RevolutionGateDiagnostics(() => true);
    for (let month = 600; month < 615; month++) {
      const input = { ...context(), worldMonth: month, successionReason: "combat" as const };
      diagnostics.record("id", "旧国", input, evaluateDynasticRevolution(input, () => 0));
    }
    const snapshot = diagnostics.snapshot();
    expect(snapshot.usurpationCount).toBe(15);
    expect(snapshot.fullyEligibleBeforeRollCount).toBe(15);
    expect(snapshot.recentFullyEligibleBoundaries.map(boundary => boundary.month)).toEqual([614, 613, 612, 611, 610, 609, 608, 607, 606, 605]);
    snapshot.recentFullyEligibleBoundaries[0].evidence.push("not canonical");
    expect(diagnostics.snapshot().recentFullyEligibleBoundaries[0].evidence).not.toContain("not canonical");
    diagnostics.reset();
    expect(diagnostics.snapshot()).toMatchObject({ successionBoundaryCheckCount: 0, usurpationCount: 0, recentFullyEligibleBoundaries: [] });
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
