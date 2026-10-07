import { afterEach, describe, expect, it, vi } from "vitest";
const { game } = vi.hoisted(() => ({ game: { Core: undefined as any, BlockSize: 32 } }));
vi.mock("../Game/Game", () => ({ default: game }));
vi.mock("../Components/Block", () => ({ default: class {} }));
vi.mock("../Components/Player", () => ({ default: class {} }));
vi.mock("../Components/User", () => ({ default: class {} }));
vi.mock("../Components/Npc", () => ({ default: class {} }));
vi.mock("../Components/Team", () => ({ default: class {
  static hydrate(_scene: unknown, state: any) { return { ...state, name: state.factionId, cities: [], users: new Set(), farms: { npcs: new Map(), init() {} },
    addCity(city: any) { this.cities.push(city as never); }, exportState: () => structuredClone(state) }; }
} }));
vi.mock("../Components/City", () => ({ default: class {
  static hydrate(state: any, block: any) { return { ...state, id: state.cityId, block, fortifiedCells: [],
    rebuildRuntimeVisuals() {}, exportState: () => structuredClone(state) }; }
} }));
vi.mock("../Simulation/WorldInvariant", () => ({ validateWorldState: () => [] })); // separate real City lifecycle tests cover map refs
import type Core from "../Game/Core";
import { hydrateWorldSave } from "./WorldSaveHydrator";
import { exportWorldSave } from "./WorldSaveExporter";
import { createEmptyWorldSaveV9 } from "./WorldSaveSchema";
import { validateWorldSave } from "./WorldSaveValidator";
import { normalizeArchivedCityBlockRefs } from "./ArchivedCityHydrationRepair";
import { createStoredWorldSaveRecord, validateStoredWorldSaveRecord } from "./WorldSaveRepository";
import WorldHistory from "../History/WorldHistory";
import worldRandom from "../Simulation/WorldRandom";
import { createBlockSaveProjection } from "./BlockSaveProjection";

function fixture() {
  const save = createEmptyWorldSaveV9();
  save.world.started = true; save.world.worldMonth = 42; save.world.clock.worldMonth = 42;
  save.world.map = { widthCells: 3, heightCells: 1, blockSize: 32 };
  save.factions = [{ factionId: "qin", displayName: "秦", color: 1, colorHistory: [{ color: 1, startMonth: 0, reason: "FOUNDING" }],
    factionType: "KINGDOM", status: "ACTIVE", firstFoundedMonth: 0, currentActiveSinceMonth: 0, restorationMonths: [], cumulativeActiveMonths: 0,
    identityStage: "STATE", sovereigntyRank: "KING", sovereigntyHistory: [], nameHistory: [], origin: {}, homeGridX: 0, homeGridY: 0, capitalCityId: "active" }];
  save.cities = [{ cityId: "active", name: "现城", founderFactionId: "qin", ownerFactionId: "qin", centerGridX: 0, centerGridY: 0,
    foundedMonth: 0, isCapital: true, defense: 7, maxDefense: 10, loyalty: 80, devastation: 0, captureCount: 0, fortifiedCells: [{ gridX: 0, gridY: 0 }] }];
  save.blocks = Array.from({ length: 3 }, (_, gridX) => ({ gridX, gridY: 0, ownerFactionId: "qin", isHome: gridX === 0,
    isCityCenter: gridX === 0, homeHitPoints: gridX === 0 ? 7 : 0, ...(gridX === 0 ? { cityId: "active" } : {}) }));
  save.registries.archivedCities = [{ id: "秦-city-312-2", name: "旧城", founderFactionId: "qin", lastOwnerFactionId: "qin", foundedMonth: 1,
    destroyedMonth: 30, captureCount: 2, historicalOwners: ["qin"], history: [] }];
  return save;
}
function target() {
  let sim: any = { started: true, running: false, selectedSpeed: 4, clock: { worldMonth: 500, elapsedMs: 0, running: false }, populationSystem: { counters: {}, lastGrowthMonth: 0 }, worldEventSystem: fixture().worldEventSystem };
  const core: any = { teams: ["old teams"], units: ["old units"], oldCities: ["old cities"], scene: { renderer: { width: 96, height: 32 },
    physics: { world: { pause() {} } }, time: {}, tweens: { pauseAll() {} } },
    backgroundProgression: { isCatchingUp: () => false }, simulationDriver: { exportState: () => ({ accumulatorMs: 0 }), importState() {} },
    logicalUnitRegistry: { importState() {}, getAliveUnits: () => [], exportState: () => ({ nextUnitSequence: 1 }) },
    simulator: { exportState: () => sim, importState: (state: any) => { sim = { ...state, running: false }; }, rebaseProfilerLatches() {}, setRunning() {}, getCurrentPhase: () => "fragmented" },
    setHydrationStage(stage: string) { this.stage = stage; }, setHydrationRepairs(repairs: any) { this.repairs = repairs; },
    setHydratedFactionShells(teams: any) { this.teams = teams; }, resetDeterminismDiagnostics() {}, installHydratedTeams() {}, setSimulationSpeed() {}, notifyDesktopHeartbeat() {},
  };
  core.prepareForHydration = vi.fn(() => {
    core.units = []; core.oldCities = [];
    core.map = { blocks: Array.from({ length: 3 }, (_, x) => [{ x: x * 32, y: 0,
      restoreCanonicalState(state: any) { Object.assign(this, { team: state.owner, city: state.city, hp: state.hp, isHome: state.isHome, isCityCenter: state.isCityCenter }); },
    }]), getMaxX: () => 3, getMaxY: () => 1 };
  });
  Object.defineProperty(core, "allCities", { get: () => core.teams.flatMap((team: any) => team.cities ?? []) });
  game.Core = core; return core;
}
afterEach(() => { vi.restoreAllMocks(); });
describe("V9 active city referential integrity and pre-teardown repair", () => {
  it("V10 actual hydrate/export round-trip retains diplomacy renewal and cooldown state without RNG draws",()=>{
    const save=fixture();save.factions.push({...save.factions[0],factionId:"wei",capitalCityId:undefined});
    save.diplomacy.relations=[{factionAId:"qin",factionBId:"wei",status:"NON_AGGRESSION",reason:"COMMON_THREAT_NON_AGGRESSION",originalStartedMonth:0,startedMonth:12,expiresMonth:180,lastRenewedMonth:36,renewalCount:1}];
    save.diplomacy.pairMemories=[{factionAId:"qin",factionBId:"wei",lastStatus:"TRUCE",lastReason:"WAR_EXHAUSTION_TRUCE",endedMonth:10,cooldownUntilMonth:34}];
    const core=target();hydrateWorldSave(core,save);const rng=worldRandom.exportState();const exported=exportWorldSave(core);
    expect(exported.diplomacy).toEqual(save.diplomacy);expect(validateWorldSave(exported)).toEqual({valid:true,errors:[]});
    hydrateWorldSave(core,exported);expect(exportWorldSave(core).diplomacy).toEqual(save.diplomacy);expect(worldRandom.exportState()).toEqual(rng);
  });
  it("strict validation rejects archived block pointers; repository admits only proven repairable records without mutation", () => {
    const save = fixture(); save.blocks[1] = { ...save.blocks[1], cityId: "秦-city-312-2", isCityCenter: true, isHome: true, homeHitPoints: 12 };
    expect(validateWorldSave(save).valid).toBe(false);
    const record = createStoredWorldSaveRecord(save), before = JSON.stringify(record);
    expect(validateStoredWorldSaveRecord(record).valid).toBe(true); expect(JSON.stringify(record)).toBe(before);
    const normalized = normalizeArchivedCityBlockRefs(save);
    expect(normalized.repairs).toMatchObject({ staleArchivedCityBlockRefs: 1, cityIds: ["秦-city-312-2"] });
    expect(validateWorldSave(normalized.value).valid).toBe(true);
    expect((normalized.value as typeof save).blocks[1]).toMatchObject({ isHome: false, isCityCenter: false, homeHitPoints: 0 });
    expect((normalized.value as typeof save).blocks[1]).not.toHaveProperty("cityId");
  });
  it("refuses to infer destruction from an incomplete archive entry, and never spends repair RNG", () => {
    const save = fixture(); save.blocks[1].cityId = "秦-city-312-2";
    const rng = worldRandom.exportState();
    const normalized = normalizeArchivedCityBlockRefs(save);
    expect(normalized.repairs.staleArchivedCityBlockRefs).toBe(1);
    expect(worldRandom.exportState()).toEqual(rng);
    delete (save.registries.archivedCities as Array<Record<string, unknown>>)[0].destroyedMonth;
    expect(normalizeArchivedCityBlockRefs(save).repairs.staleArchivedCityBlockRefs).toBe(0);
    const record = createStoredWorldSaveRecord(save); expect(validateStoredWorldSaveRecord(record).valid).toBe(false);
    const core = target(); expect(() => hydrateWorldSave(core as Core, save)).toThrow(/unknown active block.cityId/);
    expect(core.prepareForHydration).not.toHaveBeenCalled();
  });
  it("actual export -> hydrate -> export preserves active refs; repaired save reload no longer needs repair", () => {
    const save = fixture(); save.blocks[2] = { ...save.blocks[2], cityId: "秦-city-312-2", isCityCenter: true, isHome: true, homeHitPoints: 12 };
    const original = JSON.stringify(save), core = target();
    const report = hydrateWorldSave(core as Core, save);
    expect(report.hydrationRepairs.staleArchivedCityBlockRefs).toBe(1); expect(JSON.stringify(save)).toBe(original);
    expect(core.simulator.exportState().clock.worldMonth).toBe(42);
    const first = exportWorldSave(core as Core);
    expect(validateWorldSave(first)).toEqual({ valid: true, errors: [] });
    expect(first.blocks.every(block => !block.cityId || first.cities.some(city => city.cityId === block.cityId))).toBe(true);
    expect(hydrateWorldSave(core as Core, first).hydrationRepairs.staleArchivedCityBlockRefs).toBe(0);
    expect(exportWorldSave(core as Core)).toEqual(first);
  });
  it("unknown city PRECHECK rejection preserves the actual old runtime and history/RNG", () => {
    const save = fixture(); save.blocks[1].cityId = "not-archived";
    const core = target(), teams = core.teams, units = core.units, cities = core.oldCities;
    const history = WorldHistory.exportState(), rng = worldRandom.exportState();
    expect(() => hydrateWorldSave(core as Core, save)).toThrow(/unknown active block.cityId/);
    expect(core.prepareForHydration).not.toHaveBeenCalled(); expect(core.stage).toBe("PRECHECK_FAILED");
    expect(core.teams).toBe(teams); expect(core.units).toBe(units); expect(core.oldCities).toBe(cities);
    expect(core.simulator.exportState().clock.worldMonth).toBe(500);
    expect(WorldHistory.exportState()).toEqual(history); expect(worldRandom.exportState()).toEqual(rng);
    expect(core.repairs.unresolvedCityBlockRefs[0]).toMatchObject({ gridX: 1, gridY: 0, owner: "qin", cityId: "not-archived" });
  });
  it.each(["capital", "zone", "center", "owner", "blockOwner", "blockCityType"])("rejects malformed %s references before teardown", kind => {
    const save = fixture();
    if (kind === "blockCityType") {
      save.cities[0].cityId = "123"; save.factions[0].capitalCityId = "123"; save.blocks[0].cityId = "123";
      save.blocks[1].cityId = 123 as unknown as string; save.blocks[1].homeHitPoints = 7;
    }
    if (kind === "capital") save.factions[0].capitalCityId = "秦-city-312-2";
    if (kind === "zone") save.cities[0].fortifiedCells = [{ gridX: 2, gridY: 0 }];
    if (kind === "center") { delete save.blocks[0].cityId; }
    if (kind === "owner") save.cities[0].ownerFactionId = "missing";
    if (kind === "blockOwner") save.blocks[0].ownerFactionId = "missing";
    const core = target(); expect(() => hydrateWorldSave(core as Core, save)).toThrow(); expect(core.prepareForHydration).not.toHaveBeenCalled();
  });
  it("valid V9 round-trip has zero repairs and preserves RNG; exporter refuses stale/non-zone pointers", () => {
    const core = target(); const save = fixture(), rng = worldRandom.exportState();
    expect(hydrateWorldSave(core as Core, save).hydrationRepairs.staleArchivedCityBlockRefs).toBe(0);
    const first = exportWorldSave(core as Core); hydrateWorldSave(core as Core, first);
    expect(exportWorldSave(core as Core)).toEqual(first); expect(worldRandom.exportState()).toEqual(rng);
    core.map.blocks[1][0].city = { id: "unknown", fortifiedCells: [] };
    expect(() => exportWorldSave(core as Core)).toThrow("Cannot export block reference to non-active city unknown");
    expect(() => createBlockSaveProjection({ hp: 1, city: { id: "unknown", defense: 1 }, isHome: true, isCityCenter: false }, 0, 0, new Set(["active"]))).toThrow("non-active city");
    core.map.blocks[1][0].city = core.allCities[0];
    expect(() => exportWorldSave(core as Core)).toThrow("outside its fortifiedCells");
  });
});
