import { afterEach, describe, expect, it, vi } from "vitest";
const { game } = vi.hoisted(() => ({ game: { Core: {} as any, BlockSize: 32 } }));
vi.mock("../Game/Game", () => ({ default: game }));
vi.mock("../Components/Team", () => ({ default: class {} }));
vi.mock("../Components/Block", () => ({ default: class {} }));
vi.mock("../Components/Player", () => ({ default: class {} }));
vi.mock("../Components/User", () => ({ default: class {} }));
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

async function fixture(basis = "capital", founderPath = false) {
  vi.stubGlobal("Phaser", { Math: { Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)) } });
  const { default: City } = await vi.importActual<typeof import("../Components/City")>("../Components/City");
  const { default: Team } = await vi.importActual<typeof import("../Components/Team")>("../Components/Team");
  WorldHistory.reset(); DynastyRegistry.reset(); WorldExiles.reset(); WorldRemnants.reset(); FactionRegistry.reset();
  worldRandom.initialize("historical-restoration-execution");
  const teams = ["founder", "old", "owner"].map(name => ({ name, displayName: name, houseName: "宋氏", nameHistory: [{ name, startMonth: 0 }],
    status: "ACTIVE", factionType: "KINGDOM", identityStage: "STATE", sovereigntyRank: "KING", stateFoundedMonth: 0,
    firstFoundedYear: 0, cumulativeActiveYears: 0, currentActiveSinceYear: 0, restorationYears: [], origin: { type: "INITIAL", foundedMonth: 0 },
    cities: [] as any[], users: new Set(), blocks: { children: { size: 1, entries: [] } }, removeRulerUnit() {},
    markActive: Team.prototype.markActive, addCity(c: any) { if (!this.cities.includes(c)) this.cities.push(c); }, removeCity(c: any) { this.cities = this.cities.filter((v: any) => v !== c); },
    setCapitalCity(c: any, month: number) { c.setCapital(true, month); },
  } as any));
  const [founder, old, owner] = teams;
  game.Core = { teams, totalCells: 3, handleFactionExtinction() {}, simulator: { year: 480 }, map: {} };
  vi.spyOn(DynastyRegistry, "ensureRulerUnit").mockImplementation(() => undefined);
  teams.forEach(team => {
    DynastyRegistry.initializeFaction(team, 0);
    DynastyRegistry.get(team.name)!.rulers.forEach(ruler => { ruler.naturalDeathYear = 10000; ruler.plannedEndYear = 10000; });
  });
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
  it("生产资源检查仍按45%抽签，归零只计首次，保存字段与随机流不被诊断改变",async()=>{
    const f=await fixture();
    WorldExiles.reset();WorldRemnants.setPopulation("old",1,400);
    f.candidate.cumulativeActiveYears=400;f.candidate.currentActiveSinceYear=0;
    WorldExiles.start(f.candidate,400,1);WorldExiles.get("old")!.legitimacy=80;
    WorldHistory.addFactionExiled(400,"old","真实流亡君主",1);
    const next=vi.spyOn(worldRandom,"next").mockReturnValue(.44);
    WorldExiles.update(418,[f.candidate]);
    expect(next).toHaveBeenCalledOnce();
    expect(WorldRemnants.get("old")).toBeUndefined();
    expect(WorldExiles.getDiagnostics()).toMatchObject({newExiles:1,resourceChecks:1,remnantChecks:1,remnantHits:1,remnantFirstZero:1});
    expect(WorldExiles.getResourceSamples()[0]).toMatchObject({initialRemnants:1,tenure:{complete:true,stateTenureMonths:400,currentHouseTenureMonths:400}});
    const before=worldRandom.exportState(), canonical=WorldExiles.exportState();
    expect(WorldExiles.getResourceComparisonSummary()).toContain("生产仍a=0");
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
