import { describe, expect, it } from "vitest";
import { deriveFactionAssessment, type HistoricalFaction, type FactionHistoryContext } from "./FactionHistoriography";
import { collectFactionNarrativeEvidence } from "./FactionHistoricalNarrative";
import { deriveFactionHistoricalArguments } from "./FactionHistoricalArguments";
import type { Ruler } from "../Politics/Dynasty";
import type { WorldEvent, WorldEventType } from "../History/WorldHistory";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";
import worldRandom from "../Simulation/WorldRandom";
const m = (year: number, month = 1) => year * 12 + month - 1;
const ev = (type: WorldEventType, at: number, data: Partial<WorldEvent> = {}): WorldEvent => ({ id: `${type}-${at}`, type, year: at, monthIndex: at, category: "politics", importance: "major", title: "原始史料", ...data });
function nation(name: string, founded: number, state: number, end: number, loss?: number): HistoricalFaction {
  return { name: `${name}-id`, displayName: name, status: "EXTINCT", identityStage: "STATE", firstFoundedYear: founded,
    stateFoundedMonth: state, terminationMonth: end, terminationReason: "EXTINCT", extinctionYear: end,
    cumulativeActiveYears: (loss ?? end) - founded, lastExiledYear: loss, restorationYears: [],
    sovereigntyHistory: [{ rank: "KING", startMonth: state }], nameHistory: [{ name: `${name}义军`, startMonth: founded, endMonth: state - 1 }, { name, startMonth: state }] };
}
function scenario(kind: "郢" | "韩" | "楚" | "齐" | "州"): FactionHistoryContext {
  const founded = kind === "郢" ? m(84) : kind === "州" ? m(1083) : 0;
  const state = kind === "郢" ? m(102, 10) : kind === "州" ? m(1105) : 0;
  const end = kind === "郢" ? m(264, 8) : kind === "韩" ? m(94, 8) : kind === "楚" ? m(906) : kind === "齐" ? m(84, 2) : m(1161);
  const loss = kind === "郢" ? m(227, 4) : kind === "韩" ? m(59) : kind === "楚" ? m(852, 4) : kind === "齐" ? m(64, 4) : undefined;
  const city = kind === "郢" ? "范阳" : kind === "韩" ? "新郑" : kind === "楚" ? "兴亭" : "临淄";
  const f = nation(kind, founded, state, end, loss);
  const qin = nation("秦", 0, 0, m(2000)), wei = nation("魏", 0, 0, m(2000)), yan = nation("燕", 0, 0, m(2000)), dong = nation("董", 0, 0, m(2000));
  const count = kind === "楚" ? 37 : kind === "韩" ? 4 : 3;
  const rulers: Ruler[] = Array.from({ length: count }, (_, i) => ({ id: `${f.name}-r${i}`, houseName: "陈氏", givenName: `安${i}`, status: "dead", bornYear: Math.max(0, founded - 240), accessionYear: founded + Math.floor((end - founded) * i / count), endYear: i === count - 1 ? end : founded + Math.floor((end - founded) * (i + 1) / count) - 1 }));
  const events = [ev("state-founded", state, { actorFactionId: f.name, rulerId: rulers.find(r => r.accessionYear! <= state && r.endYear! >= state)?.id })];
  if (loss !== undefined) {
    const attacker = kind === "齐" ? yan : qin;
    events.push(ev("capital-fallen", loss, { actorFactionId: attacker.name, targetFactionId: f.name, cityName: city, cityId: `${city}-id`, historyGroupId: "last-city" }),
      ev("faction-exiled", loss, { targetFactionId: f.name, conquerorFactionId: attacker.name, cityName: city, cityId: `${city}-id`, historyGroupId: "last-city" }),
      ev("dynasty-line-ended", end, { actorFactionId: f.name }), ev("faction-extinct", end, { targetFactionId: f.name, title: "残部消散，王统断绝" }));
  }
  if (kind === "韩") events.push(ev("capital-fallen", m(25, 5), { actorFactionId: f.name, targetFactionId: wei.name, cityName: "大梁", cityId: "daliang" }));
  if (kind === "州") {
    f.terminationReason = "MERGED"; f.terminationTargetFactionId = dong.name;
    rulers[rulers.length - 1].status = "abdicated"; rulers[rulers.length - 1].endReason = "合邦退位";
    events.push(ev("faction-merged", end, { metadata: { absorbedFactionId: f.name, absorbingFactionId: dong.name }, title: "州归并董" }));
  }
  const peak = kind === "郢" ? 5130 : kind === "楚" ? 4450 : kind === "州" ? 1910 : kind === "韩" ? 1800 : 2000;
  const peakMonth = kind === "郢" ? m(117, 7) : kind === "州" ? m(1120) : kind === "楚" ? m(100) : m(40, 2);
  const cityMonth = kind === "郢" ? m(119, 8) : kind === "州" ? m(1121) : kind === "楚" ? m(101) : m(40);
  const c: FactionHistoryContext = { faction: f, factions: new Map([f, qin, wei, yan, dong].map(x => [x.name, x])),
    dynasty: { rulers, houseEpochs: [{ houseName: "陈氏", startMonth: founded, foundingRulerId: rulers[0].id, startReason: "FOUNDING" }] },
    totalWorldBlocks: 10000, lifetime: { factionId: f.name, lastObservedMonth: end,
      peakPopulation: { value: 300, month: peakMonth, source: "MONTHLY" }, peakTerritoryBlocks: { value: peak, month: peakMonth, source: "MONTHLY" },
      peakCityCount: { value: kind === "郢" ? 8 : 3, month: cityMonth, source: "MONTHLY" },
      terminal: { month: end, population: kind === "州" ? 40 : 0, territoryBlocks: kind === "州" ? 50 : 0, cityCount: kind === "州" ? 1 : 0 } }, events };
  if (kind === "齐") c.dynasty!.houseEpochs!.push({ houseName: "田氏", startMonth: m(20), foundingRulerId: rulers[1].id, startReason: "NATURAL_HOUSE_SUCCESSION" });
  return c;
}
const assessment = (c: FactionHistoryContext) => deriveFactionAssessment(c)!;
describe("evidence-backed historiographic arguments and chronological material selection", () => {
  it.each(["郢", "韩", "楚", "齐", "州"] as const)("%s has a bounded, stable nondecreasing chronology with its real ending", kind => {
    const c = scenario(kind), a = assessment(c);
    expect(a.milestones.map(x => x.month)).toEqual(a.milestones.map(x => x.month).sort((x, y) => x - y));
    expect(a.milestones.length).toBeLessThanOrEqual(7); expect(a.narrative.length).toBe(a.milestones.length);
    expect(a.milestones.at(-1)!.kind).toBe("TERMINAL"); expect(a.milestones.at(-1)!.month).toBe(c.faction.terminationMonth);
    expect(assessment(c)).toEqual(a);
  });
  it("Han's attack/defense reversal outranks ordinary exile and includes both cities before/after the peak", () => {
    const a = assessment(scenario("韩"));
    expect(a.selectedArguments[0].argumentKey).toBe("ATTACK_DEFENSE_REVERSAL");
    expect(a.selectedArguments[0].supportingEventIds).toEqual(expect.arrayContaining([`capital-fallen-${m(25, 5)}`, `capital-fallen-${m(59)}`]));
    const timeline = a.narrative.join(" ");
    expect(timeline.indexOf("25年5月")).toBeLessThan(timeline.indexOf("40年1月"));
    expect(timeline.indexOf("40年2月")).toBeLessThan(timeline.indexOf("59年1月"));
    expect(a.lines.join(" ")).toContain("魏都大梁"); expect(a.voice).toContain("大梁"); expect(a.voice).toContain("新郑");
    expect(a.voice).not.toMatch(/报仇|复仇|报应|流亡35年|失国之日/);
  });
  it("Chu's centuries and 37 rulers have a different argumentative structure from Han and Ying", () => {
    const chu = assessment(scenario("楚")), han = assessment(scenario("韩")), ying = assessment(scenario("郢"));
    expect(chu.selectedArguments[0].argumentKey).toBe("LONG_RULE_COLLAPSE");
    expect(ying.selectedArguments[0].argumentKey).toBe("HALF_WORLD_LOSS");
    expect(chu.lines.join(" ")).toContain("906年"); expect(chu.voice).toContain("三十七君");
    expect(chu.narrative.join(" ")).toContain("852年4月"); expect(chu.narrative.join(" ")).toContain("兴亭");
    expect([chu.voice, han.voice, ying.voice].every((v, i, all) => all.indexOf(v) === i)).toBe(true);
    expect(chu.voice).not.toMatch(/帝国|称帝/); expect(chu.selectedArguments.map(x => x.argumentKey)).not.toContain("EMPIRE_COLLAPSE");
  });
  it("two half-world countries differ because of actual moves rather than synonym selection", () => {
    const c = scenario("郢"), plain = assessment(c);
    c.events = [...c.events, ev("capital-relocated", m(130), { actorFactionId: c.faction.name, cityName: "甲城", metadata: { previousCapitalName: "郢", newCapitalName: "甲城" } }),
      ev("capital-relocated", m(180), { actorFactionId: c.faction.name, cityName: "范阳", metadata: { previousCapitalName: "甲城", newCapitalName: "范阳" } })];
    const moving = assessment(c); expect(moving.selectedArguments[0].argumentKey).toBe("REPEATED_CAPITAL_MOVES");
    expect(moving.voice).toContain("甲城、范阳"); expect(moving.voice).not.toBe(plain.voice);
    expect(moving.arguments.find(x => x.argumentKey === "REPEATED_CAPITAL_MOVES")!.supportingEventIds).toContain(`faction-exiled-${m(227, 4)}`);
  });
  it("Qi's two houses support continuity without inventing violent usurpation", () => {
    const a = assessment(scenario("齐")); expect(a.selectedArguments[0].argumentKey).toBe("HOUSE_STATE_CONTINUITY");
    expect(a.evidence.usurpationCount).toBe(0); expect(a.voice).toContain("历二姓"); expect(a.voice).toContain("临淄");
    expect(a.lines.join(" ")).toContain("并无篡朝记录"); expect(a.voice).not.toMatch(/发生篡朝|权臣|暴力夺位|两次篡/);
  });
  it.each(["郢", "韩", "楚", "齐", "州"] as const)("%s argument references all exist in its actual events or evidence fields", kind => {
    const c = scenario(kind), a = assessment(c), ids = new Set(c.events.map(x => x.id));
    for (const argument of a.arguments) {
      expect(argument.reason.length).toBeGreaterThan(0);
      expect(argument.supportingEventIds.length + argument.supportingMetricKeys.length).toBeGreaterThan(0);
      argument.supportingEventIds.forEach(id => expect(ids.has(id)).toBe(true));
      argument.supportingMetricKeys.forEach(key => expect(key.split(".").reduce((obj: any, part) => obj?.[part], a.evidence)).not.toBeUndefined());
      expect(argument.relevantMonths).toEqual(argument.relevantMonths.slice().sort((x, y) => x - y));
    }
  });
  it("Zhou is absorbed by Dong, with administrative retirement rather than conquest or blood kinship", () => {
    const c = scenario("州"), a = assessment(c), original = JSON.stringify(c.events);
    expect(a.selectedArguments[0].argumentKey).toBe("COMMON_ORIGIN_UNION");
    expect(a.narrative.at(-1)).toContain("州并入董（同源合邦）"); expect(a.facts[0]).toContain("并入董"); expect(a.summary).toContain("州并入董");
    expect([...a.lines, a.voice, ...a.narrative].join(" ")).not.toMatch(/董并入州|战死|战败|被灭|兄弟王室|同宗亲族|血脉/);
    expect(JSON.stringify(c.events)).toBe(original);
    c.faction.terminationReason = "SUBMITTED";
    c.events = c.events.filter(x => x.type !== "faction-merged");
    c.events = [...c.events, ev("faction-submitted", c.faction.terminationMonth!, { actorFactionId: c.faction.name, targetFactionId: "董-id", metadata: { submittedFactionId: c.faction.name, receivingFactionId: "董-id" } })];
    const submission = assessment(c); expect(submission.selectedArguments[0].argumentKey).toBe("PEACEFUL_SUBMISSION");
    expect(submission.narrative.at(-1)).toContain("纳土归附董"); expect(submission.voice).not.toContain("合邦"); expect(submission.voice).not.toBe(a.voice);
  });
  it("only true distinct capital events support an attack/defense reversal", () => {
    const c = scenario("韩"); c.events = c.events.filter(x => (x.monthIndex ?? x.year) !== m(25, 5));
    expect(assessment(c).arguments.map(x => x.argumentKey)).not.toContain("ATTACK_DEFENSE_REVERSAL");
    c.events = [...c.events, ev("capital-fallen", m(25, 5), { actorFactionId: "魏-id", targetFactionId: "秦-id", relatedFactionIds: [c.faction.name], cityName: "大梁" })];
    expect(assessment(c).arguments.map(x => x.argumentKey)).not.toContain("ATTACK_DEFENSE_REVERSAL");
  });
  it("royal metadata without an actual ID/reign never becomes a personal campaign", () => {
    const c = scenario("韩"); c.events = c.events.map(x => x.type === "capital-fallen" ? { ...x, metadata: { rulerName: "某将军", currentRulerId: c.dynasty!.rulers[0].id } } : x);
    expect(assessment(c).narrative.join(" ")).not.toMatch(/亲征|某将军|权臣|太后/);
  });
  it("same country/city names are disambiguated without renaming the actual city", () => {
    const c = scenario("郢"); c.events = [...c.events, ev("capital-relocated", m(150), { actorFactionId: c.faction.name, cityName: "范阳", metadata: { previousCapitalName: "郢", newCapitalName: "范阳" } })];
    const a = assessment(c); expect(a.narrative.join(" ")).toContain("郢国由郢城迁都范阳");
    expect(c.events.at(-1)!.metadata!.previousCapitalName).toBe("郢");
  });
  it("prioritizes real political landmarks over routine late relocations", () => {
    const c = scenario("楚"); c.events = [...c.events, ev("emperor-proclaimed", m(300), { actorFactionId: c.faction.name }),
      ev("dynasty-usurped", m(400), { actorFactionId: c.faction.name, metadata: { oldHouseName: "陈氏", newHouseName: "田氏" } }),
      ev("faction-restored", m(500), { actorFactionId: c.faction.name, cityName: "兴亭" }),
      ev("capital-relocated", m(800), { actorFactionId: c.faction.name, cityName: "小城" })];
    const kinds = assessment(c).milestones.map(x => x.kind);
    expect(kinds).toEqual(expect.arrayContaining(["EMPEROR", "USURPATION", "RESTORATION", "FINAL_LOSS", "TERMINAL"]));
    expect(kinds).not.toContain("RELOCATION");
  });
  it("a short provisional force cannot acquire invented emperors, capitals or people", () => {
    const c = scenario("韩"); c.faction.identityStage = "PROVISIONAL"; c.faction.stateFoundedMonth = undefined; c.faction.terminationMonth = 24; c.faction.extinctionYear = 24;
    c.faction.nameHistory = [{ name: "短暂义军", startMonth: 0 }]; c.lifetime.lastObservedMonth = 24; c.lifetime.terminal!.month = 24;
    c.lifetime.peakTerritoryBlocks.month = 12; c.lifetime.peakCityCount = { value: 1, month: 12, source: "MONTHLY" }; c.lifetime.peakPopulation.month = 12;
    c.events = []; c.faction.cumulativeActiveYears = 24; c.faction.lastExiledYear = undefined; c.dynasty!.rulers = [];
    const a = assessment(c); expect(a.selectedArguments[0].argumentKey).toBe("SHORT_PROVISIONAL");
    expect([...a.narrative, ...a.lines, a.voice].join(" ")).not.toMatch(/称帝|帝国|失都|亲征|新郑|将军|宰相/);
  });
  it("JSON restoration yields identical selected arguments and prose without RNG use", () => {
    const c = scenario("韩"), rng = worldRandom.exportState();
    const a = assessment(c), raw = JSON.stringify({ faction: c.faction, dynasty: c.dynasty, lifetime: c.lifetime, events: c.events });
    const restored = { ...c, ...JSON.parse(raw), factions: new Map([...c.factions].map(([id, f]) => [id, JSON.parse(JSON.stringify(f))])) };
    expect(assessment(restored)).toEqual(a); expect(worldRandom.exportState()).toEqual(rng); expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(12);
    expect(deriveFactionHistoricalArguments(a.evidence, collectFactionNarrativeEvidence(c))).toEqual(a.arguments);
  });
});
