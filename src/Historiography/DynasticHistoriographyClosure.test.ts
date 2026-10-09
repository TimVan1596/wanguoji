import { describe, expect, it } from "vitest";
import { deriveFactionAssessment, type FactionHistoryContext, type HistoricalFaction } from "./FactionHistoriography";
import type { WorldEvent, WorldEventType } from "../History/WorldHistory";
import type { Ruler } from "../Politics/Dynasty";
import worldRandom from "../Simulation/WorldRandom";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";
const m = (y: number, month = 1) => y * 12 + month - 1;
const event = (type: WorldEventType, month: number, extra: Partial<WorldEvent> = {}): WorldEvent => ({ id: `${type}-${month}`, type, year: month, monthIndex: month, title: "旧记录", category: "politics", importance: "major", ...extra });
function fixture(name = "周"): FactionHistoryContext {
  const loss = name === "董" ? m(1720) : m(956, 6), end = name === "董" ? m(1798) : m(999);
  const state = name === "董" ? m(897) : 0;
  const f: HistoricalFaction = { name: `${name}-id`, displayName: name, status: "EXTINCT", identityStage: "STATE", firstFoundedYear: 0,
    stateFoundedMonth: state, terminationMonth: end, extinctionYear: end, terminationReason: "EXTINCT", cumulativeActiveYears: loss,
    lastExiledYear: loss, restorationYears: [], sovereigntyHistory: [{ rank: "KING", startMonth: state }], nameHistory: [{ name, startMonth: 0 }] };
  const other = (id: string, displayName: string) => ({ ...f, name: id, displayName, nameHistory: [{ name: displayName, startMonth: 0 }] });
  const dong = other("dong", "董"), zhu = other("zhu", "竹");
  const rulers: Ruler[] = Array.from({ length: name === "董" ? 36 : 4 }, (_, i) => ({ id: `r${i}`, houseName: i ? "张氏" : "刘氏", givenName: i ? "子成" : "安", bornYear: 0, accessionYear: i ? loss : 0, endYear: i ? end : loss, status: "dead" }));
  const c: FactionHistoryContext = { faction: f, factions: new Map([f, dong, zhu].map(x => [x.name, x])),
    dynasty: { rulers, houseEpochs: [{ houseName: "刘氏", startMonth: 0, endMonth: loss - 1, foundingRulerId: "r0", startReason: "FOUNDING" },
      { houseName: name === "董" ? "宋氏" : "张氏", startMonth: loss, foundingRulerId: "r1", startReason: name === "董" ? "NATURAL_HOUSE_SUCCESSION" : "USURPATION" }] },
    totalWorldBlocks: 10000, lifetime: { factionId: f.name, lastObservedMonth: end,
      peakPopulation: { value: 500, month: m(900), source: "MONTHLY" },
      peakTerritoryBlocks: { value: 5020, month: name === "董" ? m(1592) : m(900), source: "MONTHLY" },
      peakCityCount: { value: 8, month: m(900), source: "MONTHLY" }, terminal: { month: end, population: 0, territoryBlocks: 0, cityCount: 0 } },
    events: [event("state-founded", state, { actorFactionId: f.name }),
      event("capital-fallen", loss, { actorFactionId: "zhu", targetFactionId: f.name, cityId: "linzi", cityName: "临淄", historyGroupId: "last" }),
      event("faction-exiled", loss, { targetFactionId: f.name, conquerorFactionId: "zhu", cityId: "linzi", cityName: "临淄", historyGroupId: "last" }),
      event("dynasty-line-ended", end, { actorFactionId: f.name }), event("faction-extinct", end, { targetFactionId: f.name })] };
  if (name !== "董") c.events = [...c.events, event("dynasty-usurped", loss, { id: "zz-usurped", actorFactionId: f.name, rulerId: "r1", metadata: { oldHouseName: "刘氏", newHouseName: "张氏" } }),
    event("capital-fallen", m(930), { actorFactionId: f.name, targetFactionId: "dong", cityName: "旧都" }),
    event("capital-relocated", m(940), { actorFactionId: f.name, cityName: "甲都" }), event("capital-relocated", m(950), { actorFactionId: f.name, cityName: "临淄" })];
  return c;
}
const assess = (c: FactionHistoryContext) => deriveFactionAssessment(c)!;
function unionFixture(): FactionHistoryContext {
  const c = fixture("州"), f = c.faction, end = m(1161);
  f.firstFoundedYear = m(1083); f.stateFoundedMonth = m(1105); f.terminationMonth = end; f.extinctionYear = end;
  f.terminationReason = "MERGED"; f.terminationTargetFactionId = "dong"; f.lastExiledYear = undefined;
  c.lifetime.lastObservedMonth = end; c.lifetime.terminal = { month: end, population: 50, territoryBlocks: 150, cityCount: 1 };
  c.lifetime.peakTerritoryBlocks = { value: 1910, month: m(1120), source: "MONTHLY" };
  c.lifetime.peakCityCount = { value: 3, month: m(1120), source: "MONTHLY" };
  c.events = [event("state-founded", m(1105), { actorFactionId: f.name }),
    event("capital-fallen", m(1087), { actorFactionId: f.name, targetFactionId: "dong", cityName: "临淄", cityId: "linzi" }),
    event("faction-merged", end, { metadata: { absorbedFactionId: f.name, absorbingFactionId: "dong" } })];
  c.dynasty!.houseEpochs = [{ houseName: "张氏", startMonth: m(1083), foundingRulerId: "r0", startReason: "FOUNDING" }];
  return c;
}
describe("dynastic historiography closure", () => {
  it("places same-month active-state usurpation before final exile despite reversed input and lexical IDs", () => {
    const c = fixture(), a = assess(c), rows = a.milestones.filter(x => x.month === m(956, 6));
    expect(rows.map(x => x.kind)).toEqual(["USURPATION", "FINAL_LOSS"]);
    expect(a.narrative.join(" ")).toContain("刘氏转入张氏");
    expect(assess({ ...c, events: [...c.events].reverse() })).toEqual(a);
    expect(a.milestones.map(x => x.month)).toEqual(a.milestones.map(x => x.month).sort((x, y) => x - y));
  });
  it("selects documented same-month revolution over ordinary relocations and records both sources", () => {
    const a = assess(fixture()), main = a.selectedArguments[0];
    expect(main.argumentKey).toBe("SAME_MONTH_USURPATION_LOSS");
    expect(main.supportingEventIds).toEqual(expect.arrayContaining(["zz-usurped", `faction-exiled-${m(956, 6)}`]));
    expect(a.lines.join(" ")).toContain("张氏取代刘氏"); expect(a.voice).toContain("张氏方接王统");
    expect([...a.lines, a.voice].join(" ")).not.toMatch(/导致|因此|因篡|宫变|权臣|禁军|百官|黄袍/);
    expect(a.selectedArguments.map(x => x.argumentKey)).not.toContain("REPEATED_CAPITAL_MOVES");
  });
  it("does not turn an unrelated month or merely natural house change into same-month usurpation", () => {
    const c = fixture(); c.events = c.events.map(x => x.type === "dynasty-usurped" ? { ...x, monthIndex: m(955), year: m(955) } : x);
    const a = assess(c); expect(a.arguments.map(x => x.argumentKey)).not.toContain("SAME_MONTH_USURPATION_LOSS");
    expect(a.selectedArguments.map(x => x.argumentKey)).toContain("HOUSE_STATE_CONTINUITY");
  });
  it("Dong's long, half-world, two-house history includes house continuity without inventing a coup", () => {
    const a = assess(fixture("董")); expect(a.evidence.formalMonths).toBe(m(901)); expect(a.evidence.usurpationCount).toBe(0);
    expect(a.selectedArguments.map(x => x.argumentKey)).toContain("HOUSE_STATE_CONTINUITY");
    expect(a.voice).toContain("历2姓"); expect(a.lines.join(" ")).toContain("并无篡朝记录");
    expect(a.voice).not.toMatch(/夺权|暴力|篡朝|王统曾争/);
  });
  it("recognizes the same stable receiving ID as a former capital target before union", () => {
    const c = unionFixture(), a = assess(c), arg = a.selectedArguments[0];
    expect(arg.argumentKey).toBe("FORMER_OPPONENT_UNION");
    expect(arg.supportingEventIds).toContain(`capital-fallen-${m(1087)}`);
    expect(arg.supportingEventIds).toContain(`faction-merged-${m(1161)}`);
    expect(a.lines.join(" ")).toContain("1087年1月州曾攻陷董都临淄");
    expect(a.lines.join(" ")).toContain("1161年1月，却并入董（同源合邦）");
    expect(a.voice).not.toMatch(/和解|弃仇|血脉|兄弟|宗亲|战败|董并入州/);
  });
  it.each(["no-war", "other-target", "after-union", "defender", "submitted", "same-display-name"])("requires real former-opponent union evidence: %s", mode => {
    const c = unionFixture();
    c.events = c.events.flatMap(x => {
      if (x.type !== "capital-fallen") return [x];
      if (mode === "no-war") return [];
      if (mode === "other-target" || mode === "same-display-name") return [{ ...x, targetFactionId: "other-dong" }];
      if (mode === "after-union") return [{ ...x, year: m(1162), monthIndex: m(1162) }];
      if (mode === "defender") return [{ ...x, actorFactionId: "dong", targetFactionId: c.faction.name }];
      return [x];
    });
    if (mode === "submitted") c.faction.terminationReason = "SUBMITTED";
    if (mode === "same-display-name") c.factions = new Map([...c.factions, ["other-dong", { ...c.factions.get("dong")!, name: "other-dong" }]]);
    const a = assess(c); expect(a.arguments.map(x => x.argumentKey)).not.toContain("FORMER_OPPONENT_UNION");
    expect(a.voice).not.toContain("昔取");
  });
  it("resolves the attack name in its own month and receiving name in the union month", () => {
    const c = unionFixture(); c.factions.get("dong")!.nameHistory = [{ name: "旧董", startMonth: 0, endMonth: m(1100) - 1 }, { name: "董", startMonth: m(1100) }];
    const a = assess(c); expect(a.lines.join(" ")).toContain("攻陷旧董都临淄"); expect(a.lines.join(" ")).toContain("并入董");
  });
  it("does not mutate canonical events or draw RNG; JSON restored evidence/prose is identical, V12 unchanged", () => {
    for (const c of [fixture(), fixture("董"), unionFixture()]) {
      const original = JSON.stringify({ faction: c.faction, dynasty: c.dynasty, events: c.events, lifetime: c.lifetime });
      const random = worldRandom.exportState(), a = assess(c);
      expect(JSON.stringify({ faction: c.faction, dynasty: c.dynasty, events: c.events, lifetime: c.lifetime })).toBe(original);
      expect(assess({ ...c, ...JSON.parse(original), factions: new Map([...c.factions].map(([id, f]) => [id, JSON.parse(JSON.stringify(f))])) })).toEqual(a);
      expect(worldRandom.exportState()).toEqual(random); expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(12);
    }
  });
});
