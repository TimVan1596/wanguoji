import { describe, expect, it } from "vitest";
import { buildLongRunProfileSnapshot } from "./LongRunProfiler";

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
});
