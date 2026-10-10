import { describe, expect, it } from "vitest";
import { deriveFactionAssessment, type FactionHistoryContext, type HistoricalFaction } from "./FactionHistoriography";
import { collectFactionNarrativeEvidence } from "./FactionHistoricalNarrative";
import type { WorldEvent, WorldEventType } from "../History/WorldHistory";
import type { Ruler } from "../Politics/Dynasty";
import worldRandom from "../Simulation/WorldRandom";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";
const month = (year: number, m = 1) => year * 12 + m - 1;
function event(type: WorldEventType, at: number, extra: Partial<WorldEvent> = {}): WorldEvent {
  return { id: `${type}-${at}`, type, year: at, monthIndex: at, title: "原始史料", category: "politics", importance: "major", ...extra };
}
function fixture(name = "郢", loss = month(227, 4), end = month(264, 8)): FactionHistoryContext {
  const id = `${name}义军`, founded = month(84), state = month(102, 10);
  const faction: HistoricalFaction = { name: id, displayName: name, status: "EXTINCT", identityStage: "STATE", firstFoundedYear: founded,
    stateFoundedMonth: state, extinctionYear: end, terminationMonth: end, terminationReason: "EXTINCT", cumulativeActiveYears: loss - founded,
    restorationYears: [], lastExiledYear: loss, sovereigntyHistory: [{ rank: "LEADER", startMonth: founded, endMonth: state - 1 }, { rank: "KING", startMonth: state }],
    nameHistory: [{ name: id, startMonth: founded, endMonth: state - 1 }, { name, startMonth: state }] };
  const rival = { ...faction, name: "qin", displayName: "秦", nameHistory: [{ name: "秦", startMonth: 0 }], sovereigntyHistory: [{ rank: "KING", startMonth: 0 }] };
  const ruler: Ruler = { id: "qin-ruler", givenName: "康", houseName: "嬴氏", bornYear: month(200), accessionYear: month(220), endYear: month(250), status: "dead" };
  const founder: Ruler = { id: "founder", givenName: "安", houseName: "芈氏", bornYear: month(60), accessionYear: founded, endYear: month(130), status: "dead" };
  return { faction, factions: new Map([[id, faction], ["qin", rival]]), dynasty: { rulers: [founder], houseEpochs: [{ houseName: "芈氏", startMonth: founded, foundingRulerId: founder.id, startReason: "FOUNDING" }] },
    resolveRuler: (id, factionId) => id === ruler.id && factionId === "qin" ? ruler : undefined,
    totalWorldBlocks: 10000, lifetime: { factionId: id, lastObservedMonth: end, peakPopulation: { value: 500, month: month(118), source: "MONTHLY" }, peakTerritoryBlocks: { value: 5130, month: month(117, 7), source: "MONTHLY" }, peakCityCount: { value: 8, month: month(119, 8), source: "MONTHLY" }, terminal: { month: end, population: 0, territoryBlocks: 0, cityCount: 0 } },
    events: [event("state-founded", state, { actorFactionId: id, rulerId: founder.id }),
      event("city-captured", loss, { category: "war", actorFactionId: "qin", targetFactionId: id, cityId: "fanyang", cityName: "范阳", rulerId: ruler.id, historyGroupId: "loss" }),
      event("capital-fallen", loss, { category: "war", actorFactionId: "qin", targetFactionId: id, cityId: "fanyang", cityName: "范阳", metadata: { rulerId: ruler.id }, historyGroupId: "loss" }),
      event("faction-exiled", loss, { targetFactionId: id, conquerorFactionId: "qin", cityId: "fanyang", cityName: "范阳", historyGroupId: "loss", metadata: { isFinalCityCapture: 1 } }),
      event("dynasty-line-ended", end, { actorFactionId: id }),
      event("faction-extinct", end, { targetFactionId: id, title: `${id}国残部消散，王统断绝` })] };
}
const text = (c: FactionHistoryContext) => { const a = deriveFactionAssessment(c)!; return [...a.narrative, ...a.lines, a.voice, a.summary].join("\n"); };
describe("fact-driven national rise and fall narratives", () => {
  it("connects a documented peak, Fanyang, personal campaign, exile and later extinction", () => {
    const c = fixture(), a = deriveFactionAssessment(c)!;
    expect(a.narrative.join(" ")).toContain("117年7月"); expect(a.narrative.join(" ")).toContain("51.3%");
    expect(text(c)).toContain("227年4月"); expect(text(c)).toContain("秦王嬴康亲征"); expect(text(c)).toContain("范阳");
    expect(text(c)).toContain("264年8月"); expect(text(c)).toContain("37年4个月"); expect(a.selectedArguments[0].argumentKey).toBe("HALF_WORLD_LOSS");
    expect(a.narrative).toHaveLength(6); expect(a.narrative.join(" ").match(/范阳/g)).toHaveLength(1);
    expect(a.narrative.join(" ")).toContain("102年10月，郢正式建国");
  });
  it("Han emphasizes Xinzheng and 35 years of exile rather than generic longevity", () => {
    const c = fixture("韩", month(59), month(94, 8));
    c.faction.firstFoundedYear = 0; c.faction.stateFoundedMonth = 0; c.faction.nameHistory = [{ name: "韩", startMonth: 0 }];
    c.faction.cumulativeActiveYears = month(59); c.lifetime.peakTerritoryBlocks = { value: 1800, month: month(40, 2), source: "MONTHLY" };
    c.lifetime.peakCityCount = { value: 3, month: month(40), source: "MONTHLY" };
    c.events = c.events.filter(e => e.type !== "state-founded").map(e => e.cityId ? { ...e, cityId: "xinzheng", cityName: "新郑", rulerId: undefined, metadata: {} } : e);
    const a = deriveFactionAssessment(c)!; expect(a.lines.join(" ")).toContain("新郑"); expect(a.lines.join(" ")).toContain("35年7个月"); expect(a.selectedArguments[0].argumentKey).toBe("EXILE_CONTINUITY");
    expect(a.summary).toContain("59年1月"); expect(a.summary).toContain("94年8月"); expect(a.voice).not.toContain("过半");
    expect(a.voice).not.toEqual(deriveFactionAssessment(fixture())!.voice);
  });
  it("two houses without USURPATION never become two usurpations", () => {
    const c = fixture("齐", month(64, 4), month(84, 2)); c.faction.firstFoundedYear = 0; c.faction.stateFoundedMonth = 0;
    c.faction.nameHistory = [{ name: "齐", startMonth: 0 }];
    c.dynasty!.houseEpochs!.push({ houseName: "田氏", startMonth: 100, foundingRulerId: "tian", startReason: "NATURAL_HOUSE_SUCCESSION" });
    c.events = c.events.filter(e => e.type !== "state-founded").map(e => e.cityId ? { ...e, cityName: "临淄" } : e);
    const a = deriveFactionAssessment(c)!; expect(a.evidence.houseCount).toBe(2); expect(a.evidence.usurpationCount).toBe(0);
    expect(a.voice).toContain("二姓"); expect(a.voice).toContain("临淄"); expect(a.voice).not.toMatch(/\d+次篡|发生篡朝/);
  });
  it("does not infer gradual retreat from zero territory at extinction", () => {
    const a = deriveFactionAssessment(fixture())!; expect(a.profiles.map(p => p.key)).not.toContain("RETREAT");
    expect(text(fixture())).not.toMatch(/逐渐衰|渐进|明显退潮/);
  });
  it("still compares genuine pre-transfer peaks for administrative endings", () => {
    for (const ending of ["MERGED", "SUBMITTED"] as const) {
      const c = fixture(); c.faction.terminationReason = ending; c.faction.terminationTargetFactionId = "qin";
      c.lifetime.terminal!.territoryBlocks = 10; c.lifetime.terminal!.cityCount = 1;
      expect(deriveFactionAssessment(c)!.profiles.map(p => p.key)).toContain("RETREAT");
      expect(text(c)).not.toMatch(/战败|战死|失去最后据点|王统断绝/); expect(text(c)).toContain("退位");
    }
  });
  it("an index association does not make a faction the aggressor", () => {
    const c = fixture(); c.events = [event("capital-fallen", 1500, { actorFactionId: "qin", targetFactionId: "other", relatedFactionIds: [c.faction.name], cityName: "无关城" })];
    expect(collectFactionNarrativeEvidence(c)).toEqual([]); expect(text(c)).not.toContain("无关城");
  });
  it("records source identity, role, city, metadata and the original event month", () => {
    const c = fixture(); const e = c.events[1]; e.year = 99999;
    expect(collectFactionNarrativeEvidence(c).find(x => x.eventId === e.id)).toMatchObject({ month: month(227, 4), factionRole: "TARGET", cityId: "fanyang", rulerId: "qin-ruler", actorName: "秦", metadata: {} });
  });
  it("unverified or out-of-reign ruler IDs never generate a person's name", () => {
    const c = fixture(); c.resolveRuler = () => undefined; expect(text(c)).not.toContain("嬴康");
    c.resolveRuler = () => ({ id: "qin-ruler", givenName: "未来", houseName: "假氏", bornYear: 0, accessionYear: 9000, status: "ruling" });
    expect(text(c)).not.toContain("假未来");
  });
  it("deduplicates event IDs without altering canonical source arrays", () => {
    const c = fixture(); const original = JSON.stringify(c.events); const once = collectFactionNarrativeEvidence(c);
    c.events = [...c.events, ...c.events]; expect(collectFactionNarrativeEvidence(c)).toEqual(once);
    expect(JSON.stringify(c.events.slice(0, c.events.length / 2))).toBe(original);
  });
  it("sparse evidence falls back to a short account without invented loss or extinction causes", () => {
    const c = fixture(); c.events = []; c.faction.lastExiledYear = undefined;
    const a = deriveFactionAssessment(c)!; expect(a.narrative.length).toBeLessThanOrEqual(5); expect(a.milestones.every(x => !x.eventId)).toBe(true);
    expect(text(c)).not.toMatch(/失国|绝统|范阳|嬴康|被秦灭亡/);
  });
  it("a last-city capture by itself does not prove exile or extinction responsibility", () => {
    const c = fixture(); c.events = c.events.filter(e => ["city-captured", "capital-fallen"].includes(e.type));
    expect(text(c)).not.toMatch(/失国|王室流亡|绝统|被秦灭亡/);
  });
  it("restoration after a documented exile prevents a false final continuous exile", () => {
    const c = fixture(); c.events = [...c.events, event("faction-restored", month(240), { actorFactionId: c.faction.name, cityName: "故城" })];
    const a = deriveFactionAssessment(c)!; expect(a.voice).not.toContain("37年4个月"); expect(a.narrative.join(" ")).toContain("240年1月");
  });
  it("canonical usurpation evidence keeps its actual houses and date", () => {
    const c = fixture(); c.events = [...c.events, event("dynasty-usurped", month(150), { actorFactionId: c.faction.name, metadata: { oldHouseName: "芈氏", newHouseName: "田氏" } })];
    expect(text(c)).toContain("150年1月"); expect(text(c)).toContain("芈氏转入田氏");
  });
  it("same-month loss and termination never invent years of surviving exile", () => {
    const c = fixture("郢", month(264, 8), month(264, 8));
    const a = deriveFactionAssessment(c)!;
    expect(a.milestones.find(x => x.kind === "FINAL_LOSS")!.month).toBe(a.milestones.find(x => x.kind === "TERMINAL")!.month); expect(a.voice).not.toMatch(/非绝统之时|原非同日|犹续/);
  });
  it("a capital conquest has different emphasis from losing that same city", () => {
    const c = fixture(); c.events = [event("capital-fallen", month(150), { actorFactionId: c.faction.name, targetFactionId: "qin", cityName: "咸阳" })];
    expect(text(c)).toContain("郢攻陷秦都咸阳"); expect(text(c)).not.toContain("郢都咸阳");
  });
  it("does not collapse a long trace into an unbounded narrative", () => {
    const c = fixture(); for (let i = 0; i < 20000; i++) (c.events as WorldEvent[]).push(event("capital-relocated", 1300 + i % 1000, { id: `move-${i}`, actorFactionId: c.faction.name, cityName: `都${i}` }));
    const a = deriveFactionAssessment(c)!; expect(a.narrative.length).toBeLessThanOrEqual(7); expect(a.milestones.map(x => x.month)).toEqual(a.milestones.map(x => x.month).sort((a, b) => a - b));
  });
  it("preserves narrative, clock-independent data and RNG across JSON save/load", () => {
    const c = fixture(), rng = worldRandom.exportState(), original = JSON.stringify({ faction: c.faction, dynasty: c.dynasty, lifetime: c.lifetime, events: c.events });
    const a = deriveFactionAssessment(c);
    const restored = { ...c, ...JSON.parse(original), factions: new Map([...c.factions].map(([id, f]) => [id, JSON.parse(JSON.stringify(f))])) };
    expect(deriveFactionAssessment(restored)).toEqual(a); expect(deriveFactionAssessment(c)).toEqual(a);
    expect(JSON.stringify({ faction: c.faction, dynasty: c.dynasty, lifetime: c.lifetime, events: c.events })).toBe(original);
    expect(worldRandom.exportState()).toEqual(rng); expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(13);
  });
});
