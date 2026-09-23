import { describe, expect, it } from "vitest";
import { createEmptyWorldSaveV1 } from "./WorldSaveSchema";
import { isSafeSnapshotBoundary } from "./SnapshotBoundary";
import { validateWorldSave } from "./WorldSaveValidator";

function fixture() {
  const save = createEmptyWorldSaveV1();
  save.world.worldMonth = 42;
  save.factions = [{ factionId: "qin", displayName: "秦", color: 1, factionType: "KINGDOM", status: "ACTIVE", firstFoundedMonth: 0, currentActiveSinceMonth: 0, restorationMonths: [], cumulativeActiveMonths: 0, identityStage: "STATE", sovereigntyRank: "KING", sovereigntyHistory: [], nameHistory: [], origin: {}, homeGridX: 0, homeGridY: 0 }];
  save.cities = [{ cityId: "xianyang", name: "咸阳", ownerFactionId: "qin", founderFactionId: "qin", foundedMonth: 0, centerGridX: 0, centerGridY: 0, isCapital: true, defense: 10, maxDefense: 10, loyalty: 80, devastation: 0, captureCount: 0 }];
  save.users = [{ userId: 7, factionId: "qin", sourceFactionId: "qin", name: "嬴平", loyalty: 70, role: "RULER", score: 0, playerUnitId: "unit-1" }];
  save.units = [{ unitId: "unit-1", factionId: "qin", userId: 7, x: 10, y: 20, vx: 1, vy: -1, speed: 100, radius: 10, scale: 1, speedCoefficient: 0, sizeCoefficient: 0, alive: true, role: "RULER" }];
  save.dynasties = [{ factionId: "qin", rulers: [{ rulerId: "qin-ruler-1" }] }];
  save.blocks = [{ gridX: 0, gridY: 0, ownerFactionId: "qin", isHome: true, cityId: "xianyang" }];
  return save;
}

describe("WorldSaveV1 validation and JSON contract", () => {
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

  it("rejects unsupported schema versions and dangling references", () => {
    const save = fixture();
    save.saveSchemaVersion = 2 as never;
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

  it("requires a paused complete simulation boundary", () => {
    expect(isSafeSnapshotBoundary({ paused: true, clockElapsedMs: 0, simulationAccumulatorMs: 0 })).toBe(true);
    expect(isSafeSnapshotBoundary({ paused: false, clockElapsedMs: 0, simulationAccumulatorMs: 0 })).toBe(false);
    expect(isSafeSnapshotBoundary({ paused: true, clockElapsedMs: 1, simulationAccumulatorMs: 0 })).toBe(false);
    expect(isSafeSnapshotBoundary({ paused: true, clockElapsedMs: 0, simulationAccumulatorMs: 0.1 })).toBe(false);
  });
});
