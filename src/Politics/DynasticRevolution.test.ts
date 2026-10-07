import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Team from "../Components/Team";
vi.mock("../Components/Team", () => ({ default: {} }));
vi.mock("../Components/Block", () => ({ default: {} }));
vi.mock("../Components/Player", () => ({ default: class {} }));
vi.mock("../Components/User", () => ({ default: class {} }));
vi.mock("../Components/Farms", () => ({ default: class { exportState() { return {}; } } }));
vi.mock("../Game/Game", () => ({ default: { Core: { teams: [], totalCells: 100 } } }));
vi.mock("../Components/City", () => ({ getFactionStability: (team: { stability: number }) => team.stability }));
import Game from "../Game/Game";
import DynastyRegistry, { type Dynasty, type Ruler } from "./Dynasty";
import WorldHistory from "../History/WorldHistory";
import FactionEffects from "../Simulation/FactionEffects";
import worldRandom from "../Simulation/WorldRandom";
import { changeFactionColor, getFactionColorAtMonth } from "../Simulation/FactionColorHistory";
import { evaluateDynasticRevolution, getDynasticRevolutionChance, getRevolutionEligibility, type RevolutionContext } from "./DynasticRevolution";
import { buildPoliticalGenealogy, buildPoliticalGenealogyEdges } from "./DynasticCandidateRules";
import { resolveEventFactionColor, resolveFactionHistoricalName } from "../History/HistoryRenderRules";
import { isFeaturedHistoryEvent } from "../History/HistorySignificanceRules";
import { getFactionDisplayNameAtMonth, renameFactionDisplayName } from "../Simulation/FactionIdentity";
import Diplomacy from "./Diplomacy";
import { captureEraMapSnapshot } from "../Simulation/EraMapSnapshot";
import { formatPosthumousRulerName } from "./PosthumousRules";

const month = 600;
function setup(hasHeir = true, minor = true) {
  const rulers: Ruler[] = [{ id: "old", houseName: "田氏", givenName: "平", bornYear: 0,
    accessionYear: 200, reignOrdinal: 1, naturalDeathYear: month, status: "ruling", relationType: "FOUNDER" }];
  if (hasHeir) rulers.push({ id: "heir", houseName: "田氏", givenName: "安", bornYear: minor ? 480 : 250,
    naturalDeathYear: 1000, parentId: "old", relationType: "DIRECT_CHILD", status: "heir" });
  DynastyRegistry.importState({ sequence: 2, dynasties: [{ factionId: "state-id", houseName: "田氏", rulers: rulers.map(ruler => ({ ...ruler, chronicle: undefined })),
    currentRulerId: "old", heirIds: hasHeir ? ["heir"] : [], designatedHeirId: hasHeir ? "heir" : undefined,
    designatedSinceMonth: hasHeir ? 490 : undefined,
    houseEpochs: [{ houseName: "田氏", startMonth: 200, foundingRulerId: "old", startReason: "FOUNDING" }] }] });
  const team = { name: "state-id", displayName: "郑", houseName: "田氏", color: 0x123456,
    colorHistory: [{ color: 0x123456, startMonth: 0, reason: "FOUNDING" }],
    nameHistory: [{ name: "郑", startMonth: 0, reason: "FOUNDING" }],
    sovereigntyHistory: [{ rank: "KING", startMonth: 0, reason: "FOUNDING" }],
    sovereigntyRank: "KING", identityStage: "STATE", factionType: "KINGDOM", status: "ACTIVE", stability: 20,
    cities: [{ name: "洛城" }], capitalCity: { name: "洛城" }, users: new Set(), blocks: { children: { size: 20 } },
    removeRulerUnit: vi.fn(), setRegimeColor(this: Team, color: number, at: number) { changeFactionColor(this, color, at); },
  } as unknown as Team & { stability: number };
  (Game.Core as unknown as { teams: Team[] }).teams = [team];
  return { team, dynasty: DynastyRegistry.get(team.name)! };
}
function transition(team: Team, dynasty: Dynasty, reason: "natural" | "combat" | "captured" = "natural") {
  (DynastyRegistry as unknown as { succeedRuler(t: Team, d: Dynasty, r: Ruler, m: number, reason: string): void })
    .succeedRuler(team, dynasty, dynasty.rulers[0], month, reason);
  return DynastyRegistry.getCurrentRuler(team.name)!;
}
beforeEach(() => {
  worldRandom.initialize("revolution-tests");
  WorldHistory.reset(); DynastyRegistry.reset(); FactionEffects.reset();
  vi.spyOn(DynastyRegistry, "ensureRulerUnit").mockImplementation(() => undefined);
  vi.spyOn(DynastyRegistry as unknown as { ensureActiveHeir(): void }, "ensureActiveHeir").mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); DynastyRegistry.reset(); WorldHistory.reset(); FactionEffects.reset(); });

describe("authoritative succession-boundary dynastic revolution", () => {
  it("keeps live succession/RNG/export identical with debug on or off and resets session counters on load", () => {
    const run = (debug: boolean) => {
      vi.stubGlobal("window", { location: { search: debug ? "?debug=1" : "" } });
      WorldHistory.reset(); FactionEffects.reset();
      const { team, dynasty } = setup();
      worldRandom.initialize("revolution-debug-canonical");
      transition(team, dynasty);
      const canonical = JSON.parse(JSON.stringify({ dynasty: DynastyRegistry.exportState(), rng: worldRandom.exportState(),
        history: WorldHistory.exportState(), effects: FactionEffects.exportState(), nameHistory: team.nameHistory, colorHistory: team.colorHistory }));
      const diagnostics = DynastyRegistry.getRevolutionDiagnostics([team], month).cumulativeGate;
      expect(diagnostics.successionBoundaryCheckCount).toBe(debug ? 1 : 0);
      expect(canonical.dynasty).not.toHaveProperty("revolutionGateDiagnostics");
      DynastyRegistry.importState(DynastyRegistry.exportState());
      expect(DynastyRegistry.getRevolutionDiagnostics([team], month).cumulativeGate.successionBoundaryCheckCount).toBe(0);
      return canonical;
    };
    expect(run(true)).toEqual(run(false));
  });
  it("keeps heirless NEW_HOUSE natural, preserving the state name and banner", () => {
    const { team, dynasty } = setup(false);
    const successor = transition(team, dynasty);
    expect(successor.relationType).toBe("NEW_HOUSE");
    expect(successor.parentId).toBeUndefined();
    expect(dynasty.houseEpochs!.at(-1)!.startReason).toBe("NATURAL_HOUSE_SUCCESSION");
    expect(team.displayName).toBe("郑"); expect(team.color).toBe(0x123456);
    expect(team.nameHistory).toHaveLength(1); expect(team.colorHistory).toHaveLength(1);
    expect(WorldHistory.getEvents().some(event => event.type === "dynasty-usurped")).toBe(false);
    expect(DynastyRegistry.getRevolutionDiagnostics([team], month).naturalHouseSuccessionCount).toBe(1);
  });
  it("passes an adult legitimate successor normally without a crisis or revolution draw", () => {
    const { team, dynasty } = setup(true, false);
    const roll = vi.spyOn(worldRandom, "next");
    expect(transition(team, dynasty).id).toBe("heir");
    expect(roll).not.toHaveBeenCalled(); expect(dynasty.houseEpochs).toHaveLength(1);
  });
  it.each(["natural", "combat", "captured"] as const)("preserves displaced legitimate kin and factual history after %s succession usurpation", reason => {
    const { team, dynasty } = setup();
    vi.spyOn(worldRandom, "next").mockReturnValueOnce(0);
    const successor = transition(team, dynasty, reason);
    const displaced = dynasty.rulers.find(r => r.id === "heir")!;
    expect(successor.relationType).toBe("USURPER"); expect(successor.parentId).toBeUndefined();
    expect(successor.predecessorId).toBe("old"); expect(successor.chronicle?.foundedStateName).toBeUndefined();
    expect(displaced).toMatchObject({ status: "kin", parentId: "old", displacedByUsurpationMonth: month });
    expect(displaced.endYear).toBeUndefined(); expect(dynasty.heirIds).not.toContain("heir");
    expect(dynasty.houseEpochs).toHaveLength(2);
    expect(dynasty.houseEpochs![0].endMonth).toBe(month - 1);
    expect(dynasty.houseEpochs![1]).toMatchObject({ startReason: "USURPATION", displacedSuccessorId: "heir", displacedDesignatedHeirId: "heir" });
    const roots = buildPoliticalGenealogy(dynasty.rulers, successor.id, undefined, []);
    expect(roots.map(root => root.ruler.id)).toContain(successor.id);
    expect(roots.find(root => root.ruler.id === "old")!.children.map(node => node.ruler.id)).toContain("heir");
    expect(buildPoliticalGenealogyEdges(dynasty.rulers).filter(edge => edge.toId === successor.id && edge.type === "KINSHIP")).toEqual([]);
    expect(team.name).toBe("state-id"); expect(team.displayName).not.toBe("郑");
    expect(team.displayName).not.toBe(successor.houseName.replace(/氏$/, ""));
    expect(getFactionDisplayNameAtMonth(team, month - 1)).toBe("郑");
    expect(getFactionDisplayNameAtMonth(team, month)).toBe(team.displayName);
    expect(getFactionColorAtMonth(team, month - 1)).toBe(0x123456);
    expect(getFactionColorAtMonth(team, month)).toBe(team.color);
    expect(team.color).not.toBe(0x123456);
    expect(dynasty.rulers[0].regimeNameAtEnd).toBe("郑");
    expect(formatPosthumousRulerName({ ...dynasty.rulers[0], templeName: "世宗" }, team, month)).toContain("郑世宗");
    const event = WorldHistory.getEvents().find(event => event.type === "dynasty-usurped")!;
    expect(isFeaturedHistoryEvent(event)).toBe(true);
    expect(event.metadata).toMatchObject({ predecessorRulerId: "old", displacedSuccessorId: "heir", successionReason: reason, stability: 20 });
    expect(event.description).toContain("合法继承人未成年");
    expect(event.description).not.toMatch(/近期连续换君|权倾朝野|群臣拥戴|弑君/);
    expect(resolveEventFactionColor({ ...event, year: month - 1, monthIndex: month - 1, metadata: {} }, new Map([[team.name, team.color]]), new Map([[team.name, team]]))).toBe(0x123456);
    expect(resolveEventFactionColor({ ...event, metadata: { actorFactionColor: 0x123456 } }, new Map([[team.name, team.color]]), new Map([[team.name, team]]))).toBe(0x123456);
    const rng = worldRandom.exportState();
    expect(DynastyRegistry.getRevolutionDiagnostics([team], month)).toMatchObject({ usurpationCount: 1, activeHouseEpochCount: 1 });
    expect(worldRandom.exportState()).toEqual(rng);
  });
  it.each(["combat", "captured"] as const)("preserves canonical archive and identity through a compound shock %s usurpation", reason => {
    const run = (debug: boolean) => {
      vi.stubGlobal("window", { location: { search: debug ? "?debug=1" : "" } });
      WorldHistory.reset(); FactionEffects.reset();
      const { team, dynasty } = setup(true, false);
      worldRandom.initialize("compound-canonical");
      vi.spyOn(worldRandom, "next").mockReturnValueOnce(0);
      const ruler = transition(team, dynasty, reason);
      expect(ruler.relationType).toBe("USURPER"); expect(ruler.parentId).toBeUndefined();
      expect(dynasty.rulers.find(r => r.id === "heir")).toMatchObject({ status: "kin", parentId: "old" });
      expect(dynasty.rulers.find(r => r.id === "heir")!.endYear).toBeUndefined();
      expect(dynasty.houseEpochs!.at(-1)).toMatchObject({ startReason: "USURPATION", displacedSuccessorId: "heir" });
      expect(getFactionDisplayNameAtMonth(team, month - 1)).toBe("郑");
      expect(getFactionDisplayNameAtMonth(team, month)).toBe(team.displayName);
      expect(getFactionColorAtMonth(team, month - 1)).toBe(0x123456);
      expect(getFactionColorAtMonth(team, month)).toBe(team.color);
      const event = WorldHistory.getEvents().find(e => e.type === "dynasty-usurped")!;
      expect(event.metadata).toMatchObject({ displacedSuccessorId: "heir", successionReason: reason });
      expect(event.description).toContain("仅余一城");
      expect(event.description).not.toContain("合法继承人未成年");
      const gate = DynastyRegistry.getRevolutionDiagnostics([team], month).cumulativeGate;
      if (debug) expect(gate.recentEligibleBoundaries[0]).toMatchObject({ riskTier: "COMPOUND_SHOCK", crisisLevel: "succession-shock" });
      return JSON.stringify({ dynasty: DynastyRegistry.exportState(), rng: worldRandom.exportState(), history: WorldHistory.exportState(), name: team.nameHistory, color: team.colorHistory });
    };
    expect(run(true)).toEqual(run(false));
  });
  it("enters the existing canonical usurpation path at stability80 without a stability blocker", () => {
    const { team, dynasty } = setup(); team.stability = 80;
    vi.stubGlobal("window", { location: { search: "?debug=1" } });
    vi.spyOn(worldRandom, "next").mockReturnValueOnce(0.08); // 4% base + minor2% + one-city3% =9%.
    const ruler = transition(team, dynasty);
    expect(ruler.relationType).toBe("USURPER"); expect(ruler.parentId).toBeUndefined();
    expect(dynasty.rulers.find(r => r.id === "heir")).toMatchObject({ status: "kin", parentId: "old" });
    expect(dynasty.rulers.find(r => r.id === "heir")!.endYear).toBeUndefined();
    expect(dynasty.houseEpochs!.at(-1)).toMatchObject({ startReason: "USURPATION", displacedSuccessorId: "heir" });
    expect(getFactionDisplayNameAtMonth(team, month - 1)).toBe("郑");
    expect(getFactionDisplayNameAtMonth(team, month)).toBe(team.displayName);
    expect(getFactionColorAtMonth(team, month - 1)).toBe(0x123456);
    expect(getFactionColorAtMonth(team, month)).toBe(team.color);
    const gate = DynastyRegistry.getRevolutionDiagnostics([team], month).cumulativeGate;
    expect(gate).toMatchObject({ hardEligibleBeforeRollCount: 1, rollAttemptCount: 1, usurpationCount: 1 });
    expect(gate.recentEligibleBoundaries[0]).toMatchObject({ stability: 80, baseChance: 0.04, computedChance: 0.09, rollResult: 0.08 });
    expect(WorldHistory.getEvents().find(e => e.type === "dynasty-usurped")!.metadata!.stability).toBe(80);
  });
  it("retains normal succession on a failed eligible draw and records its blocker", () => {
    const { team, dynasty } = setup();
    const roll = vi.spyOn(worldRandom, "next").mockReturnValue(0.9);
    expect(transition(team, dynasty).id).toBe("heir"); expect(roll).toHaveBeenCalledTimes(1);
    expect(DynastyRegistry.getRevolutionDiagnostics([team], month).lastBoundaryChecks[0].blockers).toEqual(["ROLL_FAILED"]);
  });
  it("repeats same-seed transitions and registry/RNG checkpoint continuation", () => {
    let seed = "";
    for (let index = 0; index < 1000; index++) {
      seed = `revolution-${index}`; worldRandom.initialize(seed);
      if (worldRandom.next() < 0.04) break;
    }
    const { team, dynasty } = setup(); worldRandom.initialize(seed);
    const initial = JSON.parse(JSON.stringify(DynastyRegistry.exportState()));
    const rng = worldRandom.exportState();
    transition(team, dynasty);
    const expected = JSON.parse(JSON.stringify({ dynasty: DynastyRegistry.exportState(), rng: worldRandom.exportState(), history: WorldHistory.exportState() }));
    expect(DynastyRegistry.getCurrentRuler(team.name)!.relationType).toBe("USURPER");
    const restoredTeam = setup().team;
    WorldHistory.reset(); FactionEffects.reset(); DynastyRegistry.importState(initial); worldRandom.restore(rng);
    transition(restoredTeam, DynastyRegistry.get(restoredTeam.name)!);
    expect(JSON.parse(JSON.stringify({ dynasty: DynastyRegistry.exportState(), rng: worldRandom.exportState(), history: WorldHistory.exportState() }))).toEqual(expected);
  });
  it("keeps diplomacy pairs and saved Era palettes when the same faction changes regime", () => {
    const { team, dynasty } = setup();
    Diplomacy.importState({ pairMemories: [], relations: [{ factionAId: "other", factionBId: team.name, status: "TRUCE", originalStartedMonth: 500, renewalCount: 0, startedMonth: 500, expiresMonth: 800, reason: "WAR_EXHAUSTION_TRUCE" }], lastEvaluationMonth: 590 });
    const treaty = Diplomacy.exportState();
    const snapshot = captureEraMapSnapshot({ capturedMonth: month - 1, widthCells: 1, heightCells: 1,
      factions: [{ ...team, cities: [] } as unknown as Team], ownerAt: () => team.name });
    const saved = JSON.stringify(snapshot);
    vi.spyOn(worldRandom, "next").mockReturnValueOnce(0);
    transition(team, dynasty);
    expect(Diplomacy.exportState()).toEqual(treaty);
    expect(JSON.stringify(snapshot)).toBe(saved);
    expect(snapshot.factionPalette[0]).toMatchObject({ factionId: team.name, displayName: "郑", color: 0x123456 });
    Diplomacy.reset();
  });
  it("refreshes current Phaser presentation while keeping historical colors", async () => {
    const { default: ActualTeam } = await vi.importActual<typeof import("../Components/Team")>("../Components/Team");
    const fill = vi.fn(), cityDisplay = vi.fn(), ring = vi.fn(), zone = vi.fn();
    const team = Object.assign(Object.create(ActualTeam.prototype), { color: 1,
      colorHistory: [{ color: 1, startMonth: 0, reason: "FOUNDING" }],
      blocks: { getChildren: () => [{ setFillStyle: fill, updateCityDisplay: cityDisplay }] },
      players: { getChildren: () => [{ factionRing: { setStrokeStyle: ring } }] },
      cities: [{ refreshZoneVisual: zone }] });
    team.setRegimeColor(2, month);
    expect(fill).toHaveBeenCalledWith(2); expect(ring).toHaveBeenCalledWith(2, 2, 0.85);
    expect(cityDisplay).toHaveBeenCalledOnce(); expect(zone).toHaveBeenCalledOnce();
    expect(getFactionColorAtMonth(team, month - 1)).toBe(1);
    expect(getFactionColorAtMonth(team, month)).toBe(2);
  });
  it("resolves the latest same-month name/banner transition without changing earlier history", () => {
    const { team } = setup();
    renameFactionDisplayName(team, "梁", month, "dynastic-revolution");
    renameFactionDisplayName(team, "后梁", month, "dynastic-revolution");
    changeFactionColor(team, 2, month); changeFactionColor(team, 3, month);
    expect(getFactionDisplayNameAtMonth(team, month)).toBe("后梁");
    expect(resolveFactionHistoricalName(new Map([[team.name, team]]), team.name, month)).toBe("后梁");
    expect(getFactionColorAtMonth(team, month)).toBe(3);
    expect(getFactionDisplayNameAtMonth(team, month - 1)).toBe("郑");
    expect(getFactionColorAtMonth(team, month - 1)).toBe(0x123456);
  });
  it("restores canonical house, epoch, genealogy, name/color histories and RNG without hydration draws", async () => {
    const { team, dynasty } = setup();
    vi.spyOn(worldRandom, "next").mockReturnValueOnce(0);
    transition(team, dynasty);
    const state = JSON.parse(JSON.stringify(DynastyRegistry.exportState()));
    const rng = worldRandom.exportState();
    const factionState = JSON.parse(JSON.stringify({ factionId: team.name, displayName: team.displayName,
      houseName: team.houseName, color: team.color, colorHistory: team.colorHistory, nameHistory: team.nameHistory,
      factionType: team.factionType, identityStage: team.identityStage, sovereigntyRank: team.sovereigntyRank,
      sovereigntyHistory: team.sovereigntyHistory, status: team.status, origin: { type: "INITIAL", foundedMonth: 0 },
      homeGridX: 0, homeGridY: 0, firstFoundedMonth: 0, currentActiveSinceMonth: 0, cumulativeActiveMonths: month }));
    const { default: ActualTeam } = await vi.importActual<typeof import("../Components/Team")>("../Components/Team");
    vi.stubGlobal("Phaser", { GameObjects: { Group: class {} } });
    try {
      const restored = ActualTeam.hydrate({} as Phaser.Scene, factionState);
      DynastyRegistry.importState(state, month); worldRandom.restore(rng);
      expect(DynastyRegistry.getRevolutionDiagnostics([restored], month + 12).cumulativeGate).toMatchObject({
        sessionStartMonth: month, elapsedWorldYears: 1, expectedUsurpationCount: 0, rollAttemptCount: 0 });
      expect(DynastyRegistry.exportState().dynasties[0].houseEpochs).toEqual(state.dynasties[0].houseEpochs);
      expect(DynastyRegistry.get(restored.name)!.rulers.find(r => r.id === "heir")).toMatchObject({ status: "kin", parentId: "old" });
      const exported = restored.exportState();
      for (const key of ["displayName", "houseName", "color", "colorHistory", "nameHistory"] as const) expect(exported[key]).toEqual(factionState[key]);
      expect(worldRandom.exportState()).toEqual(rng);
      // Subsequent archive edits cannot mutate the serialized checkpoint.
      DynastyRegistry.get(restored.name)!.houseEpochs![0].endMonth = 1;
      expect(state.dynasties[0].houseEpochs[0].endMonth).toBe(month - 1);
    } finally { vi.unstubAllGlobals(); }
  });
});

describe("revolution eligibility reuses succession crisis rules", () => {
  function context(): RevolutionContext {
    const { team, dynasty } = setup();
    return { worldMonth: month, identityStage: team.identityStage, status: team.status, stability: 20, cityCount: 1,
      predecessor: dynasty.rulers[0], successor: dynasty.rulers[1], successionReason: "natural", previousSuccessionMonths: [] };
  }
  it("spends no random draw for each authoritative blocker", () => {
    for (const change of [{ successor: undefined }, { identityStage: "PROVISIONAL" }, { status: "EXILED" }, { cityCount: 0 }]) {
      const roll = vi.fn(() => 0);
      expect(evaluateDynasticRevolution({ ...context(), ...change }, roll).usurpation).toBe(false);
      expect(roll).not.toHaveBeenCalled();
    }
  });
  it("uses actual recent transitions for the chain evidence, excluding minor crisis weighting", () => {
    const input = context();
    expect(getRevolutionEligibility(input).evidence).not.toContain("RECENT_SUCCESSION_CHAIN");
    const chance = getDynasticRevolutionChance(input);
    expect(evaluateDynasticRevolution(input, () => chance - 0.001).usurpation).toBe(true);
    expect(evaluateDynasticRevolution(input, () => chance).blockers).toEqual(["ROLL_FAILED"]);
    input.successor!.bornYear = 250; input.cityCount = 5;
    expect(getRevolutionEligibility(input).blockers).toContain("NO_SUCCESSION_CRISIS");
    input.previousSuccessionMonths = [590, 580];
    expect(getRevolutionEligibility(input).evidence).toContain("RECENT_SUCCESSION_CHAIN");
    expect(evaluateDynasticRevolution(input, () => 0).usurpation).toBe(true);
  });
});
