import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const { game } = vi.hoisted(() => ({ game: { Core: undefined as any, BlockSize: 32 } }));
vi.mock("../Game/Game", () => ({ default: game }));
vi.mock("../Components/Team", () => ({ default: class {} }));
vi.mock("../Components/Block", () => ({ default: class {} }));
vi.mock("../Components/Player", () => ({ default: class {} }));
vi.mock("../Components/User", () => ({ default: class {} }));
vi.mock("../Components/Npc", () => ({ default: class {} }));
vi.mock("../Components/Map", () => ({ default: class {} }));
vi.mock("../Components/MessageToast", () => ({ MessageToast: class {} }));
vi.mock("../Card/Controller", () => ({ default: class {} }));
vi.mock("../Components/City", () => ({ getFactionStability: (team: any) => team.stability }));
import { store } from "../store";
import { setWorldStarted } from "../store/rootSlice";
import Core from "../Game/Core";
import DynastyRegistry, { type Ruler } from "./Dynasty";
import { createRulerChronicle } from "./RulerChronicle";
import worldRandom from "../Simulation/WorldRandom";
import WorldHistory from "../History/WorldHistory";
import WorldExiles from "../Simulation/WorldExiles";
import WorldRemnants from "../Simulation/WorldRemnants";
import { hasRecordedRulerDeath } from "./RulerLifeState";
import { evaluatePosthumousNames, finalizeRulerPosthumousNames, getPosthumousLabelLines } from "./PosthumousRules";
import { deriveRulerAssessment, composeHistorianVoice } from "./RulerHistoriography";
import { formatRulerAge } from "../UI/Components/FactionDetails/RoyalPresentation";
import { deriveWorldRecords } from "../History/WorldRecords";

function fixture(status: "ACTIVE" | "EXILED" = "ACTIVE", heirs = false) {
  const ruler: Ruler = { id: "r1", houseName: "张氏", givenName: "平", bornYear: -360,
    accessionYear: 0, naturalDeathYear: 600, plannedEndYear: 600, reignOrdinal: 1, status: status === "ACTIVE" ? "ruling" : "exiled",
    chronicle: createRulerChronicle({ month: 0, population: 10, territoryShare: .2, cityCount: 1, stability: 50 }) };
  const heir: Ruler = { id: "h1", houseName: "张氏", givenName: "继", bornYear: -120, parentId: "r1", naturalDeathYear: 600, status: "heir", politicalStartYear: 0 };
  DynastyRegistry.importState({ sequence: 2, dynasties: [{ factionId: "张", houseName: "张氏", currentRulerId: "r1", heirIds: heirs ? ["h1"] : [],
    designatedHeirId: heirs ? "h1" : undefined, designatedSinceMonth: heirs ? 0 : undefined,
    houseEpochs: [{ houseName: "张氏", startMonth: 0, foundingRulerId: "r1", startReason: "FOUNDING" }], rulers: (heirs ? [ruler, heir] : [ruler]).map(r => ({ ...r, chronicle: r.chronicle })) }] });
  const team: any = { name: "张", displayName: "张", status, identityStage: "STATE", sovereigntyRank: "KING", factionType: "KINGDOM",
    houseName: "张氏", firstFoundedYear: 0, getCumulativeActiveYears: () => 120, stateFoundedMonth: 0, nameHistory: [], sovereigntyHistory: [], origin: {}, stability: 80,
    users: new Set(), cities: [], blocks: { children: { size: 0 } }, removeRulerUnit: vi.fn(),
    markExtinct(month: number) { this.status = "EXTINCT"; this.extinctionYear = month; },
    makeUser: vi.fn(), ensureRulerUnit: vi.fn(), chooseCapitalCandidate: () => undefined, removeCity(city: any) { this.cities = this.cities.filter((c: any) => c !== city); } };
  game.Core = { teams: [team], totalCells: 100, unregisterCityInteraction() {}, map: { blocks: [] } };
  return { team, ruler: DynastyRegistry.getCurrentRuler("张")!, heir: DynastyRegistry.get("张")!.rulers[1] };
}
beforeEach(() => { DynastyRegistry.reset(); WorldHistory.reset(); WorldExiles.reset(); WorldRemnants.reset(); worldRandom.initialize("terminal-v13"); });
afterEach(() => { vi.restoreAllMocks(); });

describe("authoritative V13 political termination and actual death", () => {
  it("废立真实在位君主并在预定月份记录其后续自然死亡", () => {
    const { team, ruler, heir } = fixture("ACTIVE", true);
    team.cities = [{ id: "capital", name: "都" }];
    team.stability = 30;
    heir.bornYear = -240;
    ruler.naturalDeathYear = 24;
    const dynasty = DynastyRegistry.get(team.name)!;
    const originalHouse = JSON.stringify(dynasty.houseEpochs);
    const activeUnit = (rulerId: string): any => ({ rulerId, role: "RULER", player: { role: "RULER", rulerId,
      setRole(role: string, id?: string) { this.role = role; this.rulerId = id ?? rulerId; } } });
    team.users = new Set();
    vi.spyOn(DynastyRegistry, "ensureRulerUnit").mockImplementation(() => {
      const current = DynastyRegistry.getCurrentRuler(team.name);
      if (!current) return;
      if (team.rulerUser?.rulerId === current.id) return;
      const user = activeUnit(current.id);
      team.rulerUser = user;
      team.users.add(user);
    });
    WorldHistory.addCapitalFallen(1, "魏", team.name, team.name, "旧都", "capital", true, 10, undefined, undefined, "siege-1");
    const evidence = WorldHistory.getEvents().find(event => event.type === "capital-fallen")!;
    worldRandom.initialize("deposition-state-transition");
    const draw = vi.spyOn(worldRandom, "next").mockReturnValue(0);
    DynastyRegistry.update(12, [team]);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(ruler).toMatchObject({ status: "deposed", endYear: 12, politicalEndYear: 12, endReason: "被废" });
    expect(ruler.deathMonth).toBeUndefined(); expect(ruler.deathReason).toBeUndefined();
    expect(ruler.templeName).toBeUndefined(); expect(ruler.posthumousEpithet).toBeUndefined();
    expect(heir).toMatchObject({ status: "ruling", accessionYear: 12, accessionCause: "DEPOSITION", predecessorId: ruler.id });
    expect(dynasty.currentRulerId).toBe(heir.id); expect(dynasty.heirIds).not.toContain(ruler.id);
    expect(JSON.stringify(dynasty.houseEpochs)).toBe(originalHouse);
    expect(team.rulerUser?.rulerId).toBe(heir.id);
    const coup = WorldHistory.getEvents().find(event => event.type === "ruler-deposed")!;
    expect(coup.metadata).toMatchObject({ previousRulerId: ruler.id, nextRulerId: heir.id, crisisEvidenceEventIds: evidence.id,
      relation: "DIRECT_CHILD", houseChanged: 0, nameChanged: 0, colorChanged: 0 });
    expect(ruler.chronicle?.notableEventIds).toContain(coup.id); expect(heir.chronicle?.notableEventIds).toContain(coup.id);
    DynastyRegistry.update(13, [team]);
    expect(ruler.status).toBe("deposed"); expect(dynasty.heirIds).not.toContain(ruler.id);
    DynastyRegistry.update(24, [team]);
    expect(ruler).toMatchObject({ status: "dead", endYear: 12, endReason: "被废", deathMonth: 24, deathReason: "自然去世" });
    expect(ruler.chronicle?.endSnapshot?.month).toBe(12); expect(ruler.chronicle?.deathCause).toBe("自然去世");
    expect(WorldHistory.getEvents().filter(event => event.type === "ruler-deposed")).toHaveLength(1);
    expect(WorldHistory.getEvents().some(event => event.type === "ruler-died" && event.metadata?.rulerId === ruler.id && event.year === 24)).toBe(true);
  });

  it("同一位宗室先废立继位、再被废，随后按预定月份自然死亡", () => {
    const { team, ruler: predecessor, heir: deposer } = fixture("ACTIVE", true);
    team.cities = [{ id: "capital", name: "都" }]; team.stability = 30;
    deposer.bornYear = -240; deposer.naturalDeathYear = 96;
    predecessor.naturalDeathYear = 600;
    const dynasty = DynastyRegistry.get(team.name)!;
    const finalRuler: Ruler = { id: "h2", houseName: "张氏", givenName: "终", bornYear: -120,
      parentId: deposer.id, naturalDeathYear: 600, status: "kin" };
    dynasty.rulers.push(finalRuler);
    team.users = new Set();
    vi.spyOn(DynastyRegistry, "ensureRulerUnit").mockImplementation(() => {
      const current = DynastyRegistry.getCurrentRuler(team.name);
      if (!current) return;
      const user = { rulerId: current.id, role: "RULER", player: { role: "RULER", rulerId: current.id,
        setRole(role: string, id?: string) { this.role = role; this.rulerId = id ?? current.id; } } } as any;
      team.rulerUser = user; team.users.add(user);
    });
    WorldHistory.addCapitalFallen(1, "魏", team.name, team.name, "旧都", "capital", true, 10, undefined, undefined, "siege-1");
    worldRandom.initialize("double-deposition-lifecycle");
    const draw = vi.spyOn(worldRandom, "next").mockReturnValue(0);
    DynastyRegistry.update(12, [team]);
    expect(DynastyRegistry.getCurrentRuler(team.name)?.id).toBe(deposer.id);
    expect(deposer.accessionCause).toBe("DEPOSITION");
    WorldHistory.addCapitalFallen(61, "魏", team.name, team.name, "新都", "capital", true, 10, undefined, undefined, "siege-2");
    for (let month = 13; month <= 72; month += 1) DynastyRegistry.update(month, [team]);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(predecessor.status).toBe("deposed");
    expect(deposer).toMatchObject({ status: "deposed", accessionCause: "DEPOSITION", endYear: 72, endReason: "被废" });
    expect(deposer.deathMonth).toBeUndefined();
    expect(finalRuler).toMatchObject({ status: "ruling", accessionCause: "DEPOSITION", accessionYear: 72, predecessorId: deposer.id });
    expect(dynasty.currentRulerId).toBe(finalRuler.id);
    expect(dynasty.heirIds).not.toContain(predecessor.id);
    expect(dynasty.heirIds).not.toContain(deposer.id);
    const coups = WorldHistory.getEvents().filter(event => event.type === "ruler-deposed");
    expect(coups).toHaveLength(2);
    expect(new Set(coups.map(event => event.id)).size).toBe(2);
    DynastyRegistry.update(96, [team]);
    expect(deposer).toMatchObject({ status: "dead", endYear: 72, endReason: "被废", deathMonth: 96, deathReason: "自然去世" });
    expect(WorldHistory.getEvents().filter(event => event.type === "ruler-died" && event.metadata?.rulerId === deposer.id)).toHaveLength(1);
    expect(JSON.stringify(dynasty.houseEpochs)).toBe(JSON.stringify([{ houseName: "张氏", startMonth: 0, foundingRulerId: "r1", startReason: "FOUNDING" }]));
  });

  it("抽签失败没有成功事件，并将失败纳入冷却", () => {
    const { team, ruler, heir } = fixture("ACTIVE", true);
    team.cities = [{ id: "capital", name: "都" }]; team.stability = 30; heir.bornYear = -240;
    const users = team.users = new Set<any>();
    vi.spyOn(DynastyRegistry, "ensureRulerUnit").mockImplementation(() => undefined);
    WorldHistory.addCapitalFallen(1, "魏", team.name, team.name, "旧都", "capital", true, 10, undefined, undefined, "siege-1");
    worldRandom.initialize("deposition-failed-roll");
    const draw = vi.spyOn(worldRandom, "next").mockReturnValue(0.99);
    DynastyRegistry.update(12, [team]);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(DynastyRegistry.getCurrentRuler(team.name)?.id).toBe(ruler.id);
    expect(ruler.status).toBe("ruling"); expect(heir.status).toBe("heir");
    expect(WorldHistory.getEvents().some(event => event.type === "ruler-deposed")).toBe(false);
    expect(DynastyRegistry.get(team.name)?.lastDepositionAttemptMonth).toBe(12);
    DynastyRegistry.update(24, [team]);
    expect(draw).toHaveBeenCalledTimes(1); expect(users.size).toBe(0);
    expect(DynastyRegistry.getInReignDepositionDiagnostics(24)).toMatchObject({
      drawAttempts: 1, failures: 1, successes: 0, cooldownBlocked: 1, expectedSuccesses: 0.005,
    });
  });

  it("PRECHECK failure leaves the live Core saveable; post-teardown hydration remains blocked", () => {
    const core: Core = Object.assign(Object.create(Core.prototype), { simulator: { exportState: () => ({ started: true }) },
      backgroundProgression: { isCatchingUp: () => false }, snapshotBoundaryRequest: { getDiagnostics: () => ({ status: "idle" }) } });
    const started = store.getState().root.worldStarted;
    store.dispatch(setWorldStarted(true));
    try {
      core.setHydrationStage("PRECHECK"); expect(core.getDesktopSaveBlockReason()).toBe("HYDRATION");
      core.setHydrationStage("PRECHECK_FAILED"); expect(core.getDesktopSaveBlockReason()).toBeUndefined();
      core.setHydrationStage("HYDRATE_UNITS"); expect(core.getDesktopSaveBlockReason()).toBe("HYDRATION");
    } finally { store.dispatch(setWorldStarted(started)); }
  });
  it("in-state natural succession retains the actual death and legitimate successor reproducibly", () => {
    const run = () => {
      WorldHistory.reset(); worldRandom.initialize("natural-v13");
      const { team, ruler } = fixture("ACTIVE", true); team.cities = [{ id: "capital", name: "都" }];
      ruler.naturalDeathYear = 120;
      DynastyRegistry.update(120, [team]);
      expect(ruler).toMatchObject({ status: "dead", deathMonth: 120, deathReason: "去世", politicalEndYear: 120 });
      expect(DynastyRegistry.getCurrentRuler(team.name)?.id).toBe("h1");
      return JSON.stringify({ dynasty: DynastyRegistry.exportState(), history: WorldHistory.exportState(), rng: worldRandom.exportState() });
    };
    expect(run()).toBe(run());
  });
  it.each(["ACTIVE", "EXILED"] as const)("closes %s office without a death, posthumous title, history or RNG draw; repeated end is immutable", status => {
    const { team, ruler, heir } = fixture(status, true);
    const history = WorldHistory.exportState(), rng = worldRandom.exportState(), family = heir.parentId;
    team.markExtinct(120); DynastyRegistry.markExtinct(team, 120);
    expect(ruler).toMatchObject({ status: "politically-ended", endYear: 120, politicalEndYear: 120, endReason: "政治终结" });
    expect(ruler.deathMonth).toBeUndefined(); expect(ruler.deathReason).toBeUndefined(); expect(ruler.chronicle?.deathCause).toBeUndefined();
    expect(ruler.chronicle?.endSnapshot).toMatchObject({ month: 120, population: 0, cityCount: 0 });
    expect(DynastyRegistry.get("张")).toMatchObject({ currentRulerId: null, heirIds: [], designatedHeirId: undefined });
    expect(heir).toMatchObject({ status: "kin", parentId: family }); expect(DynastyRegistry.hasClaimant("张")).toBe(false);
    expect(evaluatePosthumousNames(ruler, [ruler, heir], team, 120)).toMatchObject({ score: 0, reasons: [] });
    finalizeRulerPosthumousNames(ruler, [ruler, heir], team, 120); expect(getPosthumousLabelLines(ruler, team, 120)).toEqual([]);
    expect(formatRulerAge(ruler.status, 40)).toBe("政治任期终结时40岁");
    const ended = JSON.stringify(DynastyRegistry.exportState());
    DynastyRegistry.markExtinct(team, 130); DynastyRegistry.update(700, [team]); DynastyRegistry.markRestored(team, 700, "故城");
    expect(JSON.stringify(DynastyRegistry.exportState())).toBe(ended); expect(WorldHistory.exportState()).toEqual(history); expect(worldRandom.exportState()).toEqual(rng);
  });
  it("closes an office with no chronicle without fabricating one; missing current record is explicit", () => {
    const { team, ruler } = fixture(); ruler.chronicle = undefined;
    DynastyRegistry.markExtinct(team, 12); expect(ruler.status).toBe("politically-ended"); expect(ruler.chronicle).toBeUndefined();
    DynastyRegistry.get("张")!.currentRulerId = "missing";
    expect(() => DynastyRegistry.markExtinct(team, 13)).toThrow(/Missing current ruler record/);
  });
  it.each(["natural", "combat", "captured"] as const)("preserves real %s death before subsequent extinction", reason => {
    const { team, ruler } = fixture("EXILED");
    if (reason === "natural") { ruler.naturalDeathYear = 120; DynastyRegistry.update(120, [team]); }
    if (reason === "combat") { team.capitalCity = { underSiege: true }; team.stability = 25; DynastyRegistry.handleRulerCombatDeath(team, ruler.id, 120); }
    if (reason === "captured") DynastyRegistry.resolveCapturedRuler(team, { name: "秦" } as any, 120);
    const deathReason = reason === "combat" ? "战死" : reason === "captured" ? "被俘处死" : "去世";
    expect(ruler).toMatchObject({ status: "dead", endYear: 120, politicalEndYear: 120, deathMonth: 120, deathReason });
    expect(ruler.chronicle?.deathCause).toBe(deathReason); expect(hasRecordedRulerDeath(ruler)).toBe(true);
    const record = JSON.stringify(ruler), history = WorldHistory.exportState();
    DynastyRegistry.get("张")!.currentRulerId = ruler.id; // Defensive repeated caller with stale pointer.
    DynastyRegistry.markExtinct(team, 150); DynastyRegistry.markExtinct(team, 160);
    expect(JSON.stringify(ruler)).toBe(record); expect(WorldHistory.exportState()).toEqual(history);
    expect(formatRulerAge(ruler.status, 40)).toBe("享年40岁");
  });
  it("月度双零流亡终结保留已经实际死亡的末君，读取不提前终结", () => {
    const { team, ruler } = fixture("EXILED", true); ruler.naturalDeathYear = 120;
    DynastyRegistry.update(120, [team]);
    const record = JSON.stringify(ruler);
    WorldExiles.importState([{ factionId: team.name, startedMonth: 0, heirIds: [], remnantPopulation: 0, legitimacy: 0, lastLegitimacyMonth: 120, lastRemnantDecayMonth: 120 }]);
    expect(team.status).toBe("EXILED"); expect(WorldExiles.getDiagnostics().politicalEnds).toBe(0);
    WorldExiles.update(121, [team]); WorldExiles.update(122, [team]);
    expect(team.status).toBe("EXTINCT"); expect(JSON.stringify(ruler)).toBe(record);
    expect(WorldExiles.getDiagnostics().politicalEnds).toBe(1);
  });
  it("records an unenthroned candidate's natural death without accession or posthumous titles", () => {
    const { team, heir } = fixture("EXILED", true); heir.naturalDeathYear = 120;
    DynastyRegistry.update(120, [team]);
    expect(heir).toMatchObject({ status: "dead", deathMonth: 120, deathReason: "自然去世", endYear: 120 });
    expect(heir.accessionYear).toBeUndefined(); expect(heir.chronicle).toBeUndefined(); expect(heir.templeName).toBeUndefined();
    expect(DynastyRegistry.get("张")!.heirIds).not.toContain(heir.id);
  });
  it.each(["STATE", "PROVISIONAL"])("actual Core last-city collapse (%s) does not invent the ruler's death", identityStage => {
    const { team, ruler } = fixture(); team.identityStage = identityStage;
    const rng = worldRandom.exportState();
    const core = Object.create(Core.prototype); Object.defineProperty(core, "totalCells", { value: 100 });
    core.handleFactionExtinction(team, { name: "秦", users: new Set(), blocks: { children: { size: 50 } } } as any,
      { id: "last", name: "故城", isCapital: true, founderFactionId: team.name } as any, 120);
    expect(team.status).toBe("EXTINCT"); expect(ruler.status).toBe("politically-ended"); expect(ruler.deathMonth).toBeUndefined();
    expect(worldRandom.exportState()).toEqual(rng);
    expect(WorldHistory.getEvents().some(e => e.type === (identityStage === "STATE" ? "faction-extinct" : "faction-dissolved"))).toBe(true);
  });
  it("actual last-capital destruction closes politics but not life", async () => {
    const { team, ruler } = fixture();
    const { default: City } = await vi.importActual<typeof import("../Components/City")>("../Components/City");
    const city: any = Object.assign(Object.create(City.prototype), { id: "last", name: "故都", ownerFactionId: team.name, founderFactionId: team.name,
      foundedYear: 0, block: { x: 0, y: 0 }, isCapital: true, devastation: 100, isIndestructible: false, destroyed: false,
      captureCount: 0, history: [], fortifiedCells: [], historicalOwners: [team.name] });
    team.cities = [city]; game.Core.teams.push({ name: "秦", cities: Array.from({ length: 6 }, (_, i) => ({ id: `c${i}` })) });
    vi.spyOn(city, "refreshZoneVisual").mockImplementation(() => {});
    expect(city.destroyPermanently(120)).toBe(true); expect(team.status).toBe("EXTINCT");
    expect(ruler.status).toBe("politically-ended"); expect(ruler.deathMonth).toBeUndefined();
  });
  it("exile succession exhaustion emits one extinction and no extra death", () => {
    const { team } = fixture("EXILED"); DynastyRegistry.get("张")!.currentRulerId = null;
    WorldExiles.importState([{ factionId: team.name, startedMonth: 0, heirIds: [], remnantPopulation: 0, legitimacy: 0, lastLegitimacyMonth: 120, lastRemnantDecayMonth: 120 }]);
    WorldExiles.update(120, [team]); WorldExiles.update(121, [team]);
    expect(team.status).toBe("EXTINCT"); expect(WorldHistory.getEvents().filter(e => e.type === "faction-extinct")).toHaveLength(1);
    expect(DynastyRegistry.get("张")!.rulers[0].deathMonth).toBeUndefined();
    expect(DynastyRegistry.get("张")!.rulers[0].status).toBe("politically-ended");
  });
  it.each(["markMerged", "markSubmitted"] as const)("%s retains retirement and family without death or RNG", method => {
    const { team, ruler, heir } = fixture("ACTIVE", true), rng = worldRandom.exportState();
    DynastyRegistry[method](team, 120); const snapshot = JSON.stringify(DynastyRegistry.exportState()); DynastyRegistry[method](team, 130);
    expect(JSON.stringify(DynastyRegistry.exportState())).toBe(snapshot); expect(ruler.status).toBe("abdicated");
    expect(ruler.deathMonth).toBeUndefined(); expect(heir).toMatchObject({ status: "kin", parentId: "r1" });
    expect(formatRulerAge(ruler.status, 40)).toBe("退位时40岁"); expect(worldRandom.exportState()).toEqual(rng);
  });
  it("unknown life assessment uses its own tenure and cannot win longest life", () => {
    const { team, ruler } = fixture("EXILED"); DynastyRegistry.markExtinct(team, 120);
    const assessment = deriveRulerAssessment({ ruler, dynasty: DynastyRegistry.get("张")!, faction: team, events: [], worldMonth: 1200 });
    expect(assessment.evidence.reignMonths).toBe(120);
    expect(assessment.lines.join(" ")).not.toMatch(/身后|一生|卒于|去世/);
    expect(composeHistorianVoice(assessment.evidence)).not.toMatch(/身后|一生|卒于|去世/);
    const records = deriveWorldRecords([{ factionId: team.name, rulers: [ruler] }] as any, [team], [], [], 1200);
    expect(records.some(e => e.id === "longest-life")).toBe(false);
  });
});
