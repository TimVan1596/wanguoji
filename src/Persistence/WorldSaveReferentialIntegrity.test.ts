import { setFixtureLifetimeRecords } from "./testing/FactionLifetimeFixture";
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
vi.mock("../Components/City", () => ({ getFactionStability: () => 80, default: class {
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
import DynastyRegistry from "../Politics/Dynasty";
import { exportRulerSave } from "./RulerSaveProjection";
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
  setFixtureLifetimeRecords(save);
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
  it("new seven-faction rulers use the actual initialization path and export/validate/hydrate as V13", () => {
    const save = fixture(), core = target();
    const names = ["qin", "chu", "yan", "qi", "han", "zhao", "wei"];
    const base = save.factions[0]; save.factions = names.map(factionId => ({ ...base, factionId, ...(factionId === "qin" ? {} : { capitalCityId: undefined }) }));
    setFixtureLifetimeRecords(save);
    DynastyRegistry.reset(); WorldHistory.reset(); worldRandom.initialize("seven-new-v13");
    const teams = names.map(name => ({ name, displayName: name, status: "ACTIVE", identityStage: "STATE", sovereigntyRank: "KING", factionType: "KINGDOM", stateFoundedMonth: 0,
      users: new Set(), cities: [], blocks: { children: { size: 0 } }, removeRulerUnit() {}, makeUser() {} }));
    core.teams = teams; Object.defineProperty(core, "totalCells", { value: 3 });
    teams.forEach(team => DynastyRegistry.initializeFaction(team as any, 0));
    const state = DynastyRegistry.exportState();
    save.dynasties = state.dynasties.map(d => ({ ...d, rulers: d.rulers.map(exportRulerSave) }));
    save.registries.dynastyRegistrySequence = state.sequence; save.worldHistory = WorldHistory.exportState(); save.worldRandom = worldRandom.exportState();
    expect(state.dynasties).toHaveLength(7);
    expect(state.dynasties.every(d => d.rulers.some(r => r.id === d.currentRulerId && r.status === "ruling" && r.deathMonth === undefined))).toBe(true);
    const encoded = JSON.parse(JSON.stringify(save));
    expect(validateWorldSave(encoded)).toEqual({ valid: true, errors: [] });
    hydrateWorldSave(core, encoded); const first = exportWorldSave(core);
    expect(first.dynasties).toEqual(encoded.dynasties); expect(first.worldHistory).toEqual(save.worldHistory);
    hydrateWorldSave(core, first); expect(exportWorldSave(core)).toEqual(first); expect(worldRandom.exportState()).toEqual(save.worldRandom);
  });
  it("V13 preserves independently ended offices, actual deaths, retirement, family and RNG across hydration", () => {
    const save = fixture();
    save.dynasties = [{ factionId: "qin", houseName: "田氏", currentRulerId: "current", heirIds: [],
      houseEpochs: [{ houseName: "田氏", startMonth: 0, foundingRulerId: "dead", startReason: "FOUNDING" }],
      rulers: [
        { rulerId: "dead", houseName: "田氏", givenName: "古", bornMonth: -360, accessionMonth: 0, endMonth: 10, politicalEndMonth: 10, status: "dead", endReason: "去世", deathMonth: 10, deathReason: "去世" },
        { rulerId: "unknown", houseName: "田氏", givenName: "终", bornMonth: -200, accessionMonth: 10, endMonth: 20, politicalEndMonth: 20, status: "politically-ended", endReason: "政治终结", predecessorId: "dead" },
        { rulerId: "retired", houseName: "田氏", givenName: "退", bornMonth: -100, accessionMonth: 20, endMonth: 30, politicalEndMonth: 30, status: "abdicated", endReason: "合邦退位", parentId: "unknown" },
        { rulerId: "current", houseName: "田氏", givenName: "今", bornMonth: 0, accessionMonth: 30, status: "ruling", predecessorId: "retired" },
      ] }];
    expect(validateWorldSave(save)).toEqual({ valid: true, errors: [] });
    const core = target(); hydrateWorldSave(core, save); const first = exportWorldSave(core);
    expect(first.dynasties[0].rulers).toEqual(save.dynasties[0].rulers);
    expect(first.saveSchemaVersion).toBe(13); expect(worldRandom.exportState()).toEqual(save.worldRandom);
    hydrateWorldSave(core, JSON.parse(JSON.stringify(first))); expect(exportWorldSave(core)).toEqual(first);
  });
  it.each(["old-v12", "status", "dead-no-proof", "political-death-cause", "death-before-birth", "future-death", "incomplete-death", "end-before-accession", "missing-political-end", "unknown-posthumous", "terminal-office", "cross-faction-current", "event-reference"])("rejects %s during PRECHECK without tearing down the running world", kind => {
    const save = fixture();
    const ruler: any = { rulerId: "r1", houseName: "田氏", bornMonth: 0, accessionMonth: 1, status: "ruling" };
    save.dynasties = [{ factionId: "qin", houseName: "田氏", currentRulerId: "r1", heirIds: [],
      houseEpochs: [{ houseName: "田氏", startMonth: 1, foundingRulerId: "r1", startReason: "FOUNDING" }], rulers: [ruler] }];
    if (kind === "old-v12") (save as any).saveSchemaVersion = 12;
    if (kind === "status") ruler.status = "deposed";
    if (["dead-no-proof", "political-death-cause", "death-before-birth", "future-death", "incomplete-death"].includes(kind)) {
      Object.assign(ruler, { status: "dead", endMonth: 20, politicalEndMonth: 20, deathMonth: 20, deathReason: "去世" });
      if (kind === "dead-no-proof") { delete ruler.deathMonth; delete ruler.deathReason; }
      if (kind === "political-death-cause") ruler.deathReason = "彻底灭亡";
      if (kind === "death-before-birth") ruler.deathMonth = -1;
      if (kind === "future-death") ruler.deathMonth = 43;
      if (kind === "incomplete-death") delete ruler.deathReason;
    }
    if (["end-before-accession", "missing-political-end", "unknown-posthumous"].includes(kind)) {
      Object.assign(ruler, { status: "politically-ended", endMonth: 20, politicalEndMonth: 20, endReason: "政治终结" });
      save.dynasties[0].currentRulerId = null;
      if (kind === "end-before-accession") ruler.endMonth = ruler.politicalEndMonth = 0;
      if (kind === "missing-political-end") delete ruler.politicalEndMonth;
      if (kind === "unknown-posthumous") ruler.templeName = "世宗";
    }
    if (kind === "terminal-office") { Object.assign(save.factions[0], { status: "EXTINCT", terminationReason: "EXTINCT", terminationMonth: 30, extinctionMonth: 30 }); setFixtureLifetimeRecords(save); }
    if (kind === "cross-faction-current") save.dynasties[0].currentRulerId = "other";
    if (kind === "event-reference") save.worldHistory.events = [{ id: "bad", monthIndex: 20, year: 20, type: "ruler-died", category: "politics", title: "bad", rulerId: "missing", importance: "major" }] as any;
    const core = target(), teams = core.teams, units = core.units, cities = core.oldCities;
    const history = WorldHistory.exportState(), rng = worldRandom.exportState();
    expect(validateWorldSave(save).valid).toBe(false);
    if (kind === "old-v12") expect(() => hydrateWorldSave(core, save)).toThrow("此存档为旧版V12，当前V13不支持读取，请新建世界。");
    else expect(() => hydrateWorldSave(core, save)).toThrow();
    expect(core.prepareForHydration).not.toHaveBeenCalled(); expect(core.stage).toBe("PRECHECK_FAILED");
    expect(core.teams).toBe(teams); expect(core.units).toBe(units); expect(core.oldCities).toBe(cities);
    expect(core.simulator.exportState().clock.worldMonth).toBe(500);
    expect(WorldHistory.exportState()).toEqual(history); expect(worldRandom.exportState()).toEqual(rng);
  });
  it("V12 preserves lifetime peaks, observations and RNG across actual hydrate/export", () => {
    const save = fixture();
    save.factionLifetime.records[0].peakPopulation = { value: 900, month: 10, source: "MONTHLY" };
    save.factionLifetime.records[0].peakTerritoryBlocks = { value: 3, month: 11, source: "MONTHLY" };
    save.factionLifetime.records[0].peakCityCount = { value: 2, month: 12, source: "PRE_TERMINAL" };
    const core = target(); hydrateWorldSave(core, save);
    const exported = exportWorldSave(core);
    expect(exported.factionLifetime).toEqual(save.factionLifetime);
    hydrateWorldSave(core, exported); expect(exportWorldSave(core)).toEqual(exported);
    expect(worldRandom.exportState()).toEqual(save.worldRandom);
    expect(validateWorldSave({ ...exported, saveSchemaVersion: 11 }).valid).toBe(false);
  });
  it("rejects bad V12 lifetime evidence and V11 before teardown, preserving the old world", () => {
    for (const malformed of ["future", "unknown", "old-schema"]) {
      const save = fixture();
      if (malformed === "future") save.factionLifetime.records[0].peakPopulation.month = 1000;
      if (malformed === "unknown") save.factionLifetime.records[0].factionId = "missing";
      if (malformed === "old-schema") (save as any).saveSchemaVersion = 11;
      const core = target(), oldTeams = core.teams, oldUnits = core.units, oldCities = core.oldCities;
      const history = WorldHistory.exportState();
      expect(() => hydrateWorldSave(core, save)).toThrow();
      expect(core.prepareForHydration).not.toHaveBeenCalled(); expect(core.stage).toBe("PRECHECK_FAILED");
      expect(core.teams).toBe(oldTeams); expect(core.units).toBe(oldUnits); expect(core.oldCities).toBe(oldCities);
      expect(core.simulator.exportState().clock.worldMonth).toBe(500);
      expect(WorldHistory.exportState()).toEqual(history);
    }
  });
  it("V11 submission hydrate/export preserves terminal identity, abdication archive and administrative ownership",()=>{
    const save=fixture();save.factions.push({...save.factions[0],factionId:"wei",displayName:"魏"});
    setFixtureLifetimeRecords(save);
    Object.assign(save.factions[0],{status:"EXTINCT",terminationReason:"SUBMITTED",terminationTargetFactionId:"wei",terminationMonth:36,extinctionMonth:36,cumulativeActiveMonths:36});
    delete save.factions[0].capitalCityId;
    save.cities[0].ownerFactionId="wei";save.blocks.forEach(b=>b.ownerFactionId="wei");
    save.dynasties=[{factionId:"qin",houseName:"陈氏",currentRulerId:null,heirIds:[],houseEpochs:[{houseName:"陈氏",startMonth:0,startReason:"FOUNDING",foundingRulerId:"last"}],rulers:[
      {rulerId:"last",houseName:"陈氏",givenName:"平",bornMonth:0,accessionMonth:0,endMonth:36,politicalEndMonth:36,status:"abdicated",endReason:"纳土退位"},
      {rulerId:"heir",houseName:"陈氏",givenName:"继",bornMonth:20,parentId:"last",status:"kin"},
    ]}];
    setFixtureLifetimeRecords(save);
    const rng=save.worldRandom,core=target();
    expect(validateWorldSave(save)).toEqual({valid:true,errors:[]});hydrateWorldSave(core,save);
    const first=exportWorldSave(core);expect(first.saveSchemaVersion).toBe(13);
    expect(first.factions[0]).toMatchObject({terminationReason:"SUBMITTED",terminationTargetFactionId:"wei",terminationMonth:36});
    expect(first.cities[0].ownerFactionId).toBe("wei");expect(first.blocks.every(b=>b.ownerFactionId === "wei")).toBe(true);
    expect((first.dynasties[0].rulers as any[])[0]).toMatchObject({status:"abdicated",endReason:"纳土退位",politicalEndMonth:36});
    expect((first.dynasties[0].rulers as any[])[1]).toMatchObject({status:"kin",parentId:"last"});
    hydrateWorldSave(core,first);expect(exportWorldSave(core)).toEqual(first);expect(worldRandom.exportState()).toEqual(rng);
    expect(validateWorldSave({...first,saveSchemaVersion:10}).valid).toBe(false);
    const oldTarget=target();expect(()=>hydrateWorldSave(oldTarget,{...first,saveSchemaVersion:10} as any)).toThrow(/unsupported saveSchemaVersion/);expect(oldTarget.prepareForHydration).not.toHaveBeenCalled();

    const changed=structuredClone(first);changed.factions[0].terminationTargetFactionId="missing";
    expect(validateWorldSave(changed).valid).toBe(false);
    changed.factions[0].terminationTargetFactionId="wei";changed.diplomacy.relations=[{factionAId:"qin",factionBId:"wei",status:"ALLIANCE",reason:"COMMON_THREAT_ALLIANCE",originalStartedMonth:0,startedMonth:0,expiresMonth:120,renewalCount:0}];
    expect(validateWorldSave(changed).valid).toBe(false);
  });
  it("V10 actual hydrate/export round-trip retains diplomacy renewal and cooldown state without RNG draws",()=>{
    const save=fixture();save.factions.push({...save.factions[0],factionId:"wei"});
    setFixtureLifetimeRecords(save);
    delete save.factions[1].capitalCityId;
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
