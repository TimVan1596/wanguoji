import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../Components/Team", () => ({ default: {} }));
vi.mock("../Components/Block", () => ({ default: {} }));
vi.mock("../Game/Game", () => ({ default: { Core: { teams: [], totalCells: 10 } } }));
vi.mock("../Components/City", () => ({ getFactionStability: (team: any) => team.stability }));
import Game from "../Game/Game";
import DynastyRegistry, { type Ruler } from "./Dynasty";
import WorldHistory, { WorldHistoryStore } from "../History/WorldHistory";
import worldRandom from "../Simulation/WorldRandom";
import { formatHistoryEventTitle } from "../History/HistoryRenderRules";
import { formatFactionHistoryEvent } from "../History/FactionHistoryFormatter";
import { getRulerHistoricalEvents } from "./RulerChronicle";
import { captureAccessionCapital } from "../History/AccessionCapitalContext";

beforeEach(() => { WorldHistory.reset(); DynastyRegistry.reset(); worldRandom.initialize("accession-capital"); });
afterEach(() => { vi.restoreAllMocks(); });

function fixture(relation = "DIRECT_CHILD", status = "ACTIVE", identityStage = "STATE") {
  const capital: any = { id: "capital", name: "大梁", ownerFactionId: "qin", isCapital: true, destroyed: false };
  const team: any = { name: "qin", displayName: "秦", houseName: "田氏", color: 1, status, identityStage,
    sovereigntyRank: identityStage === "STATE" ? "KING" : "LEADER", cities: status === "ACTIVE" ? [capital] : [], capitalCity: capital,
    blocks: { children: { size: 2 } }, users: new Set(), farms: { npcs: new Map() }, stability: 70,
    origin: { type: "INITIAL", foundedMonth: 0 }, nameHistory: [], sovereigntyHistory: [],
    removeRulerUnit() {} };
  const previous: Ruler = { id: "old", houseName: "田氏", givenName: "平", bornYear: -600, accessionYear: 0,
    naturalDeathYear: 120, plannedEndYear: 120, reignOrdinal: 1, status: status === "EXILED" ? "exiled" : "ruling" };
  const next: Ruler = { id: "next", houseName: "田氏", givenName: "继", bornYear: -240, naturalDeathYear: 1200,
    parentId: "old", status: "heir" };
  const ancestors: Ruler[] = [];
  if (relation === "GRANDCHILD") {
    ancestors.push({ id: "middle", houseName: "田氏", givenName: "中", bornYear: -400, parentId: "old", status: "dead", deathMonth: 0, deathReason: "自然去世" });
    next.parentId = "middle";
  } else if (relation === "SIBLING" || relation === "NEPHEW") {
    ancestors.push({ id: "father", houseName: "田氏", givenName: "父", bornYear: -900, status: "dead", deathMonth: 0, deathReason: "自然去世" });
    previous.parentId = "father"; next.parentId = "father";
    if (relation === "NEPHEW") {
      ancestors.push({ id: "brother", houseName: "田氏", givenName: "兄", bornYear: -550, parentId: "father", status: "dead", deathMonth: 0, deathReason: "自然去世" });
      next.parentId = "brother";
    }
  }
  DynastyRegistry.importState({ sequence: 10, dynasties: [{ factionId: "qin", houseName: "田氏", currentRulerId: "old",
    heirIds: ["next"], rulers: [...ancestors, previous, next].map(r => ({ ...r, chronicle: r.chronicle })), houseEpochs: [{ houseName: "田氏", startMonth: 0, foundingRulerId: "old", startReason: "FOUNDING" }] }] });
  (Game.Core as any).teams = [team];
  vi.spyOn(DynastyRegistry, "ensureRulerUnit").mockImplementation(() => undefined);
  return { team, capital };
}

describe("live Dynasty → immutable history → restored presentation", () => {
  it.each(["DIRECT_CHILD", "GRANDCHILD", "SIBLING", "NEPHEW"])("captures the same-boundary capital for %s succession, not a ceremony location", relation => {
    const { team, capital } = fixture(relation);
    DynastyRegistry.update(120, [team]);
    const events = WorldHistory.getEvents().filter(e => e.type === "ruler-succession");
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.metadata).toMatchObject({ previousRulerId: "old", nextRulerId: "next", accessionMonth: 120,
      accessionFactionId: "qin", accessionFactionStatus: "ACTIVE", capitalControlled: 1, capitalCityId: "capital", capitalCityName: "大梁", relationType: relation });
    const ruler = DynastyRegistry.getCurrentRuler("qin")!;
    const selected = getRulerHistoricalEvents(WorldHistory.getEvents(), { ...ruler, accessionYear: 120 }, "qin", 120, [], 100);
    expect(selected.map(e => e.id)).toContain(event.id);
    capital.name = "新名"; team.capitalCity = { id: "later", name: "新都" }; capital.ownerFactionId = "enemy";
    const restored = new WorldHistoryStore(); restored.importState(JSON.parse(JSON.stringify(WorldHistory.exportState())));
    const output = formatHistoryEventTitle(restored.getEvents().find(e => e.id === event.id)!, new Map());
    expect(output).toContain("继位时国都：大梁"); expect(output).not.toMatch(/新名|新都|典礼|在大梁/);
    expect(formatFactionHistoryEvent(event, "qin", new Map())).toBe(formatHistoryEventTitle(event, new Map()));
    DynastyRegistry.update(120, [team]);
    expect(WorldHistory.getEvents().filter(e => e.type === "ruler-succession")).toHaveLength(1);
  });

  it.each(["combat", "captured"])("uses the actual %s succession entry point", reason => {
    const { team } = fixture();
    if (reason === "captured") DynastyRegistry.resolveCapturedRuler(team, { name: "enemy" } as any, 120);
    else { team.stability = 20; team.capitalCity.underSiege = true; expect(DynastyRegistry.handleRulerCombatDeath(team, "old", 120)).toBe(true); }
    const event = WorldHistory.getEvents().find(e => e.type === "ruler-succession")!;
    expect(event.metadata).toMatchObject({ reason, capitalCityName: "大梁", nextRulerId: "next" });
    expect(DynastyRegistry.get("qin")?.rulers.find(r => r.id === "old")).toMatchObject({ status: "dead", deathMonth: 120 });
  });

  it.each(["EXILED", "PROVISIONAL", "STALE"])("does not fabricate a capital for %s", mode => {
    const { team } = fixture("DIRECT_CHILD", mode === "EXILED" ? "EXILED" : "ACTIVE", mode === "PROVISIONAL" ? "PROVISIONAL" : "STATE");
    if (mode === "STALE") team.capitalCity.ownerFactionId = "enemy";
    DynastyRegistry.update(120, [team]);
    const event = WorldHistory.getEvents().find(e => e.type === "ruler-succession")!;
    expect(event.metadata?.capitalCityId).toBeUndefined(); expect(event.metadata?.capitalControlled).toBe(0);
    const output = formatHistoryEventTitle(event, new Map());
    if(mode==="PROVISIONAL"){expect(event.metadata?.provisionalSeatCityId).toBe(team.capitalCity.id);expect(output).toContain("当时治所：大梁");expect(output).not.toContain("继位时国都：大梁");}else expect(output).not.toContain("大梁");
    expect(output).toContain(mode === "EXILED" ? "流亡承统，当时无实际国都" : mode === "PROVISIONAL" ? "尚未正式建国" : "无实际国都");
  });

  it("captures founding accession once, and leaves old V15 histories explicitly unrecorded", () => {
    const { team } = fixture(); DynastyRegistry.reset();
    DynastyRegistry.initializeFaction(team, 0); DynastyRegistry.initializeFaction(team, 0);
    const events = WorldHistory.getEvents().filter(e => e.type === "ruler-acceded");
    expect(events).toHaveLength(1); expect(events[0].metadata?.capitalCityName).toBe("大梁");
    const founder = DynastyRegistry.getCurrentRuler("qin")!;
    expect(getRulerHistoricalEvents(WorldHistory.getEvents(), { ...founder, accessionYear: 0 }, "qin", 0, []).map(e => e.id)).toContain(events[0].id);
    const old = { ...events[0], metadata: undefined };
    expect(formatHistoryEventTitle(old, new Map())).toContain("继位时国都：未记录");
    expect(captureAccessionCapital({ ...team, capitalCity: { ...team.capitalCity, destroyed: true } }, 0, "x").capitalControlled).toBe(0);
  });

  it("uses the single real deposition event for the successor's capital context", () => {
    const { team } = fixture(); team.stability = 30;
    vi.mocked(DynastyRegistry.ensureRulerUnit).mockImplementation(() => {
      const ruler = DynastyRegistry.getCurrentRuler("qin")!;
      const user: any = { role: "RULER", rulerId: ruler.id, player: { role: "RULER", rulerId: ruler.id, setRole() {} } };
      team.rulerUser = user; team.users.add(user);
    });
    WorldHistory.addCapitalFallen(1, "enemy", "qin", "qin", "失守旧都", "old-capital", true);
    vi.spyOn(worldRandom, "next").mockReturnValue(0);
    DynastyRegistry.update(12, [team]);
    const event = WorldHistory.getEvents().find(e => e.type === "ruler-deposed")!;
    expect(event.metadata).toMatchObject({ previousRulerId: "old", nextRulerId: "next", capitalCityName: "大梁", accessionMonth: 12 });
    expect(formatHistoryEventTitle(event, new Map())).toContain("国都仍在大梁");
    expect(WorldHistory.getEventTypeCount("ruler-succession")).toBe(0);
    expect(WorldHistory.getEventTypeCount("ruler-deposed")).toBe(1);
  });
});
