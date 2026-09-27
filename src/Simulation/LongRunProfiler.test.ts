import { describe, expect, it } from "vitest";
import { buildLongRunProfileSnapshot, deriveLongRunSummary } from "./LongRunProfiler";

describe("long run profiler", () => {
  it("summarizes live and archived world counts without mutating simulation data", () => {
    const teams = [
      {
        status: "ACTIVE",
        cities: [{ id: "a" }, { id: "b" }],
        players: { children: { size: 5 } },
      },
      {
        status: "EXILED",
        cities: [],
        players: { children: { size: 0 } },
      },
      {
        status: "EXTINCT",
        cities: [],
        players: { children: { size: 0 } },
      },
    ] as any;
    const snapshot = buildLongRunProfileSnapshot(24000, teams, 1.25, {
      archivedCities: 3,
      totalRulers: 48,
      historyEvents: 1200,
      factionSnapshots: 240,
      worldEras: 8,
      fragmentationAge: 720,
      unifiedAge: 0,
      cycleStage: "CONSOLIDATING",
      consolidationModifier: 0.5,
      dynasticGraceMultiplier: 1,
      dynasticFatigueMultiplier: 1,
      hegemonicCandidateId: "qin",
      hegemonicMomentum: 0.6,
      hegemonicSiegeMultiplier: 1.1,
      consolidationLeaderId: "qin",
      consolidationLeaderMomentum: 0.8,
      stateFormationBlockers: { CITY_COUNT: 2, STABILITY: 1 },
      provisionalOverageCount: 2,
      controlledBlocks: 320,
      neutralBlocks: 680,
      top1AbsoluteShare: 12.5,
      top1ControlledShare: 39.1,
      top2ControlledShare: 21.7,
    });
    expect(snapshot.worldMonth).toBe(24000);
    expect(snapshot.activeFactions).toBe(1);
    expect(snapshot.exiledFactions).toBe(1);
    expect(snapshot.extinctFactions).toBe(1);
    expect(snapshot.activeCities).toBe(2);
    expect(snapshot.archivedCities).toBe(3);
    expect(snapshot.runtimePlayers).toBe(5);
    expect(snapshot.totalRulers).toBe(48);
    expect(snapshot.historyEvents).toBe(1200);
    expect(snapshot.factionSnapshots).toBe(240);
    expect(snapshot.worldEras).toBe(8);
    expect(snapshot.fragmentationAge).toBe(720);
    expect(snapshot.unifiedAge).toBe(0);
    expect(snapshot.cycleStage).toBe("CONSOLIDATING");
    expect(snapshot.consolidationModifier).toBe(0.5);
    expect(snapshot.dynasticGraceMultiplier).toBe(1);
    expect(snapshot.dynasticFatigueMultiplier).toBe(1);
    expect(snapshot.hegemonicCandidateId).toBe("qin");
    expect(snapshot.hegemonicMomentum).toBe(0.6);
    expect(snapshot.hegemonicSiegeMultiplier).toBe(1.1);
    expect(snapshot.consolidationLeaderId).toBe("qin");
    expect(snapshot.consolidationLeaderMomentum).toBe(0.8);
    expect(snapshot.stateFormationBlockers).toEqual({ CITY_COUNT: 2, STABILITY: 1 });
    expect(snapshot.provisionalOverageCount).toBe(2);
    expect(snapshot.controlledBlocks).toBe(320);
    expect(snapshot.neutralBlocks).toBe(680);
    expect(snapshot.top1AbsoluteShare).toBe(12.5);
    expect(snapshot.top1ControlledShare).toBe(39.1);
    expect(snapshot.top2ControlledShare).toBe(21.7);
    expect(snapshot.monthlyStepMs).toBe(1.25);
  });

  it("pairs unified and fragmented transitions into completed episodes", () => {
    const summary = deriveLongRunSummary(700, [], [
      { kind: "WORLD_FRAGMENTED", month: 0 },
      { kind: "WORLD_UNIFIED", month: 100 },
      { kind: "WORLD_FRAGMENTED", month: 300 },
      { kind: "WORLD_UNIFIED", month: 400 },
      { kind: "WORLD_FRAGMENTED", month: 700 },
    ]);
    expect(summary.completedUnifiedEpisodes).toBe(2);
    expect(summary.averageUnifiedDuration).toBe(250);
    expect(summary.medianUnifiedDuration).toBe(250);
    expect(summary.shortestUnifiedDuration).toBe(200);
    expect(summary.longestUnifiedDuration).toBe(300);
    expect(summary.completedFragmentedEpisodes).toBe(2);
    expect(summary.averageFragmentedDuration).toBe(100);
    expect(summary.medianFragmentedDuration).toBe(100);
  });

  it("does not count a current incomplete episode in completed statistics", () => {
    const summary = deriveLongRunSummary(500, [], [
      { kind: "WORLD_FRAGMENTED", month: 0 },
      { kind: "WORLD_UNIFIED", month: 120 },
      { kind: "CYCLE_STAGE_CHANGED", month: 240, from: "UNIFIED_EARLY", to: "UNIFIED_MATURE" },
    ]);
    expect(summary.completedUnifiedEpisodes).toBe(0);
    expect(summary.averageUnifiedDuration).toBeUndefined();
    expect(summary.currentUnifiedAge).toBe(380);
    expect(summary.completedFragmentedEpisodes).toBe(1);
    expect(summary.averageFragmentedDuration).toBe(120);
  });

  it("treats the initial fragmented baseline as an age, not a fragmentation event", () => {
    const summary = deriveLongRunSummary(720, [], [], "CONSOLIDATING", 0, "FRAGMENTED");
    expect(summary.fragmentationCount).toBe(0);
    expect(summary.completedFragmentedEpisodes).toBe(0);
    expect(summary.currentFragmentedAge).toBe(720);
  });
});
