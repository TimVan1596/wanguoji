import { afterEach, describe, expect, it, vi } from "vitest";
const { game } = vi.hoisted(() => ({ game: { Core: {} as any, BlockSize: 32 } }));
vi.mock("../Game/Game", () => ({ default: game }));
vi.mock("../Components/Team", () => ({ default: class {} }));
vi.mock("../Components/Block", () => ({ default: class {} }));
vi.mock("phaser3-rex-plugins/plugins/circlemaskimage", () => ({ default: class {} }));
vi.mock("../Components/Player", () => ({ default: class {} }));
vi.mock("../Components/Slaves", () => ({ default: class { npcs=new Map(); children={size:0}; } }));
vi.mock("../Components/User", () => ({ default: class {} }));
vi.mock("../Components/MessageToast", () => ({ MessageToast: class {} }));
vi.mock("../Components/Farms", () => ({ default: class {} }));
vi.mock("../Live/Danmu", () => ({ default: { Apply: vi.fn((message: any) => {
  const team = game.Core.teams.find((t: any) => t.name === message.teamName);
  if (team) team.users.add({ name: message.name, loyalty: message.loyalty });
  return team;
}) } }));
vi.mock("../Live/LocalDanmaku", () => ({ createLocalDanmu: (name: string, teamName: string, loyalty: number) => ({ name, teamName, loyalty }) }));
import WorldEventSystem from "./WorldEventSystem";
import FactionRegistry from "./FactionRegistry";
import WorldHistory from "../History/WorldHistory";
import DynastyRegistry from "../Politics/Dynasty";
import WorldExiles from "./WorldExiles";
import WorldRemnants from "./WorldRemnants";
import worldRandom from "./WorldRandom";
import { formatHistoryEventTitle } from "../History/HistoryRenderRules";
import FactionEffects from "./FactionEffects";
import * as restorationRules from "./HistoricalRestorationRules";

async function fixture(basis = "capital", founderPath = false, naturalLives = false, seed = "historical-restoration-execution") {
  vi.stubGlobal("Phaser", { Math: { Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)) } });
  const { default: City } = await vi.importActual<typeof import("../Components/City")>("../Components/City");
  const { default: Team } = await vi.importActual<typeof import("../Components/Team")>("../Components/Team");
  WorldHistory.reset(); DynastyRegistry.reset(); WorldExiles.reset(); WorldRemnants.reset(); FactionRegistry.reset(); FactionEffects.reset();
  worldRandom.initialize(seed);
  const teams = ["founder", "old", "owner"].map(name => ({ name, displayName: name, houseName: "宋氏", nameHistory: [{ name, startMonth: 0 }],
    status: "ACTIVE", factionType: "KINGDOM", identityStage: "STATE", sovereigntyRank: "KING", stateFoundedMonth: 0,
    firstFoundedYear: 0, cumulativeActiveYears: 0, currentActiveSinceYear: 0, restorationYears: [], origin: { type: "INITIAL", foundedMonth: 0 },
    cities: [] as any[], users: new Set(), blocks: { children: { size: 1, entries: [] } }, removeRulerUnit() {},
    markActive: Team.prototype.markActive, markExtinct: Team.prototype.markExtinct, addCity(c: any) { if (!this.cities.includes(c)) this.cities.push(c); }, removeCity(c: any) { this.cities = this.cities.filter((v: any) => v !== c); },
    setCapitalCity(c: any, month: number) { c.setCapital(true, month); },
  } as any));
  const [founder, old, owner] = teams;
  game.Core = { teams, totalCells: 3, handleFactionExtinction() {}, simulator: { year: 480 }, map: {} };
  vi.spyOn(DynastyRegistry, "ensureRulerUnit").mockImplementation(() => undefined);
  teams.forEach(team => {
    DynastyRegistry.initializeFaction(team, 0);
    if (!naturalLives) DynastyRegistry.get(team.name)!.rulers.forEach(ruler => { ruler.naturalDeathYear = 10000; ruler.plannedEndYear = 10000; });
  });
  if (naturalLives) for(let month=1;month<=400;month++) DynastyRegistry.update(month,teams);
  if (!founderPath) {
    founder.status = "EXILED"; founder.isDie = true; DynastyRegistry.markExiled(founder, 400);
    WorldExiles.start(founder, 400, 0); WorldExiles.get("founder")!.legitimacy = 0;
  }
  const candidate = founderPath ? founder : old;
  candidate.status = "EXILED"; candidate.isDie = true; candidate.lastExiledYear = 400; candidate.currentActiveSinceYear = undefined;
  DynastyRegistry.markExiled(candidate, 400); WorldRemnants.add(candidate.name, 3, 400); WorldExiles.start(candidate, 400, 3);
  WorldExiles.get(candidate.name)!.legitimacy = 80;
  const c: any = Object.create(City.prototype);
  Object.assign(c, { id: "city", name: "旧城", founderFactionId: "founder", ownerFactionId: "owner", foundedYear: 0, isCapital: false,
    history: [{ year: 0, type: "founded", title: "建立", newOwnerFactionId: "founder" },
      ...(!founderPath ? [{ year: 10, type: "captured", title: "攻陷", previousOwnerFactionId: "founder", newOwnerFactionId: "old" },
        ...(basis === "capital" ? [{ year: 20, type: "capital-relocated", title: "迁都", newOwnerFactionId: "old", wasCapital: true }] : [])] : []),
      { year: 400, type: "captured", title: "失守", previousOwnerFactionId: founderPath ? "founder" : "old", newOwnerFactionId: "owner" }],
    captureCount: founderPath ? 1 : 2, loyalty: 0, devastation: 0, lastCapturedYear: 400, fortifiedCells: [],
    block: { updateCityDisplay() {} }, calculateMaxDefense: () => 10, clearSiegeState() {}, rebuildFortifiedZone() {},
    claimFortifiedZone() {}, refreshZoneVisual() {}, isInCaptureGrace: () => false,
  });
  owner.cities = [c];
  const system = new WorldEventSystem(); system.reset(468);
  return { teams, city: c, candidate, system, old, founder, owner };
}
function check(f: Awaited<ReturnType<typeof fixture>>, month = 480) { (f.system as any).checkRestorations(month, f.teams); }

describe("w资源不连续性修复：真实年度事务与种子演练",()=>{
  it("相同真实战乱旧都，有残部可使用渐进响应；一次draw，旧期望单独保留",async()=>{
    const f=await fixture(); f.city.loyalty=39; f.city.devastation=90;
    const draw=vi.spyOn(worldRandom,"next").mockReturnValue(.99);
    check(f);
    const d=f.system.getRestorationDiagnosticSnapshot();
    expect(draw).toHaveBeenCalledOnce(); expect(d.resourceResponseChecks).toBe(1);
    expect(d.expectedRestorations).toBeGreaterThan(d.baselineExpectedRestorations);
    expect(d.expectedRestorations).toBeLessThanOrEqual(.03);
    expect(d.localSupport.eligible).toBe(0); // genuine remnants, not fabricated residents
    expect(WorldRemnants.get("old")?.population).toBe(3);
    const state=worldRandom.exportState();f.system.getRestorationDiagnostics();expect(worldRandom.exportState()).toEqual(state);
  });

  it("32固定种子×100年，实际资源/继统/年度抽签/复国执行对照；不是完整自然世界发生率",async()=>{
    const run=async(seed:number,previous:boolean)=>{
      const f=await fixture("capital",false,true,`w-resource-${seed}`);
      // Recorded initial scenario, not a second war/population simulator. The city
      // remains a war-torn old capital. No forced political rolls or success events.
      f.city.loyalty=39;f.city.devastation=90;
      WorldExiles.reset();WorldRemnants.reset();WorldRemnants.add("old",3,400);
      Object.assign(f.candidate,{cumulativeActiveYears:400,currentActiveSinceYear:undefined});
      WorldExiles.start(f.candidate,400,3);
      WorldHistory.addFactionExiled(400,"old",DynastyRegistry.getCurrentRuler("old")?.name??"流亡君主",3);
      f.system.reset(400);
      const old=previous ? vi.spyOn(restorationRules,"localResidentRestorationChance").mockImplementation(i=>i.legacyChance) : undefined;
      const start=performance.now();
      for(let month=401;month<=1600;month++) {
        game.Core.simulator.year=month;
        check(f,month);FactionEffects.update(month);DynastyRegistry.update(month,f.teams);WorldExiles.update(month,f.teams);
      }
      old?.mockRestore();
      const d=f.system.getRestorationDiagnosticSnapshot(),e=WorldExiles.getDiagnostics();
      const events=WorldHistory.getEvents().filter(e=>e.type==="faction-restored" && e.actorFactionId==="old");
      expect(events.length).toBe(d.successes);
      if(events.length) {
        expect(f.city.ownerFactionId).toBe("old");expect(f.candidate.status).toBe("ACTIVE");
        expect(events[0].metadata).toMatchObject({restorationBasis:"FORMER_CAPITAL"});
        expect(formatHistoryEventTitle(events[0],new Map())).toContain("旧都");
        const saved=WorldHistory.exportState();WorldHistory.importState(JSON.parse(JSON.stringify(saved)));
        expect(WorldHistory.exportState()).toEqual(saved);
      }
      if(f.candidate.status==="EXTINCT") {
        const before=WorldHistory.getEventTypeCount("faction-restored");check(f,1612);
        expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(before);
      }
      const result={draws:d.restorationDraws,eligible:d.warTornEligible,expected:d.expectedRestorations,
        successes:d.successes,ends:e.politicalEnds,remnantZero:e.remnantFirstZero,
        population:f.candidate.users.size,monthMs:(performance.now()-start)/1200,
        evidence:events.map(e=>({id:e.id,month:e.monthIndex,metadata:e.metadata}))};
      vi.restoreAllMocks();return result;
    };
    const rows=[];
    for(let seed=0;seed<32;seed++) rows.push({seed,before:await run(seed,true),after:await run(seed,false)});
    const totals=(key:"before"|"after")=>rows.reduce((s,r)=>({draws:s.draws+r[key].draws,eligible:s.eligible+r[key].eligible,
      expected:s.expected+r[key].expected,successes:s.successes+r[key].successes,ends:s.ends+r[key].ends,
      remnantZero:s.remnantZero+r[key].remnantZero,population:s.population+r[key].population,
      monthMs:s.monthMs+r[key].monthMs/32}),{draws:0,eligible:0,expected:0,successes:0,ends:0,remnantZero:0,population:0,monthMs:0});
    console.log("w受控真实子系统演练（32种子各100年；固定初始旧都危机，非Core自然战争/人口发生率）",JSON.stringify({before:totals("before"),after:totals("after"),evidence:rows.filter(r=>r.after.successes).map(r=>({seed:r.seed,events:r.after.evidence}))}));
    expect(totals("after").expected).toBeGreaterThan(totals("before").expected);
    const repeat=await run(0,false);
    expect({...repeat,monthMs:0}).toEqual({...rows[0].after,monthMs:0});
  },60000);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); WorldHistory.reset(); DynastyRegistry.reset(); WorldRemnants.reset(); WorldExiles.reset(); });

describe("真实世界事件系统→城市政治恢复→人物与历史", () => {
  it.each(["capital", "territory"])("%s 新路径使用现有恢复链，残部只消耗一次", async basis => {
    const f = await fixture(basis); const ruler = DynastyRegistry.getCurrentRuler("old")!;
    const original = { ...ruler }; vi.spyOn(worldRandom, "next").mockReturnValue(.001);
    check(f);
    expect(f.city.ownerFactionId).toBe("old"); expect(f.candidate.status).toBe("ACTIVE");
    expect(f.candidate.cities).toEqual([f.city]); expect(f.owner.cities).toHaveLength(0);
    expect(f.candidate.users.size).toBe(3); expect(new Set([...f.candidate.users].map((u: any) => u.name)).size).toBe(3);
    expect(f.city.captureCount).toBe(3); expect(WorldRemnants.get("old")).toBeUndefined(); expect(WorldExiles.get("old")).toBeUndefined();
    expect(DynastyRegistry.getCurrentRuler("old")?.id).toBe(original.id);
    expect(ruler.status).toBe("ruling"); expect(ruler.bornYear).toBe(original.bornYear); expect(ruler.deathMonth).toBeUndefined();
    const events = WorldHistory.getEvents(); const restored = events.filter(e => e.type === "faction-restored");
    expect(restored).toHaveLength(1); expect(restored[0].actorFactionId).toBe("old");
    expect(restored[0].metadata).toMatchObject({ restorationBasis: basis === "capital" ? "FORMER_CAPITAL" : "LONG_RULE", historicalHeldMonths: 390, rulerId: ruler.id, remnantPopulation: 3 });
    expect(formatHistoryEventTitle(restored[0], new Map())).toContain(basis === "capital" ? "旧都" : "长期统治地");
    expect(ruler.chronicle!.notableEventIds).toContain(restored[0].id);
    check(f); expect(f.candidate.users.size).toBe(3); expect(WorldHistory.getEvents().filter(e => e.type === "faction-restored")).toHaveLength(1);
    expect(f.system.getRestorationDiagnostics()).toContain("实际复国：1次");
  });
  it("原始建城者仍使用原路径，不附加历史旧都证据", async () => {
    const f = await fixture("capital", true); vi.spyOn(worldRandom, "next").mockReturnValue(.001); check(f);
    expect(f.city.ownerFactionId).toBe("founder");
    expect(WorldHistory.getEvents().find(e => e.type === "faction-restored")?.metadata?.restorationBasis).toBeUndefined();
  });
  it("原始建城者仍在国时，保留普通收复而不是流亡复国", async () => {
    const f = await fixture(); f.founder.status = "ACTIVE"; f.founder.isDie = false;
    WorldExiles.restore("founder"); vi.spyOn(worldRandom, "next").mockReturnValue(.001);
    f.city.history = []; check(f);
    expect(f.city.ownerFactionId).toBe("founder");
    expect(WorldHistory.getEvents().some(e => e.type === "faction-restored")).toBe(false);
  });
  it("旧都年度检查不会把真实死亡月的最后继统者当作存活；有另一名继统者时仍保留资格", async () => {
    const f = await fixture();
    const dynasty = DynastyRegistry.get("old")!;
    const lastRuler = DynastyRegistry.getCurrentRuler("old")!;
    dynasty.heirIds = [];
    dynasty.designatedHeirId = undefined;
    lastRuler.naturalDeathYear = 480;
    expect(DynastyRegistry.hasClaimant("old")).toBe(true);
    expect(DynastyRegistry.hasClaimantAtMonth("old", 479)).toBe(true);
    expect(DynastyRegistry.hasClaimantAtMonth("old", 480)).toBe(false);
    vi.spyOn(worldRandom, "next").mockReturnValue(.001);
    check(f, 480);
    expect(f.city.ownerFactionId).toBe("owner");
    expect(lastRuler.deathMonth).toBeUndefined(); // qualification is read-only; Dynasty.update owns death.
    expect(WorldHistory.getEvents().some(e => e.type === "faction-restored")).toBe(false);

    const successor = (DynastyRegistry as any).createHeir(f.candidate, dynasty.houseName, 480, lastRuler.id);
    successor.id = "old-live-heir";
    successor.naturalDeathYear = 900;
    successor.plannedEndYear = 900;
    dynasty.rulers.push(successor);
    dynasty.heirIds.push(successor.id);
    expect(DynastyRegistry.hasClaimantAtMonth("old", 480)).toBe(true);
    DynastyRegistry.update(480, f.teams);
    expect(lastRuler.status).toBe("dead");
    expect(lastRuler.deathMonth).toBe(480);
    expect(WorldHistory.getEvents().some(e => e.type === "ruler-succession" && e.metadata?.previousRulerId === lastRuler.id && e.monthIndex === 480)).toBe(true);
    expect(DynastyRegistry.getCurrentRuler("old")?.id).toBe(successor.id);
  });
  it("神力支持复国仍走原支持事件，不冒充城市历史新路径", async () => {
    const f = await fixture("capital", true);
    expect(f.system.restoreByGod(f.city, 480)).toBe(true);
    const events = WorldHistory.getEvents();
    expect(events.some(e => e.type === "god-restoration")).toBe(true);
    expect(events.find(e => e.type === "faction-restored")?.metadata?.restorationBasis).toBeUndefined();
  });
  it("神力恢复执行失败同样不提前扣除残部，不制造支持事件", async () => {
    const f = await fixture("capital", true); vi.spyOn(f.city, "revoltTo").mockReturnValue(false);
    expect(f.system.restoreByGod(f.city, 480)).toBe(false);
    expect(WorldRemnants.get("founder")?.population).toBe(3);
    expect(WorldHistory.getEvents().some(e => e.type === "god-restoration" || e.type === "faction-restored")).toBe(false);
  });
  it.each(["ACTIVE", "EXTINCT", "MERGED", "SUBMITTED", "remnants", "claimant", "legitimacy", "loyalty", "grace", "cooldown", "destroyed", "history"])("%s 不允许新增复国", async gate => {
    const f = await fixture(); f.founder.isDie = true;
    if (["ACTIVE", "EXTINCT"].includes(gate)) f.candidate.status = gate;
    if (["MERGED", "SUBMITTED"].includes(gate)) f.candidate.terminationReason = gate;
    if (gate === "remnants") WorldRemnants.consume("old", 3);
    if (gate === "claimant") { const d = DynastyRegistry.get("old")!; d.currentRulerId = null; d.heirIds = []; }
    if (gate === "legitimacy") WorldExiles.get("old")!.legitimacy = 0;
    if (gate === "loyalty") f.city.loyalty = 35;
    if (gate === "grace") f.city.isInCaptureGrace = () => true;
    if (gate === "cooldown") (f.system as any).cityRebellionYears.city = 470;
    if (gate === "destroyed") f.city.destroyed = true;
    if (gate === "history") f.city.history = [];
    vi.spyOn(worldRandom, "next").mockReturnValue(.001); check(f);
    expect(WorldHistory.getEvents().some(e => e.type === "faction-restored")).toBe(false);
    expect(f.city.ownerFactionId).toBe("owner");
  });
  it("执行失败不消耗残部，不生成复国事件", async () => {
    const f = await fixture(); vi.spyOn(f.city, "revoltTo").mockReturnValue(false); vi.spyOn(worldRandom, "next").mockReturnValue(.001);
    check(f); expect(WorldRemnants.get("old")?.population).toBe(3);
    expect(WorldHistory.getEvents().some(e => e.type === "faction-restored")).toBe(false);
    expect(f.system.getRestorationDiagnostics()).toContain("执行未成功 1次");
  });
  it("无新增资格时仍只消耗一次旧抽签；诊断读取不消耗随机数", async () => {
    const f = await fixture(); f.city.history = [];
    const next = vi.spyOn(worldRandom, "next").mockReturnValue(1); check(f); expect(next).toHaveBeenCalledTimes(1);
    const state = worldRandom.exportState(); f.system.getRestorationDiagnostics(); expect(worldRandom.exportState()).toEqual(state);
    expect(f.system.exportState()).not.toHaveProperty("restorationDiagnostics");
  });
  it("同城两个真实旧统治者只选一个，排序不受国家数组顺序影响", async () => {
    const run = async (reverse: boolean) => {
      const f = await fixture("territory");
      const second: any = { ...f.old, name: "second", displayName: "second", cities: [], users: new Set(), status: "ACTIVE" };
      f.teams.push(second); game.Core.teams = f.teams;
      DynastyRegistry.initializeFaction(second, 0); second.status = "EXILED"; second.isDie = true;
      DynastyRegistry.markExiled(second, 800); WorldRemnants.add("second", 2, 800); WorldExiles.start(second, 800, 2); WorldExiles.get("second")!.legitimacy = 80;
      f.city.history = [f.city.history[0], f.city.history[1],
        { year: 400, type: "captured", title: "易主", previousOwnerFactionId: "old", newOwnerFactionId: "second" },
        { year: 800, type: "captured", title: "易主", previousOwnerFactionId: "second", newOwnerFactionId: "owner" }];
      f.city.captureCount = 3;
      if (reverse) f.teams.reverse();
      vi.spyOn(worldRandom, "next").mockReturnValue(.001); check(f, 900);
      const events = WorldHistory.getEvents().filter(e => e.type === "faction-restored");
      expect(events).toHaveLength(1); expect(events[0].actorFactionId).toBe(f.city.ownerFactionId);
      expect(WorldRemnants.get("second")?.population).toBe(2);
      return f.city.ownerFactionId;
    };
    const first = await run(false); vi.restoreAllMocks(); expect(await run(true)).toBe(first);
  });
  it("复国事件采用发生月历史国号，人物引用属于真实复国王室", async () => {
    const f = await fixture(); vi.spyOn(worldRandom, "next").mockReturnValue(.001); check(f);
    const event = WorldHistory.getEvents().find(e => e.type === "faction-restored")!;
    const factions: any = new Map([["old", { name: "old", displayName: "今名", nameHistory: [{ name: "旧名", startMonth: 0, endMonth: 500 }, { name: "今名", startMonth: 501 }] }]]);
    expect(formatHistoryEventTitle(event, factions)).toContain("旧名国在旧都旧城复国");
    expect(formatHistoryEventTitle(event, factions)).not.toContain("今名");
    expect(event.rulerId).toBe(DynastyRegistry.getCurrentRuler("old")?.id);
    expect(event.rulerId).not.toBe(DynastyRegistry.getCurrentRuler("owner")?.id);
  });
  it("读取重置诊断，读取或关闭诊断不改变抽签与政治结果", async () => {
    const run = async (read: boolean) => {
      const f = await fixture(); worldRandom.initialize("diagnostic-restoration");
      if (read) f.system.getRestorationDiagnostics();
      check(f);
      if (read) f.system.getRestorationDiagnostics();
      return { state: worldRandom.exportState(), events: WorldHistory.exportState(), runtime: f.system.exportState(), owner: f.city.ownerFactionId };
    };
    const before = await run(false); vi.restoreAllMocks(); expect(await run(true)).toEqual(before);
    const f = await fixture(); check(f); const canonical = f.system.exportState(); f.system.importState(canonical, 480);
    expect(f.system.getRestorationDiagnostics()).toContain("实际观察：0个月"); expect(f.system.exportState()).toEqual(canonical);
  });
  it("固定种子受控年度业务对照可重现，不包装为完整自然长局", async () => {
    const run = async (seed: string, enabled: boolean) => {
      const f = await fixture(); if (!enabled) f.city.history = []; worldRandom.initialize(seed);
      for (let month = 480; month < 840; month += 12) check(f, month);
      const events = WorldHistory.getEvents().filter(e => e.type === "faction-restored");
      return { successes: events.length, month: events[0]?.year, rulerId: events[0]?.rulerId, rng: worldRandom.exportState() };
    };
    const results = [];
    for (const seed of ["restore-i-1", "restore-i-2", "restore-i-3", "restore-i-4"]) {
      const old = await run(seed, false); vi.restoreAllMocks(); const current = await run(seed, true); vi.restoreAllMocks();
      expect(await run(seed, true)).toEqual(current); vi.restoreAllMocks();
      expect(old.successes).toBe(0); expect(current.successes).toBeLessThanOrEqual(1);
      results.push({ seed, 观察年数: 30, 旧资格成功: old.successes, 新旧都成功: current.successes, 实际复国月份索引: current.month ?? null });
    }
    console.log("受控年度复国业务对照（没有战斗、人口增长、寿命推进和城市忠诚度演化，不代表自然发生率）", results);
  });

});


describe("战乱旧地真实执行与流亡终局", () => {
  it.each(["capital", "territory"])("忠诚33、破坏94的%s历史资格进入独立风险且只恢复一次", async basis => {
    const f = await fixture(basis); f.city.loyalty = 33; f.city.devastation = 94;
    const next = vi.spyOn(worldRandom, "next").mockReturnValue(.0001);
    check(f); check(f, 492);
    expect(f.candidate.status).toBe("ACTIVE"); expect(f.candidate.restorationYears).toEqual([480]);
    expect(WorldHistory.getEvents().filter(e => e.type === "faction-restored")).toHaveLength(1);
    expect(WorldHistory.getEvents().find(e => e.type === "faction-restored")?.metadata?.restorationTrigger).toBe("WAR_TORN_HISTORICAL_CITY");
    expect(f.candidate.users.size).toBe(3); expect(WorldRemnants.get("old")).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(4); // one decision plus the existing three population-spawn draws
    expect(f.system.getRestorationDiagnostics()).toContain("实际复国：1次（战乱旧地1次）");
  });
  it.each(["no-exile", "no-history", "no-remnants", "no-legitimacy", "no-claimant", "peace", "low-damage", "expired-transfers", "grace", "cooldown", "EXTINCT", "MERGED", "SUBMITTED"])("战乱分支拒绝%s，不产生额外抽签与人口", async gate => {
    const f = await fixture(); f.city.loyalty = 33; f.city.devastation = 94;
    if (gate === "no-exile") f.candidate.status = "ACTIVE";
    if (gate === "no-history") f.city.history = [];
    if (gate === "no-remnants") WorldRemnants.consume("old", 3);
    if (gate === "no-legitimacy") WorldExiles.get("old")!.legitimacy = 0;
    if (gate === "no-claimant") { DynastyRegistry.get("old")!.currentRulerId = null; DynastyRegistry.get("old")!.heirIds = []; }
    if (gate === "low-damage") f.city.devastation = 69;
    if (gate === "peace" || gate === "expired-transfers") f.owner.cities.push({ loyalty: 100, destroyed: true });
    if (gate === "grace") f.city.isInCaptureGrace = () => true;
    if (gate === "cooldown") (f.system as any).cityRebellionYears.city = 470;
    if (["EXTINCT", "MERGED", "SUBMITTED"].includes(gate)) { f.candidate.status = "EXTINCT"; f.candidate.terminationReason = gate; }
    const next = vi.spyOn(worldRandom, "next").mockReturnValue(.0001); check(f);
    expect(next).not.toHaveBeenCalled(); expect(f.city.ownerFactionId).toBe("owner");
    expect(WorldHistory.getEvents().some(e => e.type === "faction-restored")).toBe(false);
  });
  it("同项与多项资格阻断分别计数，失败抽签不扣残部", async () => {
    const f = await fixture(); f.city.loyalty = 33; f.city.devastation = 94;
    WorldExiles.get("old")!.legitimacy = 0; WorldRemnants.consume("old", 3);
    check(f); const d = (f.system as any).restorationDiagnostics;
    expect(d.blockers["流亡合法性不足"]).toBe(1); expect(d.blockers["残部耗尽"]).toBe(1);
    expect(d.soleBlockers["残部耗尽"]).toBeUndefined();
    WorldExiles.get("old")!.legitimacy = 80; WorldRemnants.add("old", 3, 400);
    vi.spyOn(worldRandom, "next").mockReturnValue(.9); check(f, 492);
    expect(WorldRemnants.get("old")?.population).toBe(3); expect(d.attempts).toBe(0);
  });
  it("月度推进终结双零流亡，仍有亲属不能制造死亡，重复推进只记一次", async () => {
    const f = await fixture(); const ruler = DynastyRegistry.getCurrentRuler("old")!;
    const { default: Team } = await vi.importActual<typeof import("../Components/Team")>("../Components/Team");
    f.candidate.markExtinct = Team.prototype.markExtinct; f.founder.markExtinct = Team.prototype.markExtinct;
    WorldRemnants.consume("old", 3); WorldExiles.get("old")!.legitimacy = 0;
    expect(DynastyRegistry.hasClaimant("old")).toBe(true);
    const next = vi.spyOn(worldRandom, "next"); WorldExiles.update(401, f.teams); WorldExiles.update(402, f.teams);
    expect(next).not.toHaveBeenCalled(); expect(f.candidate.status).toBe("EXTINCT");
    expect(ruler.status).toBe("politically-ended"); expect(ruler.deathMonth).toBeUndefined(); expect(ruler.deathReason).toBeUndefined();
    expect(ruler.posthumousEpithet).toBeUndefined(); expect(ruler.templeName).toBeUndefined();
    expect(DynastyRegistry.hasClaimant("old")).toBe(false);
    expect(WorldHistory.getEvents().filter(e => e.type === "faction-extinct" && e.targetFactionId === "old")).toHaveLength(1);
    expect(WorldExiles.getDiagnostics().politicalEnds).toBe(2); // both actual zero-resource exiles in this fixture
    expect(DynastyRegistry.get("old")!.rulers).toContain(ruler);
  });
  it.each(["remnants", "legitimacy"])("只有%s归零暂不扩大终结", async zero => {
    const f = await fixture(); const { default: Team } = await vi.importActual<typeof import("../Components/Team")>("../Components/Team");
    f.founder.markExtinct = Team.prototype.markExtinct;
    if (zero === "remnants") WorldRemnants.consume("old", 3); else WorldExiles.get("old")!.legitimacy = 0;
    WorldExiles.update(401, f.teams); expect(f.candidate.status).toBe("EXILED");
  });
});


describe("战乱路径种子对照与只读观测", () => {
  it("四个固定种子的30年年度业务对照可重现，候选不把总风险叠加", async () => {
    const run = async (seed: string, enabled: boolean, observe: boolean) => {
      const f = await fixture(); f.city.loyalty = 33; f.city.devastation = enabled ? 94 : 0; worldRandom.initialize(seed);
      for (let month = 480; month < 840; month += 12) {
        check(f, month); if (observe) f.system.getRestorationDiagnostics();
      }
      const events = WorldHistory.getEvents().filter(e => e.type === "faction-restored");
      const d = (f.system as any).restorationDiagnostics;
      return { successes: events.length, qualified: d.warTornEligible, month: events[0]?.year,
        rng: worldRandom.exportState(), history: WorldHistory.exportState(), dynasty: DynastyRegistry.exportState() };
    };
    const results = [];
    for (const seed of ["restore-j-1", "restore-j-2", "restore-j-3", "restore-j-4"]) {
      const old = await run(seed, false, false); vi.restoreAllMocks();
      const current = await run(seed, true, false); vi.restoreAllMocks();
      expect(await run(seed, true, true)).toEqual(current); vi.restoreAllMocks();
      expect(old.successes).toBe(0); expect(current.successes).toBeLessThanOrEqual(1);
      results.push({ seed, 观察年数: 30, 旧机制成功: old.successes, 新机制合格检查: current.qualified,
        新机制成功: current.successes, 复国月份索引: current.month ?? null });
    }
    console.log("战乱旧地受控年度执行对照（无战斗、人口演化、寿命和忠诚度更新，不是自然发生率）", results);
  });
  it("近期两次真实易手可以支持高稳定度占领国，但矛盾历史不放行", async () => {
    const f = await fixture(); f.city.loyalty = 33; f.city.devastation = 94;
    f.owner.cities.push({ loyalty: 100, destroyed: true });
    f.city.history.push({ year: 450, type: "captured", title: "易手", previousOwnerFactionId: "owner", newOwnerFactionId: "founder" },
      { year: 460, type: "captured", title: "易手", previousOwnerFactionId: "founder", newOwnerFactionId: "owner" });
    f.city.captureCount += 2;
    const next = vi.spyOn(worldRandom, "next").mockReturnValue(.9); check(f);
    expect(next).toHaveBeenCalledTimes(1); expect((f.system as any).restorationDiagnostics.warTornEligible).toBe(1);
    f.city.history[4].previousOwnerFactionId = "unknown"; next.mockClear(); check(f, 492);
    expect(next).not.toHaveBeenCalled(); expect(f.city.ownerFactionId).toBe("owner");
  });
});

describe("r B1真实资源和复国诊断",()=>{
  it("生产资源检查使用轻度保护，归零只计首次，保存字段与随机流不被诊断改变",async()=>{
    const f=await fixture();
    WorldExiles.reset();WorldRemnants.setPopulation("old",1,400);
    f.candidate.cumulativeActiveYears=400;f.candidate.currentActiveSinceYear=0;
    WorldExiles.start(f.candidate,400,1);WorldExiles.get("old")!.legitimacy=80;
    WorldHistory.addFactionExiled(400,"old","真实流亡君主",1);
    const next=vi.spyOn(worldRandom,"next").mockReturnValue(.43);
    WorldExiles.update(418,[f.candidate]);
    expect(next).toHaveBeenCalledOnce();
    expect(WorldRemnants.get("old")).toBeUndefined();
    expect(WorldExiles.getDiagnostics()).toMatchObject({newExiles:1,resourceChecks:1,remnantChecks:1,remnantHits:1,remnantFirstZero:1});
    expect(WorldExiles.getResourceSamples()[0]).toMatchObject({initialRemnants:1,tenure:{complete:true,stateTenureMonths:400,currentHouseTenureMonths:400}});
    const before=worldRandom.exportState(), canonical=WorldExiles.exportState();
    expect(WorldExiles.getResourceComparisonSummary()).toContain("生产采用a=0.25");
    console.log("真实资源业务夹具的条件对照（非自然世界）", WorldExiles.getResourceComparisonSummary());
    expect(WorldExiles.exportState()).toEqual(canonical);expect(worldRandom.exportState()).toEqual(before);expect(next).toHaveBeenCalledOnce();
    WorldExiles.update(419,[f.candidate]);expect(WorldExiles.getDiagnostics().remnantFirstZero).toBe(1);
    WorldExiles.importState(canonical);expect(WorldExiles.getDiagnostics()).toMatchObject({newExiles:0,resourceChecks:0,remnantFirstZero:0});
    expect(WorldExiles.exportState()).toEqual(canonical);
  });
  it("真实draw、条件期望和执行尝试分开，恢复后进入实际月度随访",async()=>{
    const f=await fixture();const next=vi.spyOn(worldRandom,"next").mockReturnValue(.99);
    check(f);
    const miss=f.system.getRestorationDiagnosticSnapshot();
    expect(miss).toMatchObject({draws:1,restorationDraws:1,attempts:0,successes:0});
    expect(miss.expectedRestorations).toBeGreaterThan(0);
    next.mockReturnValue(.001);check(f,492);
    expect(f.system.getRestorationDiagnosticSnapshot()).toMatchObject({draws:2,attempts:1,successes:1});
    expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(1);
    WorldExiles.update(503,[f.candidate]);expect(WorldExiles.getDiagnostics().insufficient12).toBe(1);
    WorldExiles.update(504,[f.candidate]);expect(WorldExiles.getDiagnostics()).toMatchObject({matured12:1,active12:1});
    WorldExiles.update(552,[f.candidate]);expect(WorldExiles.getDiagnostics()).toMatchObject({matured60:1,active60:1});
    const random=worldRandom.exportState(), history=WorldHistory.exportState();
    f.system.getRestorationDiagnostics();expect(worldRandom.exportState()).toEqual(random);
    WorldHistory.importState(history);expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(1);
    f.system.importState(f.system.exportState(),552);expect(f.system.getRestorationDiagnosticSnapshot().draws).toBe(0);
    expect(WorldHistory.exportState()).toEqual(history);
  });
});

describe("r B1保存续接与原衰减数量",()=>{
  it.each([1,5,12])("%s名残部的生产45%%边界和单次衰减数量保持",async n=>{
    const f=await fixture();WorldRemnants.setPopulation("old",n,400);
    const next=vi.spyOn(worldRandom,"next").mockReturnValue(.46);
    WorldExiles.update(418,[f.candidate]);
    expect(WorldRemnants.get("old")?.population).toBe(n);expect(next).toHaveBeenCalledOnce();
    next.mockReturnValue(.44);WorldExiles.update(436,[f.candidate]);
    expect(WorldRemnants.get("old")?.population ?? 0).toBe(n-Math.max(1,Math.floor(n*.2)));
    expect(WorldExiles.getDiagnostics()).toMatchObject({remnantChecks:2,remnantHits:1});
  });
  it("同一V15权威子状态恢复后资源与RNG续跑一致，派生和显示不改变历史",async()=>{
    const f=await fixture();
    f.candidate.cumulativeActiveYears=400;f.candidate.currentActiveSinceYear=0;
    WorldHistory.addFactionExiled(400,"old","君主",3);
    const {deriveRestorationTenureEvidence}=await import("./RestorationTenureEvidence");
    const {buildRestorationMemoryLines}=await import("../UI/Components/FactionDetails/model");
    const evidence=deriveRestorationTenureEvidence({team:f.candidate,dynasty:DynastyRegistry.get("old"),events:WorldHistory.getEventsForFaction("old"),worldMonth:418});
    expect(evidence.complete).toBe(true);
    expect(buildRestorationMemoryLines(evidence,{worldMonth:418,exileStartedMonth:400,legitimacy:80,remnants:3,hasClaimant:true})[0]).toContain("33年4个月");
    const before={exiles:WorldExiles.exportState(),remnants:WorldRemnants.exportState(),random:worldRandom.exportState(),history:WorldHistory.exportState()};
    WorldExiles.update(418,[f.candidate]);
    const after={exiles:WorldExiles.exportState(),remnants:WorldRemnants.exportState(),random:worldRandom.exportState()};
    WorldExiles.importState(before.exiles);WorldRemnants.importState(before.remnants);worldRandom.restore(before.random);
    WorldExiles.update(418,[f.candidate]);
    expect({exiles:WorldExiles.exportState(),remnants:WorldRemnants.exportState(),random:worldRandom.exportState()}).toEqual(after);
    expect(WorldHistory.exportState()).toEqual(before.history);
  });
});

describe("r B1建城者诊断按实际月份核对",()=>{
  it("最后继统者当月到期不计完整资格，但保留原城市政治draw",async()=>{
    const f=await fixture("capital",true);
    const d=DynastyRegistry.get("founder")!;d.heirIds=[];
    DynastyRegistry.getCurrentRuler("founder")!.naturalDeathYear=480;
    vi.spyOn(worldRandom,"next").mockReturnValue(.99);check(f);
    expect(f.system.getRestorationDiagnosticSnapshot()).toMatchObject({draws:1,founderEligible:0,expectedRestorations:0,attempts:0,blockers:{"无合法继统者":1}});
  });
});

describe("r1真实18月残部保护业务",()=>{
  async function longExile(houseStart=0) {
    const f=await fixture(); WorldExiles.reset(); WorldRemnants.reset();
    Object.assign(f.candidate,{lastExiledYear:6000,cumulativeActiveYears:6000});
    const d=DynastyRegistry.get("old")!;
    if(houseStart) d.houseEpochs=[{...d.houseEpochs![0],endMonth:houseStart-1},{...d.houseEpochs![0],startMonth:houseStart}];
    WorldHistory.addFactionExiled(6000,"old","真实流亡",12);
    WorldRemnants.add("old",12,6000); WorldExiles.start(f.candidate,6000,12);
    WorldExiles.get("old")!.legitimacy=80;
    return f;
  }
  it("生产按真实年资降低命中率；周期、一次draw、损耗量、合法性与诊断隔离",async()=>{
    const f=await longExile(); const next=vi.spyOn(worldRandom,"next").mockReturnValue(.40);
    WorldExiles.update(6017,[f.candidate]); expect(next).not.toHaveBeenCalled();
    WorldExiles.update(6018,[f.candidate]); expect(next).toHaveBeenCalledOnce();
    expect(WorldRemnants.get("old")!.population).toBe(12); // .40 would hit the old .45 rule
    expect(WorldExiles.get("old")!.legitimacy).toBeLessThan(80);
    const check=WorldExiles.getDiagnostics().productionProtection;
    expect(check).toMatchObject({strength:.25,protectedChecks:1,fallbackChecks:0,expiredChecks:0});
    expect(check.recentChecks[0]).toMatchObject({worldMonth:6018,exileMonths:18,hit:false,tenure:{complete:true,stateTenureMonths:6000,currentHouseTenureMonths:6000}});
    expect(check.meanChance).toBeCloseTo(.3849609375);
    WorldExiles.update(6018,[f.candidate]); expect(next).toHaveBeenCalledOnce();
    const random=worldRandom.exportState(), history=WorldHistory.exportState();
    expect(WorldExiles.getProductionProtectionSummary()).toContain("a=0.25");
    expect(f.system.getRestorationDiagnostics()).toContain("有效保护1");
    expect(worldRandom.exportState()).toEqual(random); expect(WorldHistory.exportState()).toEqual(history);
    next.mockReturnValue(.1); WorldExiles.update(6036,[f.candidate]);
    expect(next).toHaveBeenCalledTimes(2); expect(WorldRemnants.get("old")!.population).toBe(10);
    expect(WorldExiles.getDiagnostics().remnantHits).toBe(1);
  });
  it("年轻王统不借前朝年资；历史缺口与流亡起点矛盾回退原45%",async()=>{
    const f=await longExile(5760); const next=vi.spyOn(worldRandom,"next").mockReturnValue(.44);
    WorldExiles.update(6018,[f.candidate]);
    expect(WorldExiles.getDiagnostics().productionProtection.recentChecks[0]).toMatchObject({tenure:{stateTenureMonths:6000,currentHouseTenureMonths:240}});
    expect(WorldExiles.getDiagnostics().productionProtection.meanChance).toBeCloseTo(.4288623046875);
    expect(WorldRemnants.get("old")!.population).toBe(12);
    WorldExiles.get("old")!.startedMonth=6001; WorldExiles.update(6036,[f.candidate]);
    expect(WorldExiles.getDiagnostics().productionProtection).toMatchObject({fallbackChecks:1});
    expect(WorldExiles.getDiagnostics().productionProtection.recentChecks[1].chance).toBe(.45);
    expect(WorldRemnants.get("old")!.population).toBe(10);
    WorldExiles.get("old")!.startedMonth=6000; f.candidate.restorationYears=[1];
    WorldExiles.update(6054,[f.candidate]); expect(next).toHaveBeenCalledTimes(3);
    expect(WorldExiles.getDiagnostics().productionProtection).toMatchObject({fallbackChecks:2});
  });
  it("同一流亡不重置时钟；240月后原45%，耗尽不复生，终结政权不检查",async()=>{
    const f=await longExile(); const next=vi.spyOn(worldRandom,"next").mockReturnValue(.44);
    const state=WorldExiles.get("old")!;
    expect(WorldExiles.start(f.candidate,6120,99)).toBe(state);
    expect(state).toMatchObject({startedMonth:6000,lastRemnantDecayMonth:6000,remnantPopulation:12});
    WorldExiles.update(6240,[f.candidate]);
    expect(WorldExiles.getDiagnostics().productionProtection).toMatchObject({expiredChecks:1,meanChance:.45});
    WorldRemnants.setPopulation("old",1,6000); WorldExiles.update(6258,[f.candidate]);
    expect(WorldRemnants.get("old")).toBeUndefined();
    WorldExiles.update(6276,[f.candidate]); expect(next).toHaveBeenCalledTimes(2);
    f.candidate.status="EXTINCT"; WorldRemnants.add("old",1,6000);
    WorldExiles.update(6294,[f.candidate]); expect(next).toHaveBeenCalledTimes(2);
  });
  it("真实复国再流亡启动新窗口，累计年资排除前次流亡，不重复历史",async()=>{
    const f=await longExile();
    WorldHistory.addFactionRestored(6100,"old","旧城",1,"city");
    WorldExiles.restore("old"); f.candidate.markActive(6100);
    const {default:RealTeam}=await vi.importActual<typeof import("../Components/Team")>("../Components/Team");
    RealTeam.prototype.markExiled.call(f.candidate,6220);
    WorldHistory.addFactionExiled(6220,"old","真实流亡",5);
    WorldRemnants.setPopulation("old",5,6220); WorldExiles.start(f.candidate,6220,5);
    const next=vi.spyOn(worldRandom,"next").mockReturnValue(.99);
    WorldExiles.update(6238,[f.candidate]);
    expect(next).toHaveBeenCalledOnce();
    expect(WorldExiles.getDiagnostics().productionProtection.recentChecks[0]).toMatchObject({exileMonths:18,tenure:{complete:true,stateTenureMonths:6120,currentHouseTenureMonths:6120}});
    expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(1);
    WorldExiles.update(6238,[f.candidate]); expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(1);
  });
});

// Real City/Team/User/Player methods and logical registry, with rendering constructors replaced.
describe("s真实旧地人口响应→复国事务",()=>{
  async function localFixture(basis="capital", founderPath=false) {
    const f=await fixture(basis,founderPath);
    const {default:RealTeam}=await vi.importActual<typeof import("../Components/Team")>("../Components/Team");
    vi.stubGlobal("Phaser",{Math:{Clamp:(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))},GameObjects:{Container:class {}}});
    const {default:RealUser}=await vi.importActual<typeof import("../Components/User")>("../Components/User");
    const {default:RealPlayer}=await vi.importActual<typeof import("../Components/Player")>("../Components/Player");
    const {default:LogicalUnitRegistry}=await import("./LogicalUnitRegistry");
    const {createLogicalUnitState}=await import("./LogicalUnitState");
    const {PopulationTransitionAudit}=await import("./PopulationTransitionAudit");
    const {default:Military}=await import("../Politics/MilitaryCommandRegistry"); Military.reset();
    const logical=new LogicalUnitRegistry(),audit=new PopulationTransitionAudit();
    f.teams.forEach(t=>{
      Object.setPrototypeOf(t,RealTeam.prototype);
      t.players={add(){},remove(){}}; t.color=1;
      t.addCity=RealTeam.prototype.addCity;
      t.removeCity=RealTeam.prototype.removeCity;
    });
    f.city.block.x=64; f.city.block.y=64;
    WorldRemnants.consume(f.candidate.name,100); WorldExiles.get(f.candidate.name)!.remnantPopulation=0;
    const player:any=Object.create(RealPlayer.prototype);
    Object.assign(player,{team:f.owner,active:true,children:[],factionRing:{setStrokeStyle(){}},x:99999,y:99999});
    const user=new RealUser(77,"真实居民",f.owner,player,undefined,70,"NORMAL",undefined,{deferRuntime:true,bornMonth:100});
    player.user=user; f.owner.users.add(user);
    logical.importState(2,[{state:createLogicalUnitState({unitId:"unit-1",factionId:"owner",x:80,y:80,vx:0,vy:0,blockSize:32,radius:16,speed:150,userId:77}),player,user}]);
    game.Core.logicalUnitRegistry=logical;
    game.Core.simulator.recordPopulationMutation=(team:any,before:number,after:number,m:any)=>audit.record(team,before,after,m);
    audit.reset(480,f.teams);
    // Keep a second real city so the primary assertion isolates the resident transfer.
    const {default:RealCity}=await vi.importActual<typeof import("../Components/City")>("../Components/City");
    const second:any=Object.create(RealCity.prototype);
    Object.assign(second,{id:"owner-home",name:"另城",ownerFactionId:"owner",founderFactionId:"owner",foundedYear:0,captureCount:0,history:[{year:0,type:"founded",title:"建城",newOwnerFactionId:"owner"}],loyalty:80,destroyed:false});
    f.owner.cities.push(second);
    return {...f,user,player,logical,audit,second,RealUser,RealPlayer,RealCity};
  }
  async function zoneFixture() {
    const f=await localFixture();
    const {getCandidateFortifiedGridCells}=await import("./CityZoneSpatial");
    const zone=getCandidateFortifiedGridCells({x:2,y:2},11),zoneKeys=new Set(zone.map(p=>`${p.x},${p.y}`));
    const cells=new Map<string,any>();
    for(let x=0;x<10;x++)for(let y=0;y<10;y++) {
      const cell:any={x:x*32,y:y*32,team:f.owner,city:zoneKeys.has(`${x},${y}`)?f.city:undefined,updateCityDisplay(){}};
      cell.claimForTeam=(team:any)=>{cell.team=team;};cells.set(`${x},${y}`,cell);
    }
    f.city.block=cells.get("2,2");f.city.fortifiedCells=zone.map(p=>cells.get(`${p.x},${p.y}`));
    f.city.calculateMaxDefense=()=>11;f.city.maxDefense=11;
    f.city.claimFortifiedZone=f.RealCity.prototype.claimFortifiedZone;
    game.Core.map={getBlock:(x:number,y:number)=>cells.get(`${x},${y}`)};
    return {...f,cells};
  }
  it("s1真实防御城域外两层受控邻地可响应，中心四格外不伪装成原三格",async()=>{
    const f=await zoneFixture();const unit=f.logical.get("unit-1")!;unit.logicalX=208;unit.logicalY=80;
    const {assessLocalRestorationPopulation:assess}=await import("./LocalRestorationSupport");
    expect(Math.hypot(unit.logicalX-80,unit.logicalY-80)/32).toBe(4);
    expect(assess(f.city)).toMatchObject({nearbyNormal:1,outsideArea:0});
    const next=vi.spyOn(worldRandom,"next").mockReturnValue(.00001);check(f);
    expect(next).toHaveBeenCalledOnce();expect(f.user.team).toBe(f.candidate);expect(f.candidate.users.size).toBe(1);
    expect(f.cells.get("2,2").team).toBe(f.candidate);
    const event=WorldHistory.getEvents().find(e=>e.type==="faction-restored")!;
    expect(event.metadata).toMatchObject({responseRadiusCells:5,responseArea:"CONTROLLED_CITY_ZONE",responseNeighborLayers:2,responseCenterX:80});
  });
  it("s1只读取真实逻辑移动后的城域位置，远处渲染坐标不能替代",async()=>{
    const f=await zoneFixture(),unit=f.logical.get("unit-1")!;
    const {stepLogicalMovement}=await import("./LogicalMovementSystem");const {getLocalRestorationSupporters:get}=await import("./LocalRestorationSupport");
    unit.logicalX=300;unit.logicalY=80;unit.logicalVX=-92;unit.logicalVY=0;
    expect(get(f.city)).toEqual([]);
    stepLogicalMovement({units:[unit],deltaMs:1000,bounds:{minX:0,minY:0,maxX:320,maxY:320},blockSize:32});
    expect(unit.logicalX).toBe(208);expect(get(f.city)).toContain(f.user);expect(f.player.x).toBe(99999);
  });
  it.each(["far","foreign-cell","disconnected","other-city"])("s1 %s 不能借受控邻地代表本城人口",async reason=>{
    const f=await zoneFixture();const unit=f.logical.get("unit-1")!;unit.logicalX=208;unit.logicalY=80;
    if(reason==="far")unit.logicalX=900;
    if(reason==="foreign-cell")f.cells.get("6,2").team=f.founder;
    if(reason==="disconnected")f.cells.get("5,2").team=f.founder;
    if(reason==="other-city")f.cells.get("6,2").city=f.second;
    const {assessLocalRestorationPopulation:assess}=await import("./LocalRestorationSupport");
    expect(assess(f.city)).toMatchObject({users:[],outsideArea:1});
    vi.spyOn(worldRandom,"next").mockReturnValue(.00001);check(f);
    expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(0);
  });
  async function formationFixture() {
    const f=await zoneFixture(); const entries=f.logical.getEntries().map(e=>({...e,user:e.player!.user}));
    const {createLogicalUnitState}=await import("./LogicalUnitState");
    const added=[];
    for(let i=2;i<=3;i++) {
      const player:any=Object.create(f.RealPlayer.prototype);Object.assign(player,{team:f.owner,active:true,children:[],factionRing:{setStrokeStyle(){}},x:80,y:80});
      const user=new f.RealUser(76+i,`真实部员${i}`,f.owner,player,undefined,70,"NORMAL",undefined,{deferRuntime:true,bornMonth:100});
      player.user=user;f.owner.users.add(user);added.push(user);
      entries.push({state:createLogicalUnitState({unitId:`unit-${i}`,factionId:"owner",x:80,y:80,vx:0,vy:0,blockSize:32,radius:16,speed:150,userId:user.id}),player,user});
    }
    f.logical.importState(4,entries as any);
    const {default:military}=await import("../Politics/MilitaryCommandRegistry");
    (military as any).appoint(added[0],"owner",400,["unit-2","unit-1","unit-3"]);
    return {...f,military,commander:added[0]};
  }
  it("s1真实普通编组成员可合法转属，指挥官仍在原国且编组至少保留两人",async()=>{
    const f=await formationFixture();
    const {getLocalRestorationSupporters:get}=await import("./LocalRestorationSupport");
    expect(get(f.city)[0]).toBe(f.user);expect(get(f.city)).not.toContain(f.commander);
    vi.spyOn(worldRandom,"next").mockReturnValue(.00001);check(f);
    expect(f.user.team).toBe(f.candidate);expect(f.military.getFormations()[0]).toMatchObject({status:"ACTIVE",memberUnitIds:["unit-2","unit-3"]});
    expect(f.commander.team).toBe(f.owner);expect(f.owner.users.size).toBe(2);expect(f.candidate.users.size).toBe(1);
  });
  it("s1候选不依赖Set顺序且预览不消耗随机数",async()=>{
    const f=await formationFixture();const {getLocalRestorationSupporters:get}=await import("./LocalRestorationSupport");
    const state=worldRandom.exportState(),before=get(f.city).map(u=>u.id);
    f.owner.users=new Set([...f.owner.users].reverse());
    expect(get(f.city).map(u=>u.id)).toEqual(before);expect(worldRandom.exportState()).toEqual(state);
  });
  it("s1成员转属部分失败时，人口、逻辑单位及原编组成员表同时回退",async()=>{
    const f=await formationFixture(), original=f.user.setTeam;
    vi.spyOn(f.user,"setTeam").mockImplementation(function(this:typeof f.user,team,context){original.call(this,team,context);if(team===f.candidate)throw new Error("failure after transfer");});
    const before=structuredClone(f.military.exportState());
    expect(FactionRegistry.restoreThroughLocalSupport(f.candidate,f.city,480,f.user)).toBe("TRANSFER_FAILED");
    expect(f.user.team).toBe(f.owner);expect(f.logical.get("unit-1")!.factionId).toBe("owner");
    expect(f.military.exportState()).toEqual(before);expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(0);
  });
  it("s1空间与强危机固定窗口的八种子实际业务对照，明确不当作自然长局",async()=>{
    const results=[];
    for(let seed=0;seed<8;seed++) {
      const f=await zoneFixture();f.logical.get("unit-1")!.logicalX=208;
      f.city.loyalty=29;f.city.devastation=100;f.second.loyalty=11;WorldExiles.get("old")!.legitimacy=20;
      // Production city history and real resource state, no manufactured supporter.
      worldRandom.initialize(`s1-controlled-${seed}`);
      for(let month=480;month<540 && f.candidate.status==="EXILED";month+=12) check(f,month);
      const d=f.system.getRestorationDiagnosticSnapshot().localSupport;
      expect(d.eligible).toBeGreaterThan(0);expect(d.draws).toBeLessThanOrEqual(5);
      expect(f.owner.users.size+f.candidate.users.size).toBe(1);
      if(d.successes) {WorldExiles.update(600,f.teams);expect(WorldExiles.getDiagnostics().bySource.LOCAL_RESIDENT.active12).toBe(1);}
      results.push({seed,原三格候选:0,城域人口候选:d.populationCandidates,完整资格:d.eligible,实际draw:d.draws,条件期望:d.expected,实际成功:d.successes,同候选原风险:d.recentOpportunities.at(-1)?.legacyChance,最近实际风险:d.recentOpportunities.at(-1)?.actualChance});
    }
    console.log("s1受控生产年度路径对照（固定忠诚/位置；无完整Core自然战争与人口演化）",JSON.stringify(results));
  });
  it("s1诊断去重与机会日志有界，不把人次冒充不同User",async()=>{
    const f=await localFixture();vi.spyOn(worldRandom,"next").mockReturnValue(.99);
    for(let year=480;year<480+12000;year+=12)check(f,year);
    const d=f.system.getRestorationDiagnosticSnapshot().localSupport;
    expect(d.recentOpportunities.length).toBeLessThanOrEqual(3);expect(d.distinct.users).toBe(1);
    expect(d.nearbyNormal).toBeGreaterThan(1);expect(d.distinct.cities).toBe(2);
    (f.system as any).observeLocal("users",Array.from({length:5000},(_,i)=>`stress-unit-${i}`));
    expect(f.system.getRestorationDiagnosticSnapshot().localSupport).toMatchObject({distinct:{users:4096},distinctOverflow:true});
  });
  it.each(["capital","territory"])("%s 实际转属既有User，不生成人口/残部，记录同组真实城市与复国事件",async basis=>{
    const f=await localFixture(basis); const ruler=DynastyRegistry.getCurrentRuler("old")!;
    const before=structuredClone(DynastyRegistry.get("old")!.houseEpochs), born=ruler.bornYear;
    const next=vi.spyOn(worldRandom,"next").mockReturnValue(.00001);
    const setTeam=vi.spyOn(f.user,"setTeam"); check(f);
    expect(setTeam).toHaveBeenCalledOnce();expect(next).toHaveBeenCalledOnce();
    expect(f.city.ownerFactionId).toBe("old");expect(f.candidate.status).toBe("ACTIVE");
    expect(f.owner.users.size).toBe(0);expect(f.candidate.users.size).toBe(1);expect(f.candidate.users.has(f.user)).toBe(true);
    expect(f.user.team).toBe(f.candidate);expect(f.player.team).toBe(f.candidate);expect(f.logical.get("unit-1")!.factionId).toBe("old");
    expect(f.logical.get("unit-1")!.logicalX).toBe(80); // visual x=99999 was never used, nor was the unit teleported
    expect(WorldRemnants.get("old")).toBeUndefined();expect(WorldExiles.get("old")).toBeUndefined();
    expect(DynastyRegistry.get("old")!.houseEpochs).toEqual(before);expect(DynastyRegistry.getCurrentRuler("old")!.id).toBe(ruler.id);expect(ruler.bornYear).toBe(born);
    const events=WorldHistory.getEvents(), restored=events.filter(e=>e.type==="faction-restored");
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({rulerId:ruler.id,previousOwnerFactionId:"owner",metadata:{restorationSource:"LOCAL_RESIDENT",supporterUserId:77,supporterLogicalUnitId:"unit-1",supporterPopulation:1,remnantPopulation:0,cityLoyalty:0}});
    expect(events.find(e=>e.type==="city-revolt")!.historyGroupId).toBe(restored[0].historyGroupId);
    expect(restored[0].description).toContain("附近居民");expect(restored[0].description).not.toContain("残部响应");
    expect(formatHistoryEventTitle(restored[0],new Map())).toContain("旧地响应复国");
    expect(ruler.chronicle!.notableEventIds).toContain(restored[0].id);
    f.audit.reconcile(480,f.teams); const changes=f.audit.getRecent();
    expect(changes.filter(c=>c.cause==="RESTORATION").map(c=>c.delta).sort()).toEqual([-1,1]);
    expect(f.system.getRestorationDiagnosticSnapshot().localSupport).toMatchObject({eligible:1,draws:1,drawHits:1,successes:1});
    WorldExiles.update(492,f.teams);WorldExiles.update(540,f.teams);
    expect(WorldExiles.getDiagnostics().bySource.LOCAL_RESIDENT).toMatchObject({restorations:1,matured12:1,active12:1,matured60:1,active60:1});
    check(f,492);expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(1);
  });
  it.each(["foreign","distant","ruler","destroyed","dead-unit","missing-unit","mismatched-player","assigned","military-person","dependent","child","no-user"])("%s 不能伪装旧地响应人口",async reason=>{
    const f=await localFixture();const unit=f.logical.get("unit-1")!;
    if(reason==="foreign") unit.factionId="founder";
    if(reason==="distant") {unit.logicalX=99999;unit.logicalY=99999;f.player.x=80;f.player.y=80;}
    if(reason==="ruler") f.user.role="RULER";
    if(reason==="destroyed") (f.user as any).destroyed=true;
    if(reason==="dead-unit") unit.alive=false;
    if(reason==="missing-unit") f.player.logicalUnitId="missing";
    if(reason==="mismatched-player") f.player.user=undefined;
    if(reason==="military-person") f.user.militaryPersonId="person-1";
    if(reason==="dependent") f.user.slaveGroup.npcs.set("child",{} as any);
    if(reason==="child") f.player.parent={} as any;
    if(reason==="no-user") f.owner.users.clear();
    if(reason==="assigned") {const {default:m}=await import("../Politics/MilitaryCommandRegistry");vi.spyOn(m,"getFormations").mockReturnValue([{status:"ACTIVE",memberUnitIds:["unit-1"]}] as any);}
    const next=vi.spyOn(worldRandom,"next").mockReturnValue(.00001);check(f);
    expect(f.city.ownerFactionId).toBe("owner");expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(0);
    expect(f.system.getRestorationDiagnosticSnapshot().localSupport).toMatchObject({eligible:0,noUser:1,draws:0});
    // A legacy founder political draw may still exist, but never a local-response slot.
    expect(next.mock.calls.length).toBeLessThanOrEqual(1);
  });
  it.each(["terminated","no-heir","legitimacy","short-rule","high-loyalty","grace","cooldown","missing-exile","bad-house"])("%s 不放宽历史、政治或城市硬资格",async reason=>{
    const f=await localFixture();
    if(reason==="terminated") {f.candidate.status="EXTINCT";f.candidate.terminationReason="EXTINCT";}
    if(reason==="no-heir") {const d=DynastyRegistry.get("old")!;d.currentRulerId=null;d.heirIds=[];}
    if(reason==="legitimacy") WorldExiles.get("old")!.legitimacy=0;
    if(reason==="short-rule") {f.city.history=f.city.history.filter((e:any)=>e.type!=="capital-relocated");f.city.history[1].year=399;}
    if(reason==="high-loyalty") f.city.loyalty=90;
    if(reason==="grace") f.city.isInCaptureGrace=()=>true;
    if(reason==="cooldown") (f.system as any).cityRebellionYears.city=479;
    if(reason==="missing-exile") WorldExiles.restore("old");
    if(reason==="bad-house") DynastyRegistry.get("old")!.houseEpochs=[];
    vi.spyOn(worldRandom,"next").mockReturnValue(.00001);check(f);
    expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(0);expect(f.user.team).toBe(f.owner);
    expect(f.system.getRestorationDiagnosticSnapshot().localSupport.eligible).toBe(0);
  });
  it("原始建城者的零残部旧都路径只占一个风险槽位",async()=>{
    const f=await localFixture("capital",true);
    f.city.history.splice(1,0,{year:20,type:"capital-relocated",title:"真实正式设都",newOwnerFactionId:"founder",wasCapital:true});
    const next=vi.spyOn(worldRandom,"next").mockReturnValue(.00001); check(f);
    expect(next).toHaveBeenCalledOnce();expect(f.city.ownerFactionId).toBe("founder");expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(1);
  });
  it("转属拒绝或城市拒绝都不留下半份成功、人口或历史",async()=>{
    const f=await localFixture();const before=WorldHistory.exportState();
    const transfer=vi.spyOn(f.user,"setTeam").mockImplementation(()=>{});
    expect(FactionRegistry.restoreThroughLocalSupport(f.candidate,f.city,480,f.user)).toBe("TRANSFER_FAILED");
    expect(f.user.team).toBe(f.owner);expect(f.candidate.users.size).toBe(0);expect(f.city.ownerFactionId).toBe("owner");expect(WorldHistory.exportState()).toEqual(before);
    transfer.mockRestore();vi.spyOn(f.city,"revoltTo").mockReturnValue(false);
    expect(FactionRegistry.restoreThroughLocalSupport(f.candidate,f.city,480,f.user)).toBe("INVALID");expect(f.user.team).toBe(f.owner);expect(WorldHistory.exportState()).toEqual(before);
  });
  it("最后一城后果处理发生在响应者转出之后",async()=>{
    const f=await localFixture();f.owner.cities=[f.city];
    const {default:RealCore}=await vi.importActual<typeof import("../Game/Core")>("../Game/Core");
    const collapse=vi.fn((...args:any[])=>{expect(args[0].users.has(f.user)).toBe(false);return (RealCore.prototype.handleFactionExtinction as any).apply(game.Core,args);});
    game.Core.handleFactionExtinction=collapse;
    vi.spyOn(worldRandom,"next").mockReturnValue(.00001);check(f);
    expect(collapse).toHaveBeenCalledOnce();expect(f.user.team).toBe(f.candidate);expect(f.candidate.users.size).toBe(1);expect(f.owner.status).toBe("EXTINCT");
    expect(DynastyRegistry.getCurrentRuler("owner")).toBeUndefined();
  });
  it("部分转属后抛错可以回退人口、单位归属，城市和历史尚未提交",async()=>{
    const f=await localFixture();const original=f.user.setTeam;
    vi.spyOn(f.user,"setTeam").mockImplementation(function(this:typeof f.user,team,context){
      original.call(this,team,context); if(team===f.candidate) throw new Error("controlled transfer failure");
    });
    const history=WorldHistory.exportState();
    expect(FactionRegistry.restoreThroughLocalSupport(f.candidate,f.city,480,f.user)).toBe("TRANSFER_FAILED");
    expect(f.owner.users.has(f.user)).toBe(true);expect(f.candidate.users.size).toBe(0);
    expect(f.logical.get("unit-1")!.factionId).toBe("owner");expect(f.player.team).toBe(f.owner);
    expect(f.city.ownerFactionId).toBe("owner");expect(WorldHistory.exportState()).toEqual(history);
    expect(f.audit.getRecent().filter(r=>r.delta!==0)).toEqual([]);
  });
  it("当月前君到寿而有真实合法继承人时，通过既有死亡继位后复国",async()=>{
    const f=await localFixture();const d=DynastyRegistry.get("old")!,predecessor=DynastyRegistry.getCurrentRuler("old")!;
    const heir=d.rulers.find(r=>d.heirIds.includes(r.id))!; expect(heir).toBeDefined();
    predecessor.naturalDeathYear=480; heir.naturalDeathYear=10000;
    vi.spyOn(worldRandom,"next").mockReturnValue(.00001); check(f);
    expect(predecessor.status).toBe("dead");expect(predecessor.deathMonth).toBe(480);
    const event=WorldHistory.getEvents().find(e=>e.type==="faction-restored")!;
    expect(event).toBeDefined();expect(event.rulerId).not.toBe(predecessor.id);
    expect(event.rulerId).toBe(DynastyRegistry.getCurrentRuler("old")!.id);
    expect(DynastyRegistry.getCurrentRuler("old")!.status).toBe("ruling");
  });
  it("无其他合法继承人的当月真实死亡阻断响应",async()=>{
    const f=await localFixture();const d=DynastyRegistry.get("old")!;d.heirIds=[];DynastyRegistry.getCurrentRuler("old")!.naturalDeathYear=480;
    vi.spyOn(worldRandom,"next").mockReturnValue(.00001);check(f);
    expect(f.system.getRestorationDiagnosticSnapshot().localSupport).toMatchObject({eligible:0,claimantBlocked:1});
    expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(0);expect(f.user.team).toBe(f.owner);
  });
  it("真实战乱窗口共用3%上限，不在安定城市开启额外抽签",async()=>{
    const f=await localFixture();f.city.loyalty=33;f.city.devastation=94;f.second.loyalty=30;
    const next=vi.spyOn(worldRandom,"next").mockReturnValue(.99);check(f);
    const d=f.system.getRestorationDiagnosticSnapshot().localSupport;
    expect(d.eligible).toBe(1);expect(d.expected).toBeGreaterThan(0);expect(d.expected).toBeLessThanOrEqual(.03);expect(next).toHaveBeenCalledOnce();
  });
  it("同城两个旧国共用一次draw与最大风险，命中后仍只有一次复国",async()=>{
    const f=await localFixture();
    const second={...f.candidate,name:"old2",displayName:"另一旧国",users:new Set(),cities:[],restorationYears:[]};
    Object.setPrototypeOf(second,Object.getPrototypeOf(f.candidate));
    f.teams.push(second);DynastyRegistry.initializeFaction(second,0);DynastyRegistry.markExiled(second,600);
    DynastyRegistry.get(second.name)!.rulers.forEach(r=>r.naturalDeathYear=10000);
    WorldExiles.start(second,600,0);WorldExiles.get("old2")!.legitimacy=80;
    f.city.history=[{year:0,type:"founded",title:"建城",newOwnerFactionId:"founder"},
      {year:10,type:"captured",title:"易手",previousOwnerFactionId:"founder",newOwnerFactionId:"old"},
      {year:20,type:"capital-relocated",title:"设都",newOwnerFactionId:"old",wasCapital:true},
      {year:200,type:"captured",title:"易手",previousOwnerFactionId:"old",newOwnerFactionId:"old2"},
      {year:220,type:"capital-relocated",title:"设都",newOwnerFactionId:"old2",wasCapital:true},
      {year:600,type:"captured",title:"易手",previousOwnerFactionId:"old2",newOwnerFactionId:"owner"}];f.city.captureCount=3;f.city.lastCapturedYear=600;
    const next=vi.spyOn(worldRandom,"next").mockReturnValue(.99);check(f,720);
    const d=f.system.getRestorationDiagnosticSnapshot().localSupport;
    expect(next).toHaveBeenCalledOnce();expect(d).toMatchObject({eligible:2,draws:1});expect(d.expected).toBeLessThanOrEqual(.09);
    next.mockReturnValue(.00001);check(f,732);expect(next).toHaveBeenCalledTimes(2);expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(1);
  });
  it("实际WorldEventSystem月度入口能产生旧地响应，无额外响应抽签调度",async()=>{
    const f=await localFixture();
    f.system.importState({...f.system.exportState(),nextEventMonth:10000},468);
    vi.spyOn(worldRandom,"next").mockReturnValue(.00001);
    f.system.update(480,f.teams,3);
    expect(f.system.getRestorationDiagnosticSnapshot().localSupport.successes).toBe(1);
    expect(WorldHistory.getEventTypeCount("faction-restored")).toBe(1);
  });
  it("miss、诊断与读档重置不改变随机流；旧地响应随原年度调度而运行",async()=>{
    const f=await localFixture();const next=vi.spyOn(worldRandom,"next").mockReturnValue(.99);
    // The production annual entry point, not a separate response simulator.
    check(f);const state=f.system.exportState(),rng=worldRandom.exportState();
    expect(f.system.getRestorationDiagnosticSnapshot().localSupport).toMatchObject({eligible:1,draws:1,drawHits:0,successes:0});
    const summary=f.system.getRestorationDiagnostics();expect(summary).toContain("旧地真实响应");expect(worldRandom.exportState()).toEqual(rng);expect(next).toHaveBeenCalledOnce();
    check(f,480);expect(next).toHaveBeenCalledOnce();
    f.system.importState(state,480);expect(f.system.getRestorationDiagnosticSnapshot().localSupport.draws).toBe(0);
  });
});
