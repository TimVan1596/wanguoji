import { describe, expect, it } from "vitest";
import { createEmptyWorldSaveV1 } from "./WorldSaveSchema";
import { isSafeSnapshotBoundary } from "./SnapshotBoundary";
import { validateWorldSave } from "./WorldSaveValidator";

function fixture() {
  const save = createEmptyWorldSaveV1();
  save.world.worldMonth = 42;
  save.factions = [{ factionId: "qin", displayName: "秦" }];
  save.cities = [{ cityId: "xianyang", ownerFactionId: "qin", founderFactionId: "qin", foundedMonth: 0 }];
  save.users = [{ userId: 7, factionId: "qin", name: "嬴平" }];
  save.units = [{ unitId: "unit-1", factionId: "qin", userId: 7, x: 10, y: 20, vx: 1, vy: -1 }];
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
    save.users.push({ userId: 7, factionId: "qin" });
    save.units[0].x = Number.NaN;
    expect(validateWorldSave(save).valid).toBe(false);
    expect(validateWorldSave({ ...fixture(), world: new Date() }).valid).toBe(false);
  });

  it("requires a paused complete simulation boundary", () => {
    expect(isSafeSnapshotBoundary({ paused: true, clockElapsedMs: 0, simulationAccumulatorMs: 0 })).toBe(true);
    expect(isSafeSnapshotBoundary({ paused: false, clockElapsedMs: 0, simulationAccumulatorMs: 0 })).toBe(false);
    expect(isSafeSnapshotBoundary({ paused: true, clockElapsedMs: 1, simulationAccumulatorMs: 0 })).toBe(false);
    expect(isSafeSnapshotBoundary({ paused: true, clockElapsedMs: 0, simulationAccumulatorMs: 0.1 })).toBe(false);
  });
});
