import { describe, expect, it } from "vitest";
import { createEmptyWorldSaveV1, CURRENT_SAVE_SCHEMA_VERSION } from "./WorldSaveSchema";
import { isSafeSnapshotBoundary } from "./SnapshotBoundary";
import { validateWorldSave } from "./WorldSaveValidator";

function fixture() {
  const save = createEmptyWorldSaveV1();
  save.world.worldMonth = 42;
  save.world.clock.worldMonth = 42;
  save.factions = [{ factionId: "qin", displayName: "秦", color: 1, factionType: "KINGDOM", status: "ACTIVE", firstFoundedMonth: 0, currentActiveSinceMonth: 0, restorationMonths: [], cumulativeActiveMonths: 0, identityStage: "STATE", sovereigntyRank: "KING", sovereigntyHistory: [], nameHistory: [], origin: {}, homeGridX: 0, homeGridY: 0 }];
  save.cities = [{ cityId: "xianyang", name: "咸阳", ownerFactionId: "qin", founderFactionId: "qin", foundedMonth: 0, centerGridX: 0, centerGridY: 0, isCapital: true, defense: 10, maxDefense: 10, loyalty: 80, devastation: 0, captureCount: 0 }];
  save.users = [{ userId: 7, factionId: "qin", sourceFactionId: "qin", name: "嬴平", loyalty: 70, role: "RULER", score: 0, playerUnitId: "unit-1" }];
  save.units = [{ unitId: "unit-1", factionId: "qin", userId: 7, x: 10, y: 20, vx: 1, vy: -1, speed: 100, radius: 10, scale: 1, speedCoefficient: 0, sizeCoefficient: 0, alive: true, role: "RULER" }];
  save.dynasties = [{ factionId: "qin", rulers: [{ rulerId: "qin-ruler-1" }], heirIds: [] }];
  save.blocks = [{ gridX: 0, gridY: 0, ownerFactionId: "qin", isHome: true, cityId: "xianyang", homeHitPoints: 10, isCityCenter: true }];
  save.populationSystem = { counters: { qin: 3 }, lastGrowthMonth: 12 };
  return save;
}

describe("WorldSaveV1 validation and JSON contract", () => {
  it("uses schema V6 and persists alliance/merge fields plus the deterministic random stream", () => {
    const save = fixture();
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(6);
    expect(save.saveSchemaVersion).toBe(6);
    expect(save.diplomacy).toEqual({ relations: [], lastEvaluationMonth: -1 });
    expect(save.worldRandom).toMatchObject({ algorithm: "mulberry32-v1", seed: expect.any(String), state: expect.any(Number), position: 0 });
  });

  it("survives JSON stringify/parse with canonical month-index fields", () => {
    const save = fixture();
    const parsed = JSON.parse(JSON.stringify(save));
    expect(validateWorldSave(parsed)).toEqual({ valid: true, errors: [] });
    expect(parsed.world.worldMonth).toBe(42);
    expect(parsed.world).not.toHaveProperty("year");
    expect(parsed.cities[0].foundedMonth).toBe(0);
    expect(parsed.cities[0]).not.toHaveProperty("foundedYear");
    expect(parsed.units[0]).toMatchObject({ x: 10, y: 20, vx: 1, vy: -1 });
  });

  it("validates symmetric V6 treaty data and rejects the previous save schema", () => {
    const save = fixture();
    save.factions.push({ ...save.factions[0], factionId: "wei", displayName: "魏" });
    save.diplomacy.relations = [{ factionAId: "qin", factionBId: "wei", status: "TRUCE", startedMonth: 12, expiresMonth: 36, reason: "WAR_EXHAUSTION_TRUCE" }];
    expect(validateWorldSave(save).valid).toBe(true);
    expect(validateWorldSave({ ...save, saveSchemaVersion: 5 }).valid).toBe(false);
    expect(validateWorldSave({ ...save, diplomacy: { ...save.diplomacy, relations: [{ ...save.diplomacy.relations[0], factionAId: "wei", factionBId: "qin" }] } }).valid).toBe(false);
  });

  it("validates the alliance reason and persistent absorbed-faction terminal state", () => {
    const save = fixture();
    save.factions.push({ ...save.factions[0], factionId: "wei", displayName: "魏" });
    save.diplomacy.relations = [{
      factionAId: "qin", factionBId: "threat", status: "ALLIANCE", startedMonth: 12, expiresMonth: 132,
      reason: "COMMON_THREAT_ALLIANCE", commonThreatFactionId: "threat",
      preconditionStatus: "NON_AGGRESSION", preconditionStartedMonth: 0, preconditionDurationMonths: 24,
    }];
    save.factions.push({ ...save.factions[0], factionId: "threat", displayName: "强敌" });
    save.factions[1] = {
      ...save.factions[1], status: "EXTINCT", terminationReason: "MERGED",
      mergedIntoFactionId: "qin", mergedMonth: 48,
    };
    expect(validateWorldSave(save)).toEqual({ valid: true, errors: [] });
    expect(validateWorldSave({ ...save, saveSchemaVersion: 5 }).valid).toBe(false);
  });

  it("rejects multiple active alliances for one faction", () => {
    const save = fixture();
    save.factions.push(...["wei", "chu", "yan"].map((factionId) => ({ ...save.factions[0], factionId })));
    save.diplomacy.relations = [
      { factionAId: "qin", factionBId: "wei", status: "ALLIANCE", startedMonth: 1, expiresMonth: 121, reason: "COMMON_THREAT_ALLIANCE" },
      { factionAId: "chu", factionBId: "qin", status: "ALLIANCE", startedMonth: 1, expiresMonth: 121, reason: "COMMON_THREAT_ALLIANCE" },
    ];
    expect(validateWorldSave(save).errors).toContain("a faction may have at most one active alliance");
  });

  it("preserves active candidates, living kin, designation, and parent relationships in schema V6", () => {
    const save = fixture();
    save.dynasties = [{
      factionId: "qin",
      currentRulerId: "qin-ruler-1",
      heirIds: ["qin-ruler-2", "qin-ruler-3"],
      designatedHeirId: "qin-ruler-2",
      designatedSinceMonth: 36,
      rulers: [
        { rulerId: "qin-ruler-1", status: "dead" },
        { rulerId: "qin-ruler-2", status: "heir", parentId: "qin-ruler-1", relationType: "DIRECT_CHILD" },
        { rulerId: "qin-ruler-3", status: "heir", parentId: "qin-ruler-2", relationType: "DIRECT_CHILD" },
        { rulerId: "qin-ruler-4", status: "kin", parentId: "qin-ruler-1" },
      ],
    }];
    const loaded = JSON.parse(JSON.stringify(save));
    expect(validateWorldSave(loaded).valid).toBe(true);
    expect(loaded.dynasties[0].heirIds).toEqual(["qin-ruler-2", "qin-ruler-3"]);
    expect(loaded.dynasties[0]).toMatchObject({ designatedHeirId: "qin-ruler-2", designatedSinceMonth: 36 });
    expect(loaded.dynasties[0].rulers[2]).toMatchObject({ parentId: "qin-ruler-2", relationType: "DIRECT_CHILD" });
    expect(loaded.dynasties[0].rulers[3]).toMatchObject({ rulerId: "qin-ruler-4", status: "kin", parentId: "qin-ruler-1" });
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(6);
  });

  it("rejects a dynasty candidate list above the runtime bound", () => {
    const save = fixture();
    const rulerIds = Array.from({ length: 8 }, (_, index) => `qin-ruler-${index + 1}`);
    save.dynasties = [{
      factionId: "qin",
      currentRulerId: rulerIds[0],
      heirIds: rulerIds.slice(1),
      rulers: rulerIds.map((rulerId) => ({ rulerId, status: rulerId === rulerIds[0] ? "ruling" : "heir" })),
    }];
    expect(validateWorldSave(save).errors).toContain("dynasties[0].heirIds exceeds candidate limit");
  });

  it("rejects unsupported schema versions and dangling references", () => {
    const save = fixture();
    save.saveSchemaVersion = 3 as never;
    save.cities[0].ownerFactionId = "missing";
    const result = validateWorldSave(save);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("unsupported saveSchemaVersion");
    expect(result.errors.some((error) => error.includes("city.ownerFactionId"))).toBe(true);
  });

  it("rejects duplicate ids, non-finite values and class instances", () => {
    const save = fixture();
    save.users.push({ userId: 7, factionId: "qin", sourceFactionId: "qin", name: "duplicate", loyalty: 0, role: "NORMAL", score: 0, playerUnitId: "unit-1" });
    save.units[0].x = Number.NaN;
    expect(validateWorldSave(save).valid).toBe(false);
    expect(validateWorldSave({ ...fixture(), world: new Date() }).valid).toBe(false);
  });

  it("rejects Maps, Sets, functions and circular objects instead of silently losing them", () => {
    const save = fixture() as any;
    save.registries = { map: new Map([["x", 1]]), set: new Set(["x"]), callback: () => undefined };
    expect(validateWorldSave(save).valid).toBe(false);
    const circular: any = fixture();
    circular.registries = { self: circular };
    expect(validateWorldSave(circular).valid).toBe(false);
  });

  it("requires authoritative population sequence counters", () => {
    const save = fixture();
    save.populationSystem.counters = [] as never;
    expect(validateWorldSave(save).errors).toContain("populationSystem.counters must be an object");

    save.populationSystem = { counters: { qin: 1.5 }, lastGrowthMonth: 12 };
    expect(validateWorldSave(save).errors).toContain("populationSystem.counters.qin must be a non-negative integer");
  });

  it("validates WorldEventSystem Record maps and cycle state by their runtime shapes", () => {
    const save = fixture();
    save.worldEventSystem.cityFoundedMonths = { qin: 12 };
    save.worldEventSystem.cityRebellionMonths = { xianyang: 24 };
    save.worldEventSystem.cycleState = { fragmentationStartMonth: 0, hegemonicMomentum: 4 };
    expect(validateWorldSave(save).valid).toBe(true);

    save.worldEventSystem.cityFoundedMonths = [] as never;
    expect(validateWorldSave(save).errors).toContain("worldEventSystem.cityFoundedMonths must be an object");

    save.worldEventSystem.cityFoundedMonths = { qin: Number.POSITIVE_INFINITY };
    expect(validateWorldSave(save).errors).toContain("worldEventSystem.cityFoundedMonths.qin must be an integer month");

    save.worldEventSystem.cityFoundedMonths = {};
    save.worldEventSystem.cityRebellionMonths = [] as never;
    expect(validateWorldSave(save).errors).toContain("worldEventSystem.cityRebellionMonths must be an object");

    save.worldEventSystem.cityRebellionMonths = {};
    save.worldEventSystem.cycleState = [] as never;
    expect(validateWorldSave(save).errors).toContain("worldEventSystem.cycleState must be an object");
  });

  it("requires active city-cell HP to match authoritative City.defense", () => {
    const save = fixture();
    save.blocks[0].homeHitPoints = 10;
    save.blocks.push({ gridX: 1, gridY: 0, ownerFactionId: "qin", isHome: true, homeHitPoints: 3 });
    expect(validateWorldSave(save).valid).toBe(true);

    save.blocks[0].homeHitPoints = 9;
    expect(validateWorldSave(save).errors).toContain("block.homeHitPoints must match city.defense for active city xianyang");
  });

  it("rejects malformed imported nested arrays before hydration teardown", () => {
    const save = fixture();
    save.worldExiles = [{ factionId: "qin", heirIds: null } as never];
    expect(validateWorldSave(save).errors).toContain("worldExiles[0].heirIds must be an array of strings");

    save.worldExiles = [];
    save.registries.archivedCities = [{ id: "old-city", historicalOwners: [], history: [null] }];
    expect(validateWorldSave(save).errors).toContain("registries.archivedCities[0].history must be an array of objects");
  });

  it("requires a paused complete simulation boundary", () => {
    expect(isSafeSnapshotBoundary({ paused: true, clockElapsedMs: 0, simulationAccumulatorMs: 0 })).toBe(true);
    expect(isSafeSnapshotBoundary({ paused: false, clockElapsedMs: 0, simulationAccumulatorMs: 0 })).toBe(false);
    expect(isSafeSnapshotBoundary({ paused: true, clockElapsedMs: 1, simulationAccumulatorMs: 0 })).toBe(false);
    expect(isSafeSnapshotBoundary({ paused: true, clockElapsedMs: 0, simulationAccumulatorMs: 0.1 })).toBe(false);
  });
});
