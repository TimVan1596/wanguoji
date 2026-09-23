import { describe, expect, it } from "vitest";
import { createEmptyWorldSaveV1, isCanonicalWorldSaveEquivalent } from "./WorldSaveSchema";
import { validateWorldSave } from "./WorldSaveValidator";
import WorldHistory from "../History/WorldHistory";
import WorldEra from "../Simulation/WorldEra";
import FactionSnapshots from "../Simulation/FactionSnapshots";
import FactionEffects from "../Simulation/FactionEffects";
import WorldRemnants from "../Simulation/WorldRemnants";

describe("runtime hydration foundation", () => {
  it("keeps canonical JSON projections equal when only creation metadata differs", () => {
    const before = createEmptyWorldSaveV1();
    before.createdAt = "2026-01-01T00:00:00.000Z";
    const after = { ...before, createdAt: "2026-02-01T00:00:00.000Z" };
    expect(isCanonicalWorldSaveEquivalent(before, after)).toBe(true);
  });

  it("rejects malformed references before touching a hydration target", () => {
    const save = createEmptyWorldSaveV1();
    save.factions = [{ factionId: "qin", displayName: "秦", color: 1, factionType: "KINGDOM", status: "ACTIVE", firstFoundedMonth: 0, currentActiveSinceMonth: 0, restorationMonths: [], cumulativeActiveMonths: 0, identityStage: "STATE", sovereigntyRank: "KING", sovereigntyHistory: [], nameHistory: [], origin: {}, homeGridX: 0, homeGridY: 0 }];
    save.cities = [{ cityId: "xianyang", name: "咸阳", ownerFactionId: "missing", founderFactionId: "qin", foundedMonth: 0, centerGridX: 0, centerGridY: 0, isCapital: true, defense: 10, maxDefense: 10, loyalty: 80, devastation: 0, captureCount: 0 }];
    expect(validateWorldSave(save).valid).toBe(false);
  });

  it("imports WorldHistory without creating new historical facts", () => {
    const original = WorldHistory.exportState();
    const fixture = {
      events: [{ id: "evt-restore-check", year: 12, monthIndex: 12, type: "world-born", title: "世界诞生", metadata: {} }],
      emittedKeys: ["world-born:12"], populationLeader: undefined, territoryLeader: undefined,
      populationCandidate: undefined, territoryCandidate: undefined, extinctFactionIds: [], sequence: 7, unificationCount: 0,
    };
    WorldHistory.importState(fixture as never);
    expect(WorldHistory.getEventCount()).toBe(1);
    expect(WorldHistory.exportState().sequence).toBe(7);
    expect(WorldHistory.exportState().events[0].id).toBe("evt-restore-check");
    WorldHistory.importState(original as never);
  });

  it("round-trips era, snapshot, effect, and remnant import state without creating facts", () => {
    const eraBefore = WorldEra.exportState();
    const snapshotsBefore = FactionSnapshots.exportState();
    const effectsBefore = FactionEffects.exportState();
    const remnantsBefore = WorldRemnants.exportState();
    const eraFixture = { ...eraBefore, sequence: eraBefore.sequence + 2, lastObservedMonth: 240 };
    WorldEra.importState(eraFixture);
    expect(WorldEra.exportState()).toEqual(eraFixture);
    const snapshotFixture = { ...snapshotsBefore, lastSnapshotMonth: 144 };
    FactionSnapshots.importState(snapshotFixture);
    expect(FactionSnapshots.exportState()).toEqual(snapshotFixture);
    const effectFixture = { ...effectsBefore, sequence: effectsBefore.sequence + 3 };
    FactionEffects.importState(effectFixture);
    expect(FactionEffects.exportState()).toEqual(effectFixture);
    WorldRemnants.importState([{ factionId: "qin", population: 2, extinctMonth: 120 }]);
    expect(WorldRemnants.exportState()).toEqual([{ factionId: "qin", population: 2, extinctMonth: 120 }]);
    WorldEra.importState(eraBefore);
    FactionSnapshots.importState(snapshotsBefore);
    FactionEffects.importState(effectsBefore);
    WorldRemnants.importState(remnantsBefore);
  });

});
