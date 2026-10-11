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
  teams.forEach(team => DynastyRegistry.initializeFaction(team, 0));
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
