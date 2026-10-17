import AutoSimulator from "../Simulation/AutoSimulator";
import { buildUnifiedFactionChronicle } from "../Historiography/UnifiedFactionChronicle";
import { deriveHouseAssessments } from "../Historiography/DynastyHouseHistoriography";
import { setFixtureLifetimeRecords } from "./testing/FactionLifetimeFixture";
import { afterEach, describe, expect, it, vi } from "vitest";
const { game } = vi.hoisted(() => ({ game: { Core: undefined as any, BlockSize: 32 } }));
vi.mock("../Game/Game", () => ({ default: game }));
vi.mock("../Components/Block", () => ({ default: class {} }));
// Render-only player adapter. User life, political registries and persistence stay real.
vi.mock("../Components/Player", () => ({ default: class {
  logicalUnitId?: string; user: any; role="NORMAL"; rulerId?: string; active=true; children:any[]=[]; movement:any={};
  constructor(_scene:unknown, public x:number,public y:number,public team:any) {}
  setTeam(team:any){this.team=team;}
  setFace(){}
  applyHydratedMovementState(state:any){this.movement={...state};Object.assign(this,state);}
  exportMovementState(unitId:string){return {...this.movement,unitId,factionId:this.team.name,userId:this.user?.id};}
} }));
vi.mock("../Components/Slaves", () => ({ default: class { npcs=new Map(); children={size:0}; } }));
vi.mock("../Components/User", async () => await vi.importActual("../Components/User"));
vi.mock("../Components/Npc", () => ({ default: class {} }));
vi.mock("../Components/Farms", () => ({ default: class {} }));
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
import { createEmptyWorldSaveV14, type RulerSaveV14 } from "./WorldSaveSchema";
import { validateWorldSave } from "./WorldSaveValidator";
import { normalizeArchivedCityBlockRefs } from "./ArchivedCityHydrationRepair";
import { createStoredWorldSaveRecord, validateStoredWorldSaveRecord } from "./WorldSaveRepository";
import DynastyRegistry from "../Politics/Dynasty";
import { exportRulerSave, importRulerSave } from "./RulerSaveProjection";
import { deriveRulerAssessment, composeHistorianVoice } from "../Politics/RulerHistoriography";
import { buildRulerTags } from "../Politics/RulerChronicle";
import WorldHistory, { type WorldEvent } from "../History/WorldHistory";
import worldRandom from "../Simulation/WorldRandom";
import Diplomacy from "../Politics/Diplomacy";
import { createDiplomacyEventMetadata } from "../Politics/DiplomacyPresentation";
import { WORLD_MONTH_MS } from "../config/simulation";
import WorldEra from "../Simulation/WorldEra";
import WorldExiles from "../Simulation/WorldExiles";
import FactionSnapshots from "../Simulation/FactionSnapshots";
import { createBlockSaveProjection } from "./BlockSaveProjection";

function fixture() {
  const save = createEmptyWorldSaveV14();
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
function target(width = 3) {
  let sim: any = { started: true, running: false, selectedSpeed: 4, clock: { worldMonth: 500, elapsedMs: 0, running: false }, populationSystem: { counters: {}, lastGrowthMonth: 0 }, worldEventSystem: fixture().worldEventSystem };
  const core: any = { teams: ["old teams"], units: ["old units"], oldCities: ["old cities"], scene: { renderer: { width: width * 32, height: 32 },
    physics: { world: { pause() {} } }, time: {}, tweens: { pauseAll() {} } },
    backgroundProgression: { isCatchingUp: () => false }, simulationDriver: { exportState: () => ({ accumulatorMs: 0 }), importState() {} },
    logicalUnitRegistry: { importState() {}, getAliveUnits: () => [], exportState: () => ({ nextUnitSequence: 1 }) },
    simulator: { exportState: () => sim, importState: (state: any) => { sim = { ...state, running: false }; }, rebaseProfilerLatches() {}, setRunning() {}, getCurrentPhase: () => "fragmented" },
    setHydrationStage(stage: string) { this.stage = stage; }, setHydrationRepairs(repairs: any) { this.repairs = repairs; },
    setHydratedFactionShells(teams: any) { this.teams = teams; }, resetDeterminismDiagnostics() {}, installHydratedTeams() {}, setSimulationSpeed() {}, notifyDesktopHeartbeat() {},
  };
  core.prepareForHydration = vi.fn(() => {
    core.units = []; core.oldCities = [];
    core.map = { blocks: Array.from({ length: width }, (_, x) => [{ x: x * 32, y: 0,
      restoreCanonicalState(state: any) { Object.assign(this, { team: state.owner, city: state.city, hp: state.hp, isHome: state.isHome, isCityCenter: state.isCityCenter }); },
    }]), getMaxX: () => width, getMaxY: () => 1 };
  });
  Object.defineProperty(core, "allCities", { get: () => core.teams.flatMap((team: any) => team.cities ?? []) });
  game.Core = core; return core;
}
afterEach(() => { vi.restoreAllMocks(); });
describe("V9 active city referential integrity and pre-teardown repair", () => {
  it("真实年度执行长期互不侵犯归并，再导出、校验、恢复V14，历史与退位事实保持一致", async () => {
    const {default:RealTeam}=await vi.importActual<typeof import("../Components/Team")>("../Components/Team");
    const core=target(100),base=fixture().factions[0],starts=[0,30,33],counts=[30,3,67];
    core.prepareForHydration();Object.defineProperty(core,"totalCells",{value:100});
    const fs=["strong","weak","other"].map((id,i)=>({...base,factionId:id,displayName:id,houseName:`姓${i}氏`,
      origin:i===1?{type:"SPLIT",parentFactionId:"strong",foundedMonth:0}:{type:"INITIAL",foundedMonth:0},
      homeGridX:starts[i],capitalCityId:`city-${id}`,stateFoundedMonth:0}));
    const ts:any[]=fs.map(f=>({...f,name:f.factionId,firstFoundedYear:0,currentActiveSinceYear:0,cumulativeActiveYears:0,restorationYears:[],
      cities:[] as any[],extinctionYear:undefined as number|undefined,users:new Set(),blocks:{children:{entries:[] as any[],size:0}},farms:{npcs:new Map(),init(){},setDie(){}},removeRulerUnit(){},
      markMerged:RealTeam.prototype.markMerged,
      exportState(){return {...f,status:this.status,capitalCityId:this.cities.find((c:any)=>c.isCapital)?.id,
        terminationReason:this.terminationReason,terminationTargetFactionId:this.terminationTargetFactionId,terminationMonth:this.terminationMonth,
        cumulativeActiveMonths:this.cumulativeActiveYears,extinctionMonth:this.extinctionYear};}}));
    core.teams=ts;
    ts.forEach((t,i)=>{
      const blocks=core.map.blocks.slice(starts[i],starts[i]+counts[i]).map((row:any)=>row[0]);
      t.blocks.children.entries=blocks;t.blocks.children.size=blocks.length;
      blocks.forEach((b:any)=>{b.hp=0;b.isHome=false;b.isCityCenter=false;b.team=t;b.claimForTeam=(target:any)=>{
        const old=b.team;old.blocks.children.entries=old.blocks.children.entries.filter((v:any)=>v!==b);
        old.blocks.children.size=old.blocks.children.entries.length;target.blocks.children.entries.push(b);
        target.blocks.children.size=target.blocks.children.entries.length;b.team=target;};});
      const cs={...fixture().cities[0],cityId:`city-${t.name}`,name:`城${i}`,ownerFactionId:t.name,founderFactionId:t.name,
        centerGridX:starts[i],loyalty:40,fortifiedCells:[{gridX:starts[i],gridY:0}]};
      const c:any={...cs,id:cs.cityId,block:blocks[0],fortifiedCells:[blocks[0]],updateDefense(){},
        administrativeMergeTransferTo(target:any){t.cities=t.cities.filter((v:any)=>v!==c);target.cities.push(c);c.ownerFactionId=target.name;c.isCapital=false;c.block.isHome=false;},
        exportState:()=>({...cs,ownerFactionId:c.ownerFactionId,isCapital:c.isCapital})};
      blocks[0].restoreCanonicalState({owner:t,city:c,hp:7,isHome:true,isCityCenter:true});t.cities=[c];
    });
    vi.spyOn(DynastyRegistry,"ensureRulerUnit").mockImplementation(()=>undefined);
    worldRandom.initialize("v13-long-peace-execution");
    const sim=core.simulator=new AutoSimulator(true);sim.startWorld(ts,100,{});
    Diplomacy.setRelation({factionAId:"strong",factionBId:"weak",status:"NON_AGGRESSION",reason:"COMMON_THREAT_NON_AGGRESSION",
      startedMonth:0,originalStartedMonth:0,renewalCount:0,expiresMonth:240});
    WorldHistory.addEvent({id:"nap-sign",year:0,type:"non-aggression-signed",category:"politics",title:"互不侵犯条约",
      factionIds:["strong","weak"],importance:"major",metadata:createDiplomacyEventMetadata(Diplomacy.get("strong","weak")!)});
    const runtime=sim as any;runtime.clock.importState({worldMonth:119,elapsedMs:0,running:true});
    vi.spyOn(runtime.events,"update").mockImplementation(()=>undefined);
    vi.spyOn(runtime.events,"observeWorldGoal").mockImplementation(()=>undefined);
    vi.spyOn(runtime.events,"getCurrentPhase").mockReturnValue("FRAGMENTED");
    vi.spyOn(runtime.population,"update").mockImplementation(()=>undefined);
    vi.spyOn(runtime.populationTransitionAudit,"reconcile").mockImplementation(()=>undefined);
    vi.spyOn(DynastyRegistry,"update").mockImplementation(()=>undefined);
    vi.spyOn(WorldEra,"observe").mockImplementation(()=>undefined);
    vi.spyOn(WorldExiles,"update").mockImplementation(()=>undefined);
    vi.spyOn(FactionSnapshots,"observe").mockImplementation(()=>undefined);
    vi.spyOn(WorldHistory,"observeWorld").mockImplementation(()=>undefined);
    const rng=worldRandom.exportState();sim.update(WORLD_MONTH_MS,ts,100);sim.setRunning(false);
    expect(ts[1].terminationReason).toBe("MERGED");
    expect(DynastyRegistry.get("weak")?.rulers.find(r=>r.accessionYear!==undefined)?.status).toBe("abdicated");
    expect(worldRandom.exportState()).toEqual(rng);
    const save=exportWorldSave(core);expect(validateWorldSave(save)).toEqual({valid:true,errors:[]});
    const event=(save.worldHistory.events as WorldEvent[]).find(e=>e.type === "faction-merged")!;
    expect(event.metadata).toMatchObject({unionPath:"LONG_NON_AGGRESSION",diplomaticStatus:"NON_AGGRESSION",nonAggressionMonths:120,
      peaceSigningEventId:"nap-sign",absorbedFactionId:"weak",absorbingFactionId:"strong"});
    hydrateWorldSave(core,JSON.parse(JSON.stringify(save)));const first=exportWorldSave(core);
    expect(first).toEqual(save);expect(worldRandom.exportState()).toEqual(rng);
    hydrateWorldSave(core,JSON.parse(JSON.stringify(first)));expect(exportWorldSave(core)).toEqual(first);
    expect(WorldHistory.getEvents().filter(e=>e.type === "faction-merged")).toHaveLength(1);
  });
  it.each(["低忠诚旧路径", "战乱旧都", "双零流亡终结"])("%s真实月度执行后V14往返一致，不回填旧历史", async scenario => {
    const { default: RealTeam } = await vi.importActual<typeof import("../Components/Team")>("../Components/Team");
    const { default: RealCity } = await vi.importActual<typeof import("../Components/City")>("../Components/City");
    const { default: WorldRemnants } = await import("../Simulation/WorldRemnants");
    const { default: Danmu } = await import("../Live/Danmu");
    const core = target(3), base = fixture().factions[0]; core.prepareForHydration();
    vi.stubGlobal("Phaser", { Math: { Clamp: (v: number, min: number, max: number) => Math.max(min, Math.min(max, v)) } });
    const fs = ["qin", "old"].map((name, i) => ({ ...base, factionId: name, displayName: name, houseName: `姓${i}氏`, stateFoundedMonth: 0,
      origin: { type: "INITIAL", foundedMonth: 0 }, capitalCityId: undefined, homeGridX: 0 }));
    const ts: any[] = fs.map(f => Object.assign(Object.create(RealTeam.prototype), f, {
      name: f.factionId, firstFoundedYear: 0, currentActiveSinceYear: 0, cumulativeActiveYears: 0, restorationYears: [], cities: [], users: new Set(),
      blocks: { children: { entries: [], size: 0 } }, farms: { npcs: new Map(), init() {} }, removeRulerUnit() {},
      addCity(this: any, c: any) { if (!this.cities.includes(c)) this.cities.push(c); }, removeCity(this: any, c: any) { this.cities = this.cities.filter((v: any) => v !== c); },
      exportState(this: any): any { return { ...f, status: this.status, capitalCityId: this.capitalCity?.id, lastExiledMonth: this.lastExiledYear,
        currentActiveSinceMonth: this.currentActiveSinceYear, cumulativeActiveMonths: this.cumulativeActiveYears, restorationMonths: [...this.restorationYears] }; },
    }));
    core.teams = ts; Object.defineProperty(core, "totalCells", { value: 3 });
    const cells = core.map.blocks.map((row: any) => row[0]); ts[0].blocks.children.entries = cells; ts[0].blocks.children.size = cells.length;
    cells.forEach((b: any) => {
      b.team = ts[0]; b.width = 32; b.height = 32; b.updateCityDisplay = () => undefined;
      b.claimForTeam = (team: any) => { const prior = b.team; prior.blocks.children.entries = prior.blocks.children.entries.filter((v: any) => v !== b);
        prior.blocks.children.size = prior.blocks.children.entries.length; team.blocks.children.entries.push(b); team.blocks.children.size = team.blocks.children.entries.length; b.team = team; };
    });
    const history = [{ year: 0, type: "founded", title: "建城", newOwnerFactionId: "qin" },
      { year: 10, type: "captured", title: "攻陷", previousOwnerFactionId: "qin", newOwnerFactionId: "old" },
      { year: 20, type: "capital-relocated", title: "迁都", newOwnerFactionId: "old", wasCapital: true },
      { year: 400, type: "captured", title: "失守", previousOwnerFactionId: "old", newOwnerFactionId: "qin" }];
    const cities = [0, 1].map(i => Object.assign(Object.create(RealCity.prototype), {
      id: i ? "active" : "old-city", name: i ? "现城" : "旧城", founderFactionId: "qin", ownerFactionId: "qin", foundedYear: 0,
      block: cells[i], fortifiedCells: [cells[i]], isCapital: Boolean(i), loyalty: i ? 80 : 0, history: i ? [history[0]] : history,
      captureCount: i ? 0 : 2, devastation: 0, defense: 7, maxDefense: 10, lastCapturedYear: i ? undefined : 400,
      siegeContacts: new Map(), underSiege: false, destroyed: false, isHistoricCity: false, isIndestructible: false,
      calculateMaxDefense: () => 10, rebuildFortifiedZone() {}, clearSiegeState() {}, refreshZoneVisual() {}, isInCaptureGrace: () => false,
    }));
    ts[0].cities = cities; cities.forEach((c, i) => cells[i].restoreCanonicalState({ owner: ts[0], city: c, hp: 7, isHome: true, isCityCenter: true }));
    cells[2].restoreCanonicalState({ owner: ts[0], city: undefined, hp: 0, isHome: false, isCityCenter: false });
    vi.spyOn(DynastyRegistry, "ensureRulerUnit").mockImplementation(() => undefined);
    vi.spyOn(Danmu, "Apply").mockReturnValue(ts[1]); // population rendering adapter; registry spawning loop remains real
    worldRandom.initialize("old-capital-v13");
    const sim = core.simulator = new AutoSimulator(false); sim.startWorld(ts, 3, {});
    ts[1].markExiled(400); DynastyRegistry.markExiled(ts[1], 400);
    WorldRemnants.add("old", 1, 400); WorldExiles.start(ts[1], 400, 1); WorldExiles.get("old")!.legitimacy = 80;
    const rulerId = DynastyRegistry.getCurrentRuler("old")!.id;
    const runtime = sim as any;
    const cityModule = await import("../Components/City");
    vi.spyOn(cityModule, "getFactionStability").mockImplementation(team => team.cities.length ? Math.round(team.cities.reduce((sum, city) => sum + city.loyalty, 0) / team.cities.length) : undefined);
    if (scenario === "战乱旧都") { cities[0].loyalty = 33; cities[0].devastation = 94; cities[1].loyalty = 30; }
    if (scenario === "双零流亡终结") { WorldRemnants.consume("old", 1); WorldExiles.get("old")!.legitimacy = 0; }
    // Hydration must preserve the restored V14 state until the next authoritative month.
    sim.setRunning(false);
    runtime.clock.importState({ worldMonth: 479, elapsedMs: 0, running: false });
    if (scenario === "双零流亡终结") {
      const before = exportWorldSave(core); expect(validateWorldSave(before)).toEqual({ valid: true, errors: [] });
      hydrateWorldSave(core, JSON.parse(JSON.stringify(before))); expect(exportWorldSave(core)).toEqual(before);
      expect(core.teams[1].status).toBe("EXILED");
      // The hydration adapter uses runtime shells; attach real political lifecycle methods.
      core.teams.forEach((t: any) => { t.blocks = { children: { entries: [], size: 0 } }; });
      core.teams[1].markExtinct = RealTeam.prototype.markExtinct;
      core.teams[1].removeRulerUnit = () => undefined;
      Object.assign(core.teams[1], { firstFoundedYear: 0, lastExiledYear: 400, cumulativeActiveYears: 400,
        restorationYears: [], currentActiveSinceYear: 0 });
      const baseState = core.teams[1].exportState();
      core.teams[1].exportState = () => ({ ...baseState, status: core.teams[1].status, extinctionMonth: core.teams[1].extinctionYear,
        terminationReason: core.teams[1].terminationReason });
    }
    const monthlySim = core.simulator as AutoSimulator, monthlyRuntime = monthlySim as any;
    const liveTeams = core.teams;
    monthlyRuntime.clock.importState({ worldMonth: 479, elapsedMs: 0, running: true });
    for (const phase of ["observeWorldGoal", "checkStateFormation", "applyProvisionalDissolutionPressure", "checkEmperorProclamation", "checkEmpireSplit", "checkCityFounding", "triggerRandomEvent"])
      vi.spyOn(monthlyRuntime.events, phase).mockImplementation(() => undefined);
    vi.spyOn(monthlyRuntime.events, "getCurrentPhase").mockReturnValue("FRAGMENTED");
    vi.spyOn(monthlyRuntime.population, "update").mockImplementation(() => undefined);
    vi.spyOn(monthlyRuntime.populationTransitionAudit, "reconcile").mockImplementation(() => undefined);
    vi.spyOn(monthlyRuntime.diplomacy, "update").mockImplementation(() => undefined);
    vi.spyOn(DynastyRegistry, "update").mockImplementation(() => undefined);
    vi.spyOn(WorldEra, "observe").mockImplementation(() => undefined);
    vi.spyOn(FactionSnapshots, "observe").mockImplementation(() => undefined);
    vi.spyOn(WorldHistory, "observeWorld").mockImplementation(() => undefined);
    liveTeams.forEach((t: any) => t.cities.forEach((c: any) => { c.updateDefense = () => undefined; }));
    const draw = vi.spyOn(worldRandom, "next").mockReturnValue(.0001);
    monthlySim.setRunning(true);
    monthlySim.update(WORLD_MONTH_MS, liveTeams, 3); draw.mockRestore(); monthlySim.setRunning(false);
    if (scenario === "双零流亡终结") {
      expect(liveTeams[1].status).toBe("EXTINCT");
      const last = DynastyRegistry.get("old")!.rulers.find(r => r.id === rulerId)!;
      expect(last.status).toBe("politically-ended"); expect(last.deathMonth).toBeUndefined();
      expect(DynastyRegistry.hasClaimant("old")).toBe(false);
      expect(WorldHistory.getEvents().filter(e => e.type === "faction-extinct" && e.targetFactionId === "old")).toHaveLength(1);
    } else {
      expect(liveTeams[1].status).toBe("ACTIVE"); expect(cities[0].ownerFactionId).toBe("old"); expect(cells[0].team).toBe(liveTeams[1]);
      expect(WorldRemnants.get("old")).toBeUndefined(); expect(liveTeams[1].restorationYears).toEqual([480]);
    }
    const save = exportWorldSave(core); expect(validateWorldSave(save)).toEqual({ valid: true, errors: [] });
    const restoration = (save.worldHistory.events as WorldEvent[]).find((e: any) => e.type === "faction-restored");
    if (scenario !== "双零流亡终结") expect(restoration?.metadata).toMatchObject({ restorationBasis: "FORMER_CAPITAL", historicalHeldMonths: 390, rulerId });
    if (scenario === "战乱旧都") expect(restoration?.metadata?.restorationTrigger).toBe("WAR_TORN_HISTORICAL_CITY");
    const rng = worldRandom.exportState(); hydrateWorldSave(core, JSON.parse(JSON.stringify(save)));
    expect(exportWorldSave(core)).toEqual(save); expect(worldRandom.exportState()).toEqual(rng);
    hydrateWorldSave(core, JSON.parse(JSON.stringify(save))); expect(exportWorldSave(core)).toEqual(save);
    expect(WorldHistory.getEvents().filter(e => e.type === "faction-restored")).toHaveLength(scenario === "双零流亡终结" ? 0 : 1);
    vi.unstubAllGlobals();
  });
  it("成年继位独立政治危机→真实夺统→历史→V14严格往返", async () => {
    const core = target(3), base = fixture().factions[0]; core.prepareForHydration();
    const fs = ["qin", "enemy"].map((id, i) => ({ ...base, factionId: id, displayName: id, houseName: i ? "魏氏" : "田氏",
      colorHistory: [{ color: 1, startMonth: 0, reason: "FOUNDING" as const }], nameHistory: [{ name: id, startMonth: 0, reason: "FOUNDING" }],
      sovereigntyRank: "KING", stateFoundedMonth: 0, origin: { type: "INITIAL", foundedMonth: 0 }, homeGridX: i, capitalCityId: i ? "b" : "active" }));
    const ts: any[] = fs.map(f => ({ ...f, name: f.factionId, firstFoundedYear: 0, currentActiveSinceYear: 0, cumulativeActiveYears: 0,
      restorationYears: [], cities: [], users: new Set(), blocks: { children: { entries: [], size: 0 } }, farms: { npcs: new Map(), init() {} }, removeRulerUnit() {},
      setRegimeColor(this: any, color: number, month: number) { this.colorHistory.at(-1).endMonth = month - 1; this.colorHistory.push({ color, startMonth: month, reason: "DYNASTIC_REVOLUTION" }); this.color = color; },
      exportState() { return { ...f, displayName: this.displayName, houseName: this.houseName, color: this.color, colorHistory: this.colorHistory, nameHistory: this.nameHistory }; },
    }));
    core.teams = ts; Object.defineProperty(core, "totalCells", { value: 3 });
    const cs = ["active", "a", "b"].map((id, i) => ({ ...fixture().cities[0], cityId: id, name: i ? `城${i}` : "故都", centerGridX: i,
      ownerFactionId: i ? "enemy" : "qin", founderFactionId: "qin", isCapital: i === 0 || i === 2, loyalty: 20,
      fortifiedCells: [{ gridX: i, gridY: 0 }] }));
    const cities = cs.map((c, i) => ({ ...c, id: c.cityId, block: core.map.blocks[i][0], fortifiedCells: [core.map.blocks[i][0]], exportState: () => structuredClone(c) }));
    cities.forEach((c, i) => { const t = ts[i ? 1 : 0]; t.cities.push(c); t.blocks.children.entries.push(c.block); t.blocks.children.size++;
      c.block.restoreCanonicalState({ owner: t, city: c, hp: 7, isHome: true, isCityCenter: true }); });
    const cityModule = await import("../Components/City");
    vi.spyOn(cityModule, "getFactionStability").mockReturnValue(20);
    vi.spyOn(DynastyRegistry, "ensureRulerUnit").mockImplementation(() => undefined);
    worldRandom.initialize("political-shock-round-trip");
    core.simulator = new AutoSimulator(false); core.simulator.startWorld(ts, 3, {}); core.simulator.setRunning(false);
    const d = DynastyRegistry.get("qin")!, previous = DynastyRegistry.getCurrentRuler("qin")!;
    Object.assign(previous, { bornYear: -480, naturalDeathYear: 120, plannedEndYear: 120 });
    const heir = d.rulers.find(r => d.heirIds.includes(r.id))!;
    expect(heir).toBeDefined(); Object.assign(heir, { bornYear: -240, naturalDeathYear: 1000, plannedEndYear: 1000 });
    WorldHistory.addCapitalFallen(60, "enemy", "qin", "qin", "故都", "active", true, 7, undefined, undefined, "capital-battle");
    WorldHistory.addEmpireSplit(80, "qin", "enemy", ["城1", "城2"], ["a", "b"], undefined, undefined, "split-event");
    const sources = WorldHistory.exportState().events.map(e => JSON.stringify(e));
    const draw = vi.spyOn(worldRandom, "next").mockReturnValueOnce(0);
    DynastyRegistry.update(120, ts); draw.mockRestore();
    const ruler = DynastyRegistry.getCurrentRuler("qin")!;
    expect(ruler.relationType).toBe("USURPER"); expect(ruler.parentId).toBeUndefined(); expect(heir.status).toBe("kin"); expect(heir.deathMonth).toBeUndefined();
    expect(d.houseEpochs).toHaveLength(2); expect(d.houseEpochs!.at(-1)!.startReason).toBe("USURPATION");
    const event = WorldHistory.getEvents().find(e => e.type === "dynasty-usurped")!;
    expect(event.metadata?.riskTier).toBe("POLITICAL_SHOCK"); expect(ruler.chronicle?.notableEventIds).toContain(event.id);
    expect(WorldHistory.exportState().events.slice(0, sources.length).map(e => JSON.stringify(e))).toEqual(sources);
    (core.simulator as any).clock.importState({ worldMonth: 120, elapsedMs: 0, running: false });
    const save = exportWorldSave(core); expect(save.saveSchemaVersion).toBe(15);
    expect(validateWorldSave(save)).toEqual({ valid: true, errors: [] });
    const rng = worldRandom.exportState(); hydrateWorldSave(core, JSON.parse(JSON.stringify(save)));
    expect(exportWorldSave(core)).toEqual(save); expect(worldRandom.exportState()).toEqual(rng);
    hydrateWorldSave(core, JSON.parse(JSON.stringify(save))); expect(exportWorldSave(core)).toEqual(save);
  });
  it("starts the actual seven INITIAL world, exports V14, validates, hydrates twice without household regeneration", () => {
    const core = target(7), base = fixture().factions[0];
    const fs = Array.from({ length: 7 }, (_, i) => ({ ...base, factionId: `house-${i}`, displayName: `国${i}`, houseName: `姓${i}氏`,
      origin: { type: "INITIAL", foundedMonth: 0 }, homeGridX: i, capitalCityId: `city-${i}`, stateFoundedMonth: 0 }));
    const cs = fs.map((f, i) => ({ ...fixture().cities[0], cityId: `city-${i}`, name: `城${i}`, founderFactionId: f.factionId,
      ownerFactionId: f.factionId, centerGridX: i, fortifiedCells: [{ gridX: i, gridY: 0 }] }));
    const ts: any[] = fs.map(f => ({ ...f, name: f.factionId, firstFoundedYear: 0, users: new Set(), cities: [],
      blocks: { children: { size: 1 } }, farms: { npcs: new Map(), init() {} }, removeRulerUnit() {}, exportState: () => structuredClone(f) }));
    core.prepareForHydration(); core.teams = ts;
    const cities = cs.map((c, i) => ({ ...c, id: c.cityId, block: core.map.blocks[i][0], fortifiedCells: [core.map.blocks[i][0]],
      exportState: () => structuredClone(c) }));
    ts.forEach((t, i) => { t.cities = [cities[i]]; core.map.blocks[i][0].restoreCanonicalState({ owner: t, city: cities[i], hp: 7, isHome: true, isCityCenter: true }); });
    Object.defineProperty(core, "totalCells", { value: 7 });
    vi.spyOn(DynastyRegistry, "ensureRulerUnit").mockImplementation(() => undefined);
    worldRandom.initialize("household-new-world-v13");
    core.simulator = new AutoSimulator(true); core.simulator.startWorld(ts, 7, {}); core.simulator.setRunning(false);
    // Runtime objects are Phaser adapters; politics, simulator startup, exporter, validator and hydrator are real.
    const before = exportWorldSave(core, { createdAt: "2026-10-11T00:00:00Z" });
    expect(before.saveSchemaVersion).toBe(15); expect(before.dynasties).toHaveLength(7);
    expect(before.dynasties.some(d => (d.rulers as RulerSaveV14[]).length > 2)).toBe(true);
    expect(validateWorldSave(before)).toEqual({ valid: true, errors: [] });
    const rng = worldRandom.exportState(); const init = vi.spyOn(DynastyRegistry, "initializeFaction");
    (core.simulator as any).unionObservations.evaluation(0,[]);
    expect(core.simulator.getPeacefulPoliticalTransitionDiagnostics().strategicUnion.sessionCumulative.evaluationTicks).toBe(1);
    hydrateWorldSave(core, JSON.parse(JSON.stringify(before)));
    const after = exportWorldSave(core, { createdAt: before.createdAt });
    expect(after).toEqual(before); expect(worldRandom.exportState()).toEqual(rng); expect(init).not.toHaveBeenCalled();
    expect(core.simulator.getPeacefulPoliticalTransitionDiagnostics()).toMatchObject({worldMonth:0,
      peacefulSubmission:{sessionStartMonth:0,sessionCumulative:{observedWorldMonths:0,evaluationTicks:0}},
      strategicUnion:{sessionStartMonth:0,sessionCumulative:{observedWorldMonths:0,evaluationTicks:0}}});
    hydrateWorldSave(core, JSON.parse(JSON.stringify(after)));
    expect(exportWorldSave(core, { createdAt: before.createdAt })).toEqual(before); expect(init).not.toHaveBeenCalled();
    expect(new Set(before.dynasties.flatMap(d => (d.rulers as RulerSaveV14[]).map(r => r.rulerId))).size)
      .toBe(before.dynasties.reduce((n, d) => n + (d.rulers as RulerSaveV14[]).length, 0));
    // Repeat real startup with observations disabled; canonical V14 must be identical.
    worldRandom.initialize("household-new-world-v13");
    ts.forEach((t,i)=>{
      const block=core.map.blocks[i][0];cities[i].block=block;cities[i].fortifiedCells=[block];t.cities=[cities[i]];
      block.restoreCanonicalState({owner:t,city:cities[i],hp:7,isHome:true,isCityCenter:true});
    });
    core.teams=ts;core.simulator=new AutoSimulator(false);core.simulator.startWorld(ts,7,{});core.simulator.setRunning(false);
    expect(exportWorldSave(core,{createdAt:before.createdAt})).toEqual(before);
    expect(worldRandom.exportState()).toEqual(rng);
    const dynastyBeforeContinuation = DynastyRegistry.exportState();
    // Restore the Phaser group adapter used by monthly ruler observation.
    core.teams.forEach((team: any) => { team.blocks = { children: { size: 1 } }; });
    DynastyRegistry.update(1, core.teams);
    expect(DynastyRegistry.exportState().dynasties.map(d => d.rulers.map(r => r.id)))
      .toEqual(dynastyBeforeContinuation.dynasties.map(d => d.rulers.map(r => r.id)));
  });
  it("真实七国新世界启动与四种子120年王室流程新旧对照", async () => {
    const political = await import("../Politics/PoliticalSuccessionCrisis");
    const colors = await import("../Simulation/FactionColorHistory");
    const run = (seed: string, enabled: boolean) => {
      const core = target(7), base = fixture().factions[0]; core.prepareForHydration();
      vi.stubGlobal("window", { location: { search: "?debug=1" } });
      const ts: any[] = Array.from({ length: 7 }, (_, i) => ({ ...base, factionId: `trial-${i}`, name: `trial-${i}`,
        displayName: `国${i}`, houseName: `姓${i}氏`, stateFoundedMonth: 0, origin: { type: "INITIAL", foundedMonth: 0 },
        nameHistory: [{ name: `国${i}`, startMonth: 0 }], color: i + 1, colorHistory: [{ color: i + 1, startMonth: 0, reason: "FOUNDING" }],
        firstFoundedYear: 0, currentActiveSinceYear: 0, cumulativeActiveYears: 0, restorationYears: [], users: new Set(),
        cities: [{ name: `城${i}`, loyalty: 40 }], blocks: { children: { size: 1 } }, farms: { npcs: new Map(), init() {} }, removeRulerUnit() {},
        setRegimeColor(color: number, month: number) { colors.changeFactionColor(this, color, month); },
      }));
      core.teams = ts; Object.defineProperty(core, "totalCells", { value: 7 });
      vi.spyOn(DynastyRegistry, "ensureRulerUnit").mockImplementation(() => undefined);
      if (!enabled) vi.spyOn(political, "derivePoliticalSuccessionShocks").mockReturnValue([]);
      worldRandom.initialize(seed);
      core.simulator = new AutoSimulator(true); core.simulator.startWorld(ts, 7, {}); core.simulator.setRunning(false);
      for (let month = 1; month <= 1440; month++) DynastyRegistry.update(month, ts);
      const snapshot = DynastyRegistry.getRevolutionDiagnostics(ts, 1440).cumulativeGate;
      const value = { snapshot, dynasty: DynastyRegistry.exportState(), history: WorldHistory.exportState(), rng: worldRandom.exportState() };
      vi.restoreAllMocks(); vi.unstubAllGlobals(); return JSON.parse(JSON.stringify(value));
    };
    const results = [];
    for (const seed of ["political-k-1", "political-k-2", "political-k-3", "political-k-4"]) {
      const old = run(seed, false), current = run(seed, true);
      expect(run(seed, true)).toEqual(current);
      // With no war/split subsystem, the new historical gate must stay closed and consume no extra RNG.
      expect(current).toEqual(old);
      results.push({ seed, 观察年数: 120, 继位次数: current.snapshot.successionBoundaryCheckCount,
        最高危机: current.snapshot.crisisEligibleCount, 原复合危机: current.snapshot.lowerRiskEligibleCount,
        新危机: current.snapshot.politicalShockEligibleCount, 抽签: current.snapshot.rollAttemptCount,
        篡朝: current.snapshot.usurpationCount, 期望: current.snapshot.expectedUsurpationCount,
        每千年条件期望: current.snapshot.expectedUsurpationsPer1000Years });
    }
    console.log("真实七国启动、120年王室流程对照（未运行战争、人口、城市、外交与分裂，不是自然世界发生率）", results);
  });
  it("new seven-faction rulers use the actual initialization path and export/validate/hydrate as V14", () => {
    const save = fixture(), core = target();
    const names = ["qin", "chu", "yan", "qi", "han", "zhao", "wei"];
    const base = save.factions[0]; save.factions = names.map(factionId => ({ ...base, factionId, ...(factionId === "qin" ? {} : { capitalCityId: undefined }) }));
    setFixtureLifetimeRecords(save);
    DynastyRegistry.reset(); WorldHistory.reset(); worldRandom.initialize("seven-new-v14");
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
    const houseBefore = state.dynasties.map(dynasty => deriveHouseAssessments({ dynasty,
      faction: { name: dynasty.factionId, displayName: dynasty.factionId, color: 1, status: "ACTIVE", stateFoundedMonth: 0 },
      factions: new Map(), events: [], worldMonth: save.world.worldMonth }));
    const articles = (snapshot: ReturnType<typeof createEmptyWorldSaveV14>, dynasties: typeof state.dynasties) => {
      const factions = new Map(snapshot.factions.map(f => [f.factionId, { ...f, name: f.factionId,
        firstFoundedYear: f.firstFoundedMonth, cumulativeActiveYears: f.cumulativeActiveMonths,
        restorationYears: f.restorationMonths, origin: undefined,
        sovereigntyHistory: f.sovereigntyHistory.flatMap(h => typeof h.rank === "string" && typeof h.startMonth === "number" ?
          [{ rank: h.rank, startMonth: h.startMonth, endMonth: typeof h.endMonth === "number" ? h.endMonth : undefined }] : []),
        nameHistory: f.nameHistory.flatMap(h => typeof h.name === "string" && typeof h.startMonth === "number" ?
          [{ name: h.name, startMonth: h.startMonth, endMonth: typeof h.endMonth === "number" ? h.endMonth : undefined }] : []) }]));
      return dynasties.map((dynasty, i) => buildUnifiedFactionChronicle({ dynasty, faction: factions.get(dynasty.factionId)!,
        factions, worldMonth: snapshot.world.worldMonth, events: WorldHistory.getEventsForFaction(dynasty.factionId), phases: houseBefore[i],
        lifetime: snapshot.factionLifetime.records.find(r => r.factionId === dynasty.factionId)!, totalWorldBlocks: snapshot.factionLifetime.totalWorldBlocks }));
    };
    const articleBefore = articles(encoded, state.dynasties);
    hydrateWorldSave(core, encoded); const first = exportWorldSave(core);
    expect(articles(first, DynastyRegistry.exportState().dynasties)).toEqual(articleBefore);
    const houseAfter = DynastyRegistry.exportState().dynasties.map(dynasty => deriveHouseAssessments({ dynasty,
      faction: { name: dynasty.factionId, displayName: dynasty.factionId, color: 1, status: "ACTIVE", stateFoundedMonth: 0 },
      factions: new Map(), events: [], worldMonth: first.world.worldMonth }));
    expect(houseAfter).toEqual(houseBefore); expect(houseAfter.every(phases => phases[0].rulerCount === 1)).toBe(true);
    expect(first.dynasties).toEqual(encoded.dynasties); expect(first.worldHistory).toEqual(save.worldHistory);
    hydrateWorldSave(core, first); expect(exportWorldSave(core)).toEqual(first); expect(worldRandom.exportState()).toEqual(save.worldRandom);
  });
  it("retains tenure roles, tags and commentary after real V14 hydration without changing genealogy or RNG", () => {
    const save = fixture();
    save.world.worldMonth = save.world.clock.worldMonth = 600;
    setFixtureLifetimeRecords(save);
    save.dynasties = [{ factionId: "qin", houseName: "田氏", currentRulerId: "next", heirIds: [],
      houseEpochs: [{ houseName: "田氏", startMonth: 0, foundingRulerId: "exile", startReason: "FOUNDING" }],
      rulers: [
        { rulerId: "exile", houseName: "田氏", givenName: "怀", bornMonth: -400, accessionMonth: 20, endMonth: 473,
          politicalEndMonth: 473, status: "dead", endReason: "去世", deathMonth: 473, deathReason: "去世" },
        { rulerId: "next", houseName: "田氏", givenName: "续", bornMonth: 100, accessionMonth: 473,
          status: "ruling", predecessorId: "exile", parentId: "exile" },
      ] }];
    WorldHistory.reset(); WorldHistory.addFactionExiled(10, "qin", "田氏", 1);
    WorldHistory.addFactionRestored(500, "qin", "现城", 1, "active");
    save.worldHistory = WorldHistory.exportState();
    const derived = (input: typeof save) => {
      const dynasty = { rulers: (input.dynasties[0].rulers as RulerSaveV14[]).map(importRulerSave) };
      const assessment = deriveRulerAssessment({ ruler: dynasty.rulers[0], dynasty,
        faction: { name: "qin", stateFoundedMonth: 0 }, events: input.worldHistory.events as WorldEvent[],
        worldMonth: input.world.worldMonth });
      return { assessment, tags: buildRulerTags(assessment.evidence), voice: composeHistorianVoice(assessment.evidence) };
    };
    const before = derived(save);
    expect(before.assessment.evidence.tenure).toMatchObject({ totalTenureMonths: 453, activeRuleMonths: 0, exileMonths: 453 });
    expect(before.assessment.evidence.roles).toContain("LONG_EXILE");
    expect(before.assessment.evidence.roles).not.toContain("LAST_RULER");
    expect(before.tags).not.toContain("短祚");
    const encoded = JSON.parse(JSON.stringify(save));
    expect(validateWorldSave(encoded)).toEqual({ valid: true, errors: [] });
    const core = target(); hydrateWorldSave(core, encoded);
    const first = exportWorldSave(core);
    expect(derived(first)).toEqual(before);
    expect(first.dynasties).toEqual(save.dynasties); expect(first.factionLifetime).toEqual(save.factionLifetime);
    expect(first.worldHistory).toEqual(encoded.worldHistory); expect(first.worldRandom).toEqual(save.worldRandom);
    hydrateWorldSave(core, JSON.parse(JSON.stringify(first)));
    const second = exportWorldSave(core);
    expect(second).toEqual(first); expect(derived(second)).toEqual(before);
  });
  it("V14 preserves independently ended offices, actual deaths, retirement, family and RNG across hydration", () => {
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
    expect(first.saveSchemaVersion).toBe(15); expect(worldRandom.exportState()).toEqual(save.worldRandom);
    hydrateWorldSave(core, JSON.parse(JSON.stringify(first))); expect(exportWorldSave(core)).toEqual(first);
  });
  it("V15 restores archived military people and ended formations without reappointing or drawing RNG", () => {
    const save = fixture();
    save.registries.militaryCommandRegistry = {
      people: [{ personId: "military-person-1", sourceUserId: 81, name: "旧将", bornMonth: -500, factionId: "qin", status: "RETIRED",
        appointments: [{ factionId: "qin", startMonth: 12, endMonth: 24, endReason: "TRANSFERRED", commandId: "military-command-1" }], capturedEventIds: [] }],
      formations: [{ commandId: "military-command-1", factionId: "qin", commanderPersonId: "military-person-1", memberUnitIds: [],
        createdMonth: 12, status: "DISBANDED", captures: [] }],
      personSequence: 2, commandSequence: 2, lastEvaluationMonth: 24,
    };
    expect(validateWorldSave(save)).toEqual({ valid: true, errors: [] });
    const core = target(); const rng = worldRandom.exportState();
    hydrateWorldSave(core, JSON.parse(JSON.stringify(save)));
    const first = exportWorldSave(core);
    expect(first.registries.militaryCommandRegistry).toEqual(save.registries.militaryCommandRegistry);
    expect(worldRandom.exportState()).toEqual(rng);
    hydrateWorldSave(core, JSON.parse(JSON.stringify(first)));
    expect(exportWorldSave(core)).toEqual(first);
  });
  it.each(["AGE_RETIREMENT", "NATURAL_DEATH"] as const)("V15 strictly restores and round-trips the new military lifecycle %s without a hydration action", reason => {
    const save = fixture();
    save.registries.militaryCommandRegistry = {
      people: [{ personId: "military-person-1", sourceUserId: 81, name: "旧将", bornMonth: -1200, factionId: "qin", status: reason === "NATURAL_DEATH" ? "DEAD" : "RETIRED",
        appointments: [{ factionId: "qin", startMonth: 12, endMonth: 24, endReason: reason === "NATURAL_DEATH" ? "DEATH" : "AGE_RETIREMENT", commandId: "military-command-1" }],
        ...(reason === "NATURAL_DEATH" ? { deathMonth: 24, deathCause: "NATURAL_DEATH" } : {}), capturedEventIds: [] }],
      formations: [{ commandId: "military-command-1", factionId: "qin", commanderPersonId: "military-person-1", memberUnitIds: [], createdMonth: 12, status: "DISBANDED", captures: [] }],
      personSequence: 2, commandSequence: 2, lastEvaluationMonth: 24,
    };
    (save.worldHistory.events as WorldEvent[]).push({ id: "military-life-event", year: 24, monthIndex: 24, category: "politics", importance: "normal", title: "真实生命周期", actorFactionId: "qin", factionIds: ["qin"],
      type: reason === "NATURAL_DEATH" ? "military-person-died" : "military-command-ended",
      metadata: reason === "NATURAL_DEATH" ? { personId: "military-person-1", deathCause: "NATURAL_DEATH" } : { personId: "military-person-1", commandId: "military-command-1", endReason: "AGE_RETIREMENT" } });
    expect(validateWorldSave(save)).toEqual({ valid: true, errors: [] });
    const missing = structuredClone(save); missing.worldHistory.events = []; expect(validateWorldSave(missing).valid).toBe(false);
    const duplicate = structuredClone(save); (duplicate.worldHistory.events as WorldEvent[]).push({ ...(duplicate.worldHistory.events as WorldEvent[])[0], id: "duplicate-life" }); expect(validateWorldSave(duplicate).valid).toBe(false);
    const core = target(), rng = worldRandom.exportState();
    hydrateWorldSave(core, JSON.parse(JSON.stringify(save)));
    const exported = exportWorldSave(core);
    expect(exported.registries.militaryCommandRegistry).toEqual(save.registries.militaryCommandRegistry);
    expect(worldRandom.exportState()).toEqual(rng);
    hydrateWorldSave(core, JSON.parse(JSON.stringify(exported)));
    expect(exportWorldSave(core)).toEqual(exported);
    const invalid = structuredClone(save);
    invalid.registries.militaryCommandRegistry.people[0].bornMonth = 0;
    expect(validateWorldSave(invalid).valid).toBe(false);
  });
  it("V14 keeps successive deposition accessions, later deposition, death and cooldown canonical across export/hydration", () => {
    const save = fixture();
    const snapshot = (month: number) => ({ month, population: 10, territoryShare: 0.2, cityCount: 1, stability: 35 });
    save.world.worldMonth = save.world.clock.worldMonth = 42;
    save.dynasties = [{ factionId: "qin", houseName: "田氏", currentRulerId: "final", heirIds: [], lastDepositionAttemptMonth: 36,
      houseEpochs: [{ houseName: "田氏", startMonth: 0, foundingRulerId: "predecessor", startReason: "FOUNDING" }], rulers: [
        { rulerId: "predecessor", houseName: "田氏", givenName: "平", bornMonth: -360, accessionMonth: 0, endMonth: 12,
          politicalEndMonth: 12, endReason: "被废", status: "deposed", reignOrdinal: 1,
          chronicle: { accessionSnapshot: snapshot(0), latestSnapshot: snapshot(12), endSnapshot: snapshot(12), notableEventIds: ["deposed-event"] } },
        { rulerId: "successor", houseName: "田氏", givenName: "继", bornMonth: -240, accessionMonth: 12, endMonth: 36,
          politicalEndMonth: 36, endReason: "被废", status: "dead", deathMonth: 42, deathReason: "自然去世",
          accessionCause: "DEPOSITION", predecessorId: "predecessor", parentId: "predecessor", relationType: "DIRECT_CHILD", reignOrdinal: 2,
          chronicle: { accessionSnapshot: snapshot(12), latestSnapshot: snapshot(36), endSnapshot: snapshot(36), notableEventIds: ["deposed-event", "deposed-event-2"], deathCause: "自然去世" } },
        { rulerId: "final", houseName: "田氏", givenName: "终", bornMonth: -180, accessionMonth: 36,
          status: "ruling", accessionCause: "DEPOSITION", predecessorId: "successor", parentId: "successor", relationType: "DIRECT_CHILD", reignOrdinal: 3,
          chronicle: { accessionSnapshot: snapshot(36), latestSnapshot: snapshot(42), notableEventIds: ["deposed-event-2"] } },
      ] }];
    save.worldHistory.events = [
      { id: "crisis-event", year: 1, monthIndex: 1, category: "war", type: "capital-fallen", title: "都城陷落",
        factionIds: ["qin"], actorFactionId: "qin", targetFactionId: "qin", importance: "major" },
      { id: "deposed-event", year: 12, monthIndex: 12, category: "politics", type: "ruler-deposed", title: "宗室废立",
        factionIds: ["qin"], actorFactionId: "qin", rulerId: "successor", importance: "major",
        metadata: { factionId: "qin", month: 12, previousRulerId: "predecessor", nextRulerId: "successor",
          previousRulerName: "田平", nextRulerName: "田继", previousHouseName: "田氏", nextHouseName: "田氏",
          relation: "DIRECT_CHILD", crisisEvidenceEventIds: "crisis-event", houseChanged: 0, nameChanged: 0, colorChanged: 0 } },
      { id: "crisis-event-2", year: 25, monthIndex: 25, category: "war", type: "capital-fallen", title: "再失都城",
        factionIds: ["qin"], actorFactionId: "qin", targetFactionId: "qin", importance: "major" },
      { id: "deposed-event-2", year: 36, monthIndex: 36, category: "politics", type: "ruler-deposed", title: "再次宗室废立",
        factionIds: ["qin"], actorFactionId: "qin", rulerId: "final", importance: "major",
        metadata: { factionId: "qin", month: 36, previousRulerId: "successor", nextRulerId: "final",
          previousRulerName: "田继", nextRulerName: "田终", previousHouseName: "田氏", nextHouseName: "田氏",
          relation: "DIRECT_CHILD", crisisEvidenceEventIds: "crisis-event-2", houseChanged: 0, nameChanged: 0, colorChanged: 0 } },
      { id: "successor-death", year: 42, monthIndex: 42, category: "politics", type: "ruler-died", title: "田继去世",
        factionIds: ["qin"], actorFactionId: "qin", importance: "normal", metadata: { rulerId: "successor", deathReason: "自然去世" } },
    ] as any;
    expect(validateWorldSave(save)).toEqual({ valid: true, errors: [] });
    const core = target(); hydrateWorldSave(core, JSON.parse(JSON.stringify(save)));
    const restored = exportWorldSave(core);
    expect(restored.saveSchemaVersion).toBe(15);
    expect(restored.dynasties[0]).toMatchObject({ currentRulerId: "final", lastDepositionAttemptMonth: 36 });
    expect(restored.dynasties[0].rulers).toMatchObject([
      { rulerId: "predecessor", status: "deposed", endMonth: 12, endReason: "被废" },
      { rulerId: "successor", status: "dead", endMonth: 36, endReason: "被废", deathMonth: 42, accessionMonth: 12, accessionCause: "DEPOSITION" },
      { rulerId: "final", status: "ruling", accessionMonth: 36, accessionCause: "DEPOSITION" },
    ]);
    hydrateWorldSave(core, JSON.parse(JSON.stringify(restored)));
    expect(exportWorldSave(core)).toEqual(restored);
  });
  it.each(["old-v13", "status", "dead-no-proof", "political-death-cause", "death-before-birth", "future-death", "incomplete-death", "end-before-accession", "missing-political-end", "unknown-posthumous", "terminal-office", "cross-faction-current", "event-reference"])("rejects %s during PRECHECK without tearing down the running world", kind => {
    const save = fixture();
    const ruler: any = { rulerId: "r1", houseName: "田氏", bornMonth: 0, accessionMonth: 1, status: "ruling" };
    save.dynasties = [{ factionId: "qin", houseName: "田氏", currentRulerId: "r1", heirIds: [],
      houseEpochs: [{ houseName: "田氏", startMonth: 1, foundingRulerId: "r1", startReason: "FOUNDING" }], rulers: [ruler] }];
    if (kind === "old-v13") (save as any).saveSchemaVersion = 13;
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
    if (kind === "old-v13") expect(() => hydrateWorldSave(core, save)).toThrow("该存档版本已不受支持，请创建新世界。");
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
    const first=exportWorldSave(core);expect(first.saveSchemaVersion).toBe(15);
    expect(first.factions[0]).toMatchObject({terminationReason:"SUBMITTED",terminationTargetFactionId:"wei",terminationMonth:36});
    expect(first.cities[0].ownerFactionId).toBe("wei");expect(first.blocks.every(b=>b.ownerFactionId === "wei")).toBe(true);
    expect((first.dynasties[0].rulers as any[])[0]).toMatchObject({status:"abdicated",endReason:"纳土退位",politicalEndMonth:36});
    expect((first.dynasties[0].rulers as any[])[1]).toMatchObject({status:"kin",parentId:"last"});
    hydrateWorldSave(core,first);expect(exportWorldSave(core)).toEqual(first);expect(worldRandom.exportState()).toEqual(rng);
    expect(validateWorldSave({...first,saveSchemaVersion:10}).valid).toBe(false);
    const oldTarget=target();expect(()=>hydrateWorldSave(oldTarget,{...first,saveSchemaVersion:10} as any)).toThrow(/不受支持/);expect(oldTarget.prepareForHydration).not.toHaveBeenCalled();

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

it("V15完整水合保留轻度保护输入、18月时钟和单次RNG续跑，不持久化会话诊断", async () => {
  const {default:WorldRemnants}=await import("../Simulation/WorldRemnants");
  const save=fixture(); save.appVersion="v0.99931r"; // Existing V15 saves remain readable.
  save.world.worldMonth=save.world.clock.worldMonth=6017;
  save.factions.push({...save.factions[0],factionId:"old",displayName:"旧",status:"EXILED",stateFoundedMonth:0,
    capitalCityId:undefined,lastExiledMonth:6000,cumulativeActiveMonths:6000});
  save.dynasties=[{factionId:"old",houseName:"田氏",currentRulerId:"old-r",heirIds:[],
    houseEpochs:[{houseName:"田氏",startMonth:0,foundingRulerId:"old-r",startReason:"FOUNDING"}],
    rulers:[{rulerId:"old-r",houseName:"田氏",givenName:"续",bornMonth:5400,accessionMonth:5800,naturalDeathMonth:6500,status:"exiled"}]}];
  save.worldExiles=[{factionId:"old",startedMonth:6000,rulerId:"old-r",heirIds:[],remnantPopulation:12,legitimacy:80,lastLegitimacyMonth:6012,lastRemnantDecayMonth:6000}];
  save.worldRemnants=[{factionId:"old",population:12,extinctMonth:6000}];
  WorldHistory.reset(); WorldHistory.addFactionExiled(6000,"old","田续",12); save.worldHistory=WorldHistory.exportState();
  setFixtureLifetimeRecords(save);
  expect(save.saveSchemaVersion).toBe(15);
  const encoded=JSON.parse(JSON.stringify(save));
  expect(validateWorldSave(encoded)).toEqual({valid:true,errors:[]});
  const core=target(); hydrateWorldSave(core,encoded);
  const canonical=exportWorldSave(core); expect(validateWorldSave(canonical)).toEqual({valid:true,errors:[]});
  hydrateWorldSave(core,JSON.parse(JSON.stringify(canonical))); expect(exportWorldSave(core)).toEqual(canonical);
  const nextCheck=()=>{
    // The rendering shell adapter retains DTO field names; use the real runtime aliases for this resource check.
    const team=core.teams.find((t:any)=>t.name==="old");
    Object.assign(team,{firstFoundedYear:0,lastExiledYear:6000,cumulativeActiveYears:6000,restorationYears:[]});
    const sim=core.simulator.exportState();
    core.simulator.importState({...sim,clock:{...sim.clock,worldMonth:6018}});
    WorldExiles.update(6018,[team]);
    expect(WorldExiles.getDiagnostics().productionProtection).toMatchObject({protectedChecks:1,meanChance:.3849609375});
    const result={exiles:WorldExiles.exportState(),remnants:WorldRemnants.exportState(),rng:worldRandom.exportState()};
    WorldExiles.update(6018,[team]);
    expect({exiles:WorldExiles.exportState(),remnants:WorldRemnants.exportState(),rng:worldRandom.exportState()}).toEqual(result);
    return result;
  };
  const a=nextCheck();
  hydrateWorldSave(core,JSON.parse(JSON.stringify(canonical)));
  expect(WorldExiles.getDiagnostics().remnantChecks).toBe(0);
  expect(nextCheck()).toEqual(a);
  expect(WorldHistory.exportState()).toEqual(save.worldHistory);
  // Full post-check export/validation/hydration also retains the actual result.
  const after=exportWorldSave(core); expect(validateWorldSave(after)).toEqual({valid:true,errors:[]});
  hydrateWorldSave(core,JSON.parse(JSON.stringify(after))); expect(exportWorldSave(core)).toEqual(after);
});

it("V15旧地响应事件及真实User/逻辑单位完整往返，严格拒绝伪造响应证据",async()=>{
  const {default:LogicalUnitRegistry}=await import("../Simulation/LogicalUnitRegistry");
  const save=fixture(); save.world.worldMonth=save.world.clock.worldMonth=480;
  save.factions.push({...save.factions[0],factionId:"old",displayName:"旧",stateFoundedMonth:0,
    capitalCityId:"active",lastExiledMonth:400,currentActiveSinceMonth:480,restorationMonths:[480],cumulativeActiveMonths:400});
  delete save.factions[0].capitalCityId;
  save.cities[0].ownerFactionId="old"; save.blocks[0].ownerFactionId="old";
  save.dynasties=[{factionId:"old",houseName:"田氏",currentRulerId:"old-r",heirIds:[],houseEpochs:[{houseName:"田氏",startMonth:0,foundingRulerId:"old-r",startReason:"FOUNDING"}],
    rulers:[{rulerId:"old-r",houseName:"田氏",givenName:"续",bornMonth:100,accessionMonth:400,naturalDeathMonth:1000,status:"ruling"}]}];
  save.users=[{userId:77,name:"居民",factionId:"old",sourceFactionId:"qin",playerUnitId:"unit-1",loyalty:70,score:0,role:"NORMAL",bornMonth:100,slaveUnits:[]}];
  save.units=[{unitId:"unit-1",factionId:"old",userId:77,x:16,y:16,vx:0,vy:0,speed:150,radius:16,scale:1,speedCoefficient:0,sizeCoefficient:0,role:"NORMAL",alive:true,kind:"user",children:[]}];
  save.registries.logicalUnitRegistry={nextUnitSequence:2};
  WorldHistory.reset();WorldHistory.addFactionExiled(400,"old","田续",1);
  WorldHistory.addCityRevolt(480,"现城","qin","old","active","restoration-old-480-active");
  WorldHistory.addLocalResidentRestoration(480,{name:"old",displayName:"旧"},{name:"qin",displayName:"秦"},{id:"active",name:"现城"},
    {rulerId:"old-r",claimantName:"田续",supporterUserId:77,supporterName:"居民",supporterBornMonth:100,supporterLogicalUnitId:"unit-1",supporterX:16,supporterY:16,
      houseName:"田氏",houseEpochStartMonth:0,restorationBasis:"FORMER_CAPITAL",historicalHeldMonths:400,restorationTrigger:"LOW_LOYALTY",cityLoyalty:20,cityDevastation:0,ownerStability:70,recentTransfers:1,responseRadiusCells:3},"restoration-old-480-active");
  save.worldHistory=WorldHistory.exportState();setFixtureLifetimeRecords(save);
  const encoded=JSON.parse(JSON.stringify(save));expect(validateWorldSave(encoded)).toEqual({valid:true,errors:[]});
  for(const [field,value] of [["supporterPopulation",2],["supporterLogicalUnitId",""],["historicalHeldMonths",119],["houseName","不存在氏"],["cityLoyalty",90],["supporterBornMonth",481]] as const){
    const bad=structuredClone(encoded);bad.worldHistory.events.find((e:any)=>e.type==="faction-restored").metadata[field]=value;
    expect(validateWorldSave(bad).errors).toContain("invalid local-resident restoration evidence");
  }
  // An earlier restoration keeps its old-house snapshot if the polity changes
  // house later in the very same month (existing inclusive epoch convention).
  const boundary=structuredClone(encoded), house=boundary.dynasties[0];
  Object.assign(house.rulers[0],{status:"dead",bornMonth:-400,naturalDeathMonth:480,endMonth:480,politicalEndMonth:480,endReason:"去世",deathMonth:480,deathReason:"去世"});
  house.rulers.push({rulerId:"new-r",houseName:"叶氏",givenName:"续",bornMonth:0,accessionMonth:480,naturalDeathMonth:1000,status:"ruling"});
  house.currentRulerId="new-r";house.houseName="叶氏";house.houseEpochs[0].endMonth=479;
  house.houseEpochs.push({houseName:"叶氏",startMonth:480,foundingRulerId:"new-r",startReason:"NATURAL_HOUSE_SUCCESSION"});
  expect(validateWorldSave(boundary)).toEqual({valid:true,errors:[]});
  const zone=structuredClone(encoded), zoneMeta=zone.worldHistory.events.find((e:any)=>e.type==="faction-restored").metadata;
  zoneMeta.responseRadiusCells=5;
  expect(validateWorldSave(zone).errors).toContain("invalid local-resident restoration evidence");
  Object.assign(zoneMeta,{responseArea:"CONTROLLED_CITY_ZONE",responseNeighborLayers:2,responseCenterX:16,responseCenterY:16});
  expect(validateWorldSave(zone)).toEqual({valid:true,errors:[]});
  const core=target(); core.logicalUnitRegistry=new LogicalUnitRegistry(); core.logicalGameplayAuthority=true;
  hydrateWorldSave(core,zone);
  const user=core.teams.find((t:any)=>t.name==="old").users.values().next().value;
  expect(user).toMatchObject({id:77,name:"居民",bornMonth:100,team:{name:"old"},sourceTeam:{name:"qin"}});
  expect(core.logicalUnitRegistry.get("unit-1")).toMatchObject({factionId:"old",userId:77,alive:true});
  const first=exportWorldSave(core);expect(validateWorldSave(first)).toEqual({valid:true,errors:[]});
  hydrateWorldSave(core,JSON.parse(JSON.stringify(first)));expect(exportWorldSave(core)).toEqual(first);
  expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(1);
  const random=worldRandom.exportState();WorldExiles.update(481,core.teams);
  expect(worldRandom.exportState()).toEqual(random);expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(1);
});
