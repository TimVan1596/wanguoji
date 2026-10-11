import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { game } = vi.hoisted(() => ({ game: { Core: { teams: [] as any[], totalCells: 7 } } }));
vi.mock("../Game/Game", () => ({ default: game }));
vi.mock("../Components/Team", () => ({ default: {} }));
vi.mock("../Components/Block", () => ({ default: {} }));
vi.mock("../Components/Player", () => ({ default: class {} }));
vi.mock("../Components/User", () => ({ default: class {} }));
vi.mock("../Components/Farms", () => ({ default: class { exportState() { return {}; } } }));
vi.mock("../Components/City", () => ({ getFactionStability: (team: any) => team.stability }));
import DynastyRegistry, { type Ruler } from "./Dynasty";
import WorldHistory from "../History/WorldHistory";
import worldRandom from "../Simulation/WorldRandom";
import FactionEffects from "../Simulation/FactionEffects";
import { planInitialRoyalHousehold } from "./InitialRoyalHousehold";
import { getRecordedKinRelation, selectRecordedDynasticSuccessor, buildPoliticalGenealogy } from "./DynasticCandidateRules";
import { validateDynastyInvariants } from "./DynastyInvariant";
import { deriveGenealogyNodePresentations } from "../UI/Components/FactionDetails/GenealogyNodePresentation";
import { changeFactionColor } from "../Simulation/FactionColorHistory";

function teams() { return Array.from({ length: 7 }, (_, i): any => ({ name: `initial-${i}`, displayName: `国${i}`, houseName: `姓${i}氏`,
  color: i + 1, colorHistory: [{ color: i + 1, startMonth: 0, reason: "FOUNDING" }], nameHistory: [{ name: `国${i}`, startMonth: 0 }],
  sovereigntyHistory: [{ rank: "KING", startMonth: 0 }], origin: { type: "INITIAL", foundedMonth: 0 }, status: "ACTIVE", identityStage: "STATE",
  sovereigntyRank: "KING", factionType: "KINGDOM", stateFoundedMonth: 0, stability: 40,
  cities: [{ name: `城${i}` }], users: new Set(), blocks: { children: { size: 1 } }, removeRulerUnit() {},
  setRegimeColor(color: number, month: number) { changeFactionColor(this, color, month); } })); }
function run(seed: string, modern = true, months = 0) {
  DynastyRegistry.reset(); WorldHistory.reset(); FactionEffects.reset(); worldRandom.initialize(seed);
  const ts = teams(); game.Core.teams = ts;
  ts.forEach(t => DynastyRegistry.initializeFaction(t, 0, modern));
  const initial = DynastyRegistry.exportState();
  for (let m = 1; m <= months; m++) DynastyRegistry.update(m, ts);
  const events = WorldHistory.getEvents();
  return { initial, final: DynastyRegistry.exportState(), rng: worldRandom.exportState(),
    early: { naturalHouseChanges: DynastyRegistry.getAll().flatMap(d => d.houseEpochs ?? []).filter(p => p.startReason === "NATURAL_HOUSE_SUCCESSION").length,
      usurpations: events.filter(e => e.type === "dynasty-usurped").length,
      crises: events.filter(e => e.type === "ruler-succession" && e.metadata?.effectType === "SUCCESSION_CRISIS").length } };
}
beforeEach(() => { vi.spyOn(DynastyRegistry, "ensureRulerUnit").mockImplementation(() => undefined); });
afterEach(() => { vi.restoreAllMocks(); DynastyRegistry.reset(); WorldHistory.reset(); FactionEffects.reset(); });
describe("bounded age-valid initial seven-state households", () => {
  it.each([18, 22, 30, 35, 42])("keeps all birth relationships valid for founder age %i", age => {
    for (let choice = 0; choice < 100; choice++) {
      let first = true;
      const p = planInitialRoyalHousehold(-age * 12, 0, max => { if (first) { first = false; return choice; } return max - 1; });
      expect(p.length).toBeLessThanOrEqual(3);
      const parent = p.find(x => x.kind === "PARENT");
      for (const r of p) {
        expect(r.bornMonth).toBeLessThanOrEqual(0);
        if (r.kind === "CHILD") expect(r.bornMonth + age * 12).toBeGreaterThanOrEqual(18 * 12);
        if (r.kind === "SIBLING") expect(r.bornMonth - parent!.bornMonth).toBeGreaterThanOrEqual(18 * 12);
      }
      if (age <= 22) expect(p.filter(x => x.kind === "CHILD").every(x => -x.bornMonth < 18 * 12)).toBe(true);
    }
    expect(planInitialRoyalHousehold(-age * 12, 0, () => 0)).toEqual([]);
  });
  it("does not fabricate an adult child when the parent is too young or unknown", () => {
    const ts = teams(); DynastyRegistry.reset(); worldRandom.initialize("invalid-parent");
    const d = DynastyRegistry.initializeFaction(ts[0], 0)!;
    const parent = d.rulers[0]; parent.bornYear = -17 * 12;
    const before = d.rulers.length;
    expect(() => (DynastyRegistry as any).createHeir(ts[0], d.houseName, 0, parent.id)).toThrow("Cannot create age-valid child");
    expect(() => (DynastyRegistry as any).createHeir(ts[0], d.houseName, 0, "unknown")).toThrow("Cannot create age-valid child");
    expect(d.rulers).toHaveLength(before);
  });
  it("uses only actual parent chains, keeps priorities and excludes unenthroned parents from ruler/founder counts", () => {
    const ages = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      const s = run(`household-${seed}`);
      for (const d of s.initial.dynasties) {
        const founder = d.rulers.find(r => r.id === d.currentRulerId)!;
        ages.add(-founder.bornYear / 12);
        expect(d.rulers.every(r => r.deathMonth === undefined && r.naturalDeathYear! > 0)).toBe(true);
        expect(d.rulers.length).toBeLessThanOrEqual(4); expect(d.heirIds.length).toBeLessThanOrEqual(2);
        expect(d.designatedHeirId === undefined || d.heirIds.includes(d.designatedHeirId)).toBe(true);
        expect(d.rulers.filter(r => r.reignOrdinal !== undefined)).toHaveLength(1);
        for (const r of d.rulers) {
          if (r.parentId) { const p = d.rulers.find(x => x.id === r.parentId)!;
            expect(p).toBeDefined(); expect(r.bornYear - p.bornYear).toBeGreaterThanOrEqual(18 * 12);
            expect(r.bornYear - p.bornYear).toBeLessThanOrEqual(40 * 12); }
          if (r.relationType === "SIBLING") expect(getRecordedKinRelation(r, founder, d.rulers)).toBe("SIBLING");
          if (r.id !== founder.id) expect(r.accessionYear).toBeUndefined();
        }
        const child = d.rulers.find(r => r.parentId === founder.id);
        if (child) expect(d.designatedHeirId).toBe(child.id);
        const p = deriveGenealogyNodePresentations(d, { name: d.factionId, color: 1, status: "ACTIVE", stateFoundedMonth: 0 }, [], 0);
        for (const r of d.rulers) if (r.id !== founder.id) expect(p.get(r.id)!.roles).not.toContain("势力创始");
        if (founder.parentId) {
          expect(p.get(founder.parentId)!.details).toContain("未曾承统");
          expect(p.get(founder.parentId)!.details).toContain("当今君主的父辈");
          expect(p.get(founder.parentId)!.details.some(text => text.includes("岁"))).toBe(true);
        }
        expect(buildPoliticalGenealogy(d.rulers, d.currentRulerId, d.designatedHeirId, d.heirIds).length).toBeGreaterThan(0);
      }
      expect(validateDynastyInvariants(s.initial.dynasties, () => "ACTIVE")).toEqual([]);
    }
    for (const age of [18, 22, 30, 35, 42]) expect(ages.has(age)).toBe(true);
  });
  it("requires recorded common ancestors for siblings, uncles, nephews and cousins; relationType alone proves nothing", () => {
    const r = (id: string, parentId?: string): Ruler => ({ id, parentId, houseName: "甲氏", givenName: id, bornYear: 0, status: "kin" });
    const root = r("g"), father = r("p", "g"), uncle = r("u", "g"), ruler = r("r", "p"), sibling = r("s", "p"), cousin = r("c", "u"), nephew = r("n", "s");
    const all = [root, father, uncle, ruler, sibling, cousin, nephew];
    expect(getRecordedKinRelation(uncle, ruler, all)).toBe("UNCLE"); expect(getRecordedKinRelation(cousin, ruler, all)).toBe("COUSIN");
    expect(getRecordedKinRelation(nephew, ruler, all)).toBe("NEPHEW");
    expect(getRecordedKinRelation({ ...sibling, parentId: undefined, relationType: "SIBLING" }, ruler, all)).toBeUndefined();
    expect(getRecordedKinRelation(sibling, ruler, all.filter(r => r.id !== "p"))).toBeUndefined();
    expect(getRecordedKinRelation(cousin, ruler, all.filter(r => r.id !== "g"))).toBeUndefined();
    expect(getRecordedKinRelation(uncle, ruler, all.filter(r => r.id !== "g"))).toBeUndefined();
    sibling.status = "heir"; cousin.status = "heir";
    const child = { ...r("child", "r"), status: "heir" as const };
    expect(selectRecordedDynasticSuccessor({ predecessor: ruler, candidates: [sibling, cousin, child], rulers: [...all, child], houseName: "甲氏", month: 0,
      isAlive: () => true, pickIndex: () => 0 })!.ruler.id).toBe(child.id);
  });
  it("keeps legacy and subsequent-faction paths unchanged, never duplicates on repeated initialization", () => {
    const old = run("scope", false); const ts = teams(); ts[0].origin.type = "REBEL";
    DynastyRegistry.reset(); WorldHistory.reset(); worldRandom.initialize("scope");
    const d = DynastyRegistry.initializeFaction(ts[0], 0, true)!;
    expect(d).toEqual(old.initial.dynasties[0]);
    const before = DynastyRegistry.exportState(), rng = worldRandom.exportState();
    expect(DynastyRegistry.initializeFaction(ts[0], 0, true)).toBe(d);
    expect(DynastyRegistry.exportState()).toEqual(before); expect(worldRandom.exportState()).toEqual(rng);
  });
  it("naturally archives both candidates and non-candidate parents with actual death records", () => {
    run("household-0"); const d = DynastyRegistry.getAll().find(d => d.rulers.some(r => r.reignOrdinal === undefined && r.status === "kin"));
    expect(d).toBeDefined();
    const kin = d!.rulers.find(r => r.reignOrdinal === undefined && r.status === "kin")!;
    kin.naturalDeathYear = 1;
    const heir = d!.rulers.find(r => r.status === "heir")!; heir.naturalDeathYear = 1;
    DynastyRegistry.update(1, game.Core.teams);
    expect(kin.status).toBe("dead"); expect(kin.deathMonth).toBe(1);
    expect(heir.status).toBe("dead"); expect(d!.heirIds).not.toContain(heir.id);
  });
  it("discards an already elapsed sibling lifespan without inventing an initial death", () => {
    const ts = teams(); DynastyRegistry.reset(); worldRandom.initialize("elapsed-sibling");
    const d = DynastyRegistry.initializeFaction(ts[0], 0)!;
    const founder = d.rulers[0]; founder.bornYear = -42 * 12;
    d.rulers = [founder]; d.heirIds = []; d.designatedHeirId = undefined;
    const rolls = [60, 4, 0, 99, 0, 0, 0, 0, 0, 0, 0];
    vi.spyOn(worldRandom, "pickIndex").mockImplementation(() => rolls.shift() ?? 0);
    const history = WorldHistory.exportState();
    (DynastyRegistry as any).initializeRoyalHousehold(ts[0], d, founder, 0);
    expect(d.rulers).toHaveLength(2); // Founder and living parent; aged sibling is not inserted.
    expect(d.heirIds).toEqual([]);
    expect(d.rulers.every(r => r.deathMonth === undefined)).toBe(true);
    expect(WorldHistory.exportState()).toEqual(history);
  });
  it("repeats exactly by seed and reports initial distributions and a reproducible 120-year political-only comparison", () => {
    const results = [];
    for (const modern of [false, true]) {
      const summary = { modern, countries: 0, relatives: 0, candidates: 0, designated: 0, noCandidates: 0, directOnly: 0, collateral: 0, ages: [] as number[],
        young: 0, mature: 0, older: 0, parents: 0, noCandidatesAt120: 0, zero: 0, one: 0, two: 0, childMinAge: 100, childMaxAge: 0, naturalHouseChanges: 0, usurpations: 0, crises: 0 };
      for (let i = 0; i < 24; i++) {
        const s = run(`initial-household-comparison-${i}`, modern, 120 * 12);
        expect(run(`initial-household-comparison-${i}`, modern, 120 * 12)).toEqual(s);
        const ids = s.initial.dynasties.flatMap(d => d.rulers.map(r => r.id)); expect(new Set(ids).size).toBe(ids.length);
        for (const d of s.initial.dynasties) {
          const founder = d.rulers.find(r => r.id === d.currentRulerId)!; summary.ages.push(-founder.bornYear / 12);
          summary.young += Number(-founder.bornYear < 22 * 12); summary.mature += Number(-founder.bornYear >= 22 * 12 && -founder.bornYear < 35 * 12); summary.older += Number(-founder.bornYear >= 35 * 12);
          summary.parents += Number(Boolean(founder.parentId));
          summary.countries++; summary.relatives += d.rulers.length - 1; summary.candidates += d.heirIds.length;
          summary.designated += Number(Boolean(d.designatedHeirId)); summary.noCandidates += Number(d.heirIds.length === 0);
          summary.zero += Number(d.heirIds.length === 0); summary.one += Number(d.heirIds.length === 1); summary.two += Number(d.heirIds.length === 2);
          const relations = d.heirIds.map(id => getRecordedKinRelation(d.rulers.find(r => r.id === id)!, founder, d.rulers));
          summary.directOnly += Number(relations.length > 0 && relations.every(r => r === "DIRECT_CHILD"));
          summary.collateral += Number(relations.includes("SIBLING"));
          for (const r of d.rulers.filter(r => r.parentId === founder.id)) { summary.childMinAge = Math.min(summary.childMinAge, -r.bornYear / 12); summary.childMaxAge = Math.max(summary.childMaxAge, -r.bornYear / 12); }
        }
        summary.noCandidatesAt120 += s.final.dynasties.filter(d => !d.heirIds.length).length;
        summary.naturalHouseChanges += s.early.naturalHouseChanges; summary.usurpations += s.early.usurpations; summary.crises += s.early.crises;
      }
      expect(Math.min(...summary.ages)).toBe(18); expect(Math.max(...summary.ages)).toBe(42);
      if (modern) { expect(summary.noCandidates).toBeGreaterThan(0); expect(summary.collateral).toBeGreaterThan(0); expect(summary.two).toBeGreaterThan(0); }
      results.push({ ...summary, ages: undefined });
    }
    console.log("Initial household fixed-seed comparison", JSON.stringify(results));
  });
});
