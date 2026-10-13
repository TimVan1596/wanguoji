import { describe, expect, it } from "vitest";
import { buildUnifiedFactionChronicle, type UnifiedChronicleContext } from "./UnifiedFactionChronicle";
import { deriveHouseAssessments, type HouseHistoricalFaction } from "./DynastyHouseHistoriography";
import type { HistoricalFaction } from "./FactionHistoriography";
import type { Dynasty, Ruler } from "../Politics/Dynasty";
import type { WorldEvent } from "../History/WorldHistory";
import { createRulerChronicle } from "../Politics/RulerChronicle";
import worldRandom from "../Simulation/WorldRandom";
import { exportRulerSave, importRulerSave } from "../Persistence/RulerSaveProjection";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";
import { composeChronicleParagraphs, type ChroniclePassage } from "./ChronicleComposition";
const month = (year: number, m = 1) => year * 12 + m - 1;
const ruler = (id: string, house: string, given: string, start: number, end: number | undefined, n: number): Ruler => ({
  id, houseName: house, givenName: given, bornYear: start - 360, accessionYear: start, endYear: end, reignOrdinal: n,
  status: end === undefined ? "ruling" : "politically-ended", chronicle: createRulerChronicle({ month: start, population: 10, cityCount: 1, territoryShare: .1, stability: 60 }) });
const event = (id: string, type: WorldEvent["type"], m: number, extra: Partial<WorldEvent> = {}): WorldEvent => ({
  id, type, year: m, monthIndex: m, title: id, importance: "major", category: "politics", actorFactionId: "f", factionIds: ["f"], ...extra });
function fixture(): UnifiedChronicleContext & { faction: HistoricalFaction & HouseHistoricalFaction; dynasty: Dynasty } {
  const f = { name: "f", displayName: "沂", color: 1, status: "EXTINCT", identityStage: "STATE", firstFoundedYear: month(154),
    stateFoundedMonth: month(186, 2), terminationMonth: month(583, 6), terminationReason: "EXTINCT" as const,
    cumulativeActiveYears: month(542, 5) - month(154), restorationYears: [], sovereigntyHistory: [{ rank: "KING" as const, startMonth: month(186, 2) }],
    nameHistory: [{ name: "临沂义军", startMonth: month(154), endMonth: month(186, 2) - 1 }, { name: "沂", startMonth: month(186, 2) }] };
  const rulers = [ruler("founder", "宋氏", "昭", month(154), month(185), 1), ruler("state-ruler", "宋氏", "景", month(185), month(220), 2),
    ...Array.from({ length: 14 }, (_, i) => ruler(`middle${i}`, "宋氏", `君${i}`, month(220 + i * 23), month(220 + (i + 1) * 23), i + 3)),
    ruler("exiled1", "宋氏", "恺", month(540), month(545, 9), 17), ruler("last", "宋氏", "景怀", month(545, 9), month(583, 6), 18)];
  Object.assign(rulers[17], { status: "dead", deathMonth: month(583, 6), deathReason: "去世" });
  const dy: Dynasty = { factionId: "f", houseName: "宋氏", currentRulerId: null, rulers, heirIds: [],
    houseEpochs: [{ houseName: "宋氏", startMonth: month(154), foundingRulerId: "founder", startReason: "FOUNDING" }] };
  return { faction: f, factions: new Map([["f", f]]), dynasty: dy, worldMonth: month(600), phases: [], totalWorldBlocks: 1226,
    lifetime: { factionId: "f", lastObservedMonth: month(583, 6), peakPopulation: { value: 300, month: month(450), source: "MONTHLY" },
      peakTerritoryBlocks: { value: 526, month: month(493, 10), source: "MONTHLY" }, peakCityCount: { value: 8, month: month(400), source: "MONTHLY" },
      terminal: { month: month(583, 6), population: 0, territoryBlocks: 0, cityCount: 0 } },
    events: [event("state", "state-founded", month(186, 2), { rulerId: "state-ruler" }),
      event("move1", "capital-relocated", month(202), { cityName: "新郑" }), event("move2", "capital-relocated", month(318, 7), { cityName: "郢" }),
      event("capture", "capital-fallen", month(542, 5), { actorFactionId: "enemy", targetFactionId: "f", cityId: "ying", cityName: "郢", historyGroupId: "fall" }),
      event("exile", "faction-exiled", month(542, 5), { actorFactionId: "enemy", targetFactionId: "f", cityId: "ying", cityName: "郢", historyGroupId: "fall" }),
      event("end", "faction-extinct", month(583, 6), { targetFactionId: "f" })] };
}
function build(c = fixture()) {
  c.phases = deriveHouseAssessments({ dynasty: c.dynasty, faction: c.faction, factions: new Map([["f", c.faction]]), events: c.events, worldMonth: c.worldMonth });
  return buildUnifiedFactionChronicle(c);
}
const text = (c = fixture()) => build(c).paragraphs.join("");
describe("unified factual chronicle", () => {
  it("weaves a single inherited house into one account, with distinct founding rulers and a measured peak", () => {
    const c = fixture(); c.factions = new Map([...c.factions, ["enemy", { ...c.faction, name: "enemy", displayName: "齐", nameHistory: [{ name: "齐", startMonth: 0 }] }]]);
    // Includes the incumbent who entered exile, then the real exile successor.
    c.dynasty.rulers[15].endYear = month(540);
    const a = build(c), s = a.paragraphs.join("");
    expect(a.title).toBe("《沂国史》"); expect(s).toContain("宋昭开创宋氏"); expect(s).toContain("宋景在位时");
    expect(s).toContain("493年10月"); expect(s).toContain("526格"); expect(s).toContain("42.9%"); expect(s).toContain("齐攻陷郢");
    expect(s).toMatch(/宋恺[^。]*、[^。]*宋景怀[^。]*先后承统/); expect(s).toContain("宋景怀实际去世，同月沂政权彻底终结");
    expect(s).toContain("18位统治者"); expect(s).not.toMatch(/史家曰|王统总评|国史简述|造成|全部死亡/);
    console.info(`Unified fixture 沂: ${a.length} characters`); expect(a.length).toBeLessThan(550);
  });
  it("includes both natural-house stages with same-month terminal closure, without assigning old deeds to the new holder", () => {
    const c = fixture(); c.faction.stateFoundedMonth = month(1827, 12); c.faction.firstFoundedYear = month(1796); c.faction.terminationMonth = month(2466, 11);
    c.faction.nameHistory = [{ name: "邯郸义军", startMonth: month(1796), endMonth: month(1827, 12) - 1 }, { name: "郸", startMonth: month(1827, 12) }];
    c.worldMonth = month(2500); c.lifetime.lastObservedMonth = month(2466, 11); c.lifetime.terminal!.month = month(2466, 11); c.lifetime.peakTerritoryBlocks.month = month(1900);
    c.dynasty.rulers = [ruler("x", "萧氏", "仲宁", month(1796), month(1826), 1), ruler("state", "萧氏", "弼", month(1826), month(1850), 2),
      ...Array.from({ length: 25 }, (_, i) => ruler(`xiao${i}`, "萧氏", `君${i}`, month(1850 + i * 24), i === 24 ? month(2466, 11) : month(1874 + i * 24), i + 3)),
      ruler("q", "钱氏", "翊", month(2466, 11), month(2466, 11), 28)];
    c.dynasty.houseEpochs = [{ houseName: "萧氏", startMonth: month(1796), endMonth: month(2466, 11) - 1, foundingRulerId: "x", startReason: "FOUNDING" },
      { houseName: "钱氏", startMonth: month(2466, 11), foundingRulerId: "q", startReason: "NATURAL_HOUSE_SUCCESSION" }];
    c.events = [event("state", "state-founded", month(1827, 12), { rulerId: "state" }), event("end", "faction-extinct", month(2466, 11), { targetFactionId: "f" })];
    const s = text(c); console.info(`Unified fixture 郸: ${s.length} characters`); expect(s).toContain("萧弼在位时"); expect(s).toContain("钱翊自然易姓续统"); expect(s).toContain("28位统治者"); expect(s).toMatch(/2466年11月，[^。]*钱翊自然易姓续统；郸政权彻底终结/);
    expect(s).not.toMatch(/篡朝|0个月|钱翊在位时.*建国|钱翊.*实际去世/);
  });
  it("retains the earlier house, a verified usurper and the real current holder in an ACTIVE nation", () => {
    const c = fixture(); c.faction.status = "ACTIVE"; c.faction.terminationMonth = undefined; c.lifetime.terminal = undefined;
    c.faction.nameHistory = [{ name: "坂", startMonth: 0 }]; c.worldMonth = month(4000); c.lifetime.lastObservedMonth = c.worldMonth;
    c.dynasty.rulers.push({ ...ruler("usurper", "王氏", "玄平", month(3365, 5), month(3400), 19), relationType: "USURPER" });
    for (let i = 0; i < 21; i++) c.dynasty.rulers.push(ruler(`wang${i}`, "王氏", `君${i}`, month(3400 + i * 20), month(3420 + i * 20), 20 + i));
    c.dynasty.rulers.push(ruler("now", "王氏", "君安", month(3820), undefined, 41)); c.dynasty.currentRulerId = "now";
    c.dynasty.houseEpochs![0].endMonth = month(3365, 5) - 1;
    c.dynasty.houseEpochs!.push({ houseName: "王氏", startMonth: month(3365, 5), foundingRulerId: "usurper", startReason: "USURPATION" });
    c.events = [event("usurp", "dynasty-usurped", month(3365, 5), { rulerId: "usurper" })];
    const s = text(c); console.info(`Unified fixture ACTIVE: ${s.length} characters`); expect(s).toContain("宋昭"); expect(s).toContain("王玄平篡朝"); expect(s).toContain("王君安承统"); expect(s).toContain("此段历23位统治者");
    expect(s).toContain("王氏仍在延续"); expect(s).not.toMatch(/彻底终结|王氏.*绝统|亡国/);
  });
  it.each(["MERGED", "SUBMITTED"] as const)("preserves %s as an administrative ending, not a death", reason => {
    const c = fixture(); c.faction.terminationReason = reason; c.faction.terminationTargetFactionId = "target";
    c.factions = new Map([...c.factions, ["target", { ...c.faction, name: "target", displayName: "今名", nameHistory: [{ name: "旧名", startMonth: 0, endMonth: month(590) }, { name: "今名", startMonth: month(590) + 1 }] }]]);
    c.dynasty.rulers[17].status = "abdicated"; c.dynasty.rulers[17].deathMonth = undefined; c.dynasty.rulers[17].deathReason = undefined;
    const s = text(c); expect(s).toContain(reason === "MERGED" ? "并入旧名（同源合邦）" : "纳土归附旧名"); expect(s).not.toContain("实际去世"); expect(s).not.toContain("战败覆灭");
  });
  it("does not invent a death for an unknown last ruler", () => { const c = fixture(); Object.assign(c.dynasty.rulers[17], { status: "politically-ended", deathMonth: undefined, deathReason: undefined }); expect(text(c)).not.toMatch(/实际去世|被杀|享年|宗亲死亡/); });
  it("handles a still-exiled dynasty without a terminal date or implied governance", () => {
    const c = fixture(); c.faction.status = "EXILED"; c.faction.terminationMonth = undefined; c.lifetime.terminal = undefined; c.dynasty.currentRulerId = "last";
    Object.assign(c.dynasty.rulers[17], { status: "exiled", endYear: undefined, deathMonth: undefined, deathReason: undefined });
    c.lifetime.lastObservedMonth = c.worldMonth;
    expect(text(c)).toContain("仍在流亡中延续"); expect(text(c)).not.toContain("彻底终结");
  });
  it("requires actual restoration rather than recovery of the old capital", () => {
    const c = fixture(); c.events = [...c.events, event("recover", "city-recovered", month(560), { cityName: "郢" })];
    expect(text(c)).not.toContain("复国");
    c.events = [...c.events, event("restore", "faction-restored", month(560), { cityName: "郢" })]; expect(text(c)).toContain("于郢复国");
  });
  it("keeps same-surname political stages and real usurpation proof separate", () => {
    const c = fixture(); c.dynasty.houseEpochs![0].endMonth = month(545, 9) - 1;
    c.dynasty.houseEpochs!.push({ houseName: "宋氏", startMonth: month(545, 9), foundingRulerId: "last", startReason: "RESTORATION" });
    expect(text(c)).toContain("复国后的政治阶段"); expect(build(c).phaseCount).toBe(2); expect(text(c)).not.toMatch(/同宗|篡朝|血脉/);
  });
  it("ordinary battles cannot crowd out late political changes or create an invented personal campaign", () => {
    const c = fixture(); c.events = [...c.events, ...Array.from({ length: 20000 }, (_, i) => event(`ordinary${i}`, "city-captured", month(190) + i % 100, { cityName: "普通城", rulerId: "unknown" }))];
    const s = text(c); expect(s).not.toContain("普通城"); expect(s).toContain("583年6月"); expect(s).not.toContain("亲征");
  });
  it("deduplicates capital loss and exile while keeping the later real political ending", () => {
    const s = text(); expect((s.match(/攻陷郢/g) ?? []).length).toBeLessThanOrEqual(1); expect(s).toContain("542年5月"); expect(s).toContain("583年6月");
  });
  it("does not mistake an indexed foreign event for an action by this country", () => {
    const c = fixture(); c.events = [...c.events, event("foreign", "emperor-proclaimed", month(400), { actorFactionId: "enemy", rulerId: "state-ruler", factionIds: ["f", "enemy"] })];
    expect(text(c)).not.toContain("称帝");
  });
  it("preserves historical names and a verified foreign siege actor rather than today's ruler", () => {
    const c = fixture(); c.faction.nameHistory[1].endMonth = month(580) - 1; c.faction.nameHistory.push({ name: "新国号", startMonth: month(580) });
    c.factions = new Map([...c.factions, ["enemy", { ...c.faction, name: "enemy", displayName: "今敌国", nameHistory: [{ name: "秦", startMonth: 0 }], sovereigntyHistory: [{ rank: "KING", startMonth: 0 }] }]]);
    c.events = c.events.map(e => e.id === "capture" ? { ...e, rulerId: "enemy-r" } : e);
    const foreign = ruler("enemy-r", "嬴氏", "康", month(530), month(550), 1);
    c.resolveRuler = (id, faction) => id === foreign.id && faction === "enemy" ? foreign : undefined;
    const s = text(c); expect(s).toContain("秦王嬴康亲征"); expect(s).toContain("沂失去最后据点");
    expect(s).not.toContain("新国号失去最后据点");
    foreign.accessionYear = month(580); expect(text(c)).not.toContain("嬴康亲征");
  });
  it("stays short for an unestablished force with scant evidence", () => {
    const c = fixture(); Object.assign(c.faction, { identityStage: "PROVISIONAL", stateFoundedMonth: undefined });
    c.faction.nameHistory = [{ name: "临沂义军", startMonth: month(154) }]; c.dynasty.rulers = c.dynasty.rulers.slice(0, 1);
    c.events = []; c.lifetime.peakTerritoryBlocks.value = 0;
    const a = build(c); expect(a.title).toBe("《临沂义军史》"); expect(a.length).toBeLessThan(220); expect(a.paragraphs.join("")).not.toMatch(/正式建国|称帝|亲征|复国/);
  });
  it("keeps a 100-phase history bounded, reporting all phases without a hundred rendered narratives", () => {
    const c = fixture(); c.worldMonth = 20000; c.faction.status = "ACTIVE"; c.faction.firstFoundedYear = 0; c.faction.terminationMonth = undefined; c.lifetime.terminal = undefined; c.lifetime.lastObservedMonth = 20000;
    c.dynasty.rulers = Array.from({ length: 100 }, (_, i) => ruler(`r${i}`, `姓${i}氏`, `君${i}`, i * 100, i === 99 ? undefined : (i + 1) * 100, i + 1));
    c.dynasty.houseEpochs = c.dynasty.rulers.map((r, i) => ({ houseName: r.houseName, startMonth: i * 100, endMonth: i === 99 ? undefined : (i + 1) * 100 - 1, foundingRulerId: r.id, startReason: i === 0 ? "FOUNDING" : "NATURAL_HOUSE_SUCCESSION" }));
    c.dynasty.currentRulerId = "r99"; const a = build(c); console.info(`Unified fixture 100 epochs: ${a.length} characters`); expect(a.phaseCount).toBe(100); expect(a.length).toBeLessThanOrEqual(1600); expect(a.paragraphs.length).toBeGreaterThan(1); expect(a.paragraphs.length).toBeLessThanOrEqual(8); expect(a.paragraphs.slice(0, -1).join("")).toContain("100段政治王统"); expect(a.paragraphs.at(-1)).toBe(a.argument?.text);
  });
  it("remains deterministic after V13 ruler round-trip without mutating canonical input/history or RNG", () => {
    const c = fixture(); build(c); const before = JSON.stringify(c), rng = worldRandom.exportState(); const first = buildUnifiedFactionChronicle(c);
    const restored = { ...c, dynasty: { ...c.dynasty, rulers: c.dynasty.rulers.map(r => importRulerSave(exportRulerSave(r))) } };
    expect(buildUnifiedFactionChronicle(restored)).toEqual(first); expect(JSON.stringify(c)).toBe(before); expect(worldRandom.exportState()).toEqual(rng); expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(15);
  });
});

describe("chronicle chapters, attributed names and evidence-bearing judgment", () => {
  const prose = (a: ReturnType<typeof build>) => a.paragraphs.slice(0, -1).join("");
  it("uses relative historical distance and political phases, not text length or fixed century boundaries", () => {
    const passage = (key: string, m: number): ChroniclePassage => ({ key, month: m, kind: "CAMPAIGN", order: 2, priority: 80, text: key });
    const separated = [passage("初次进取", 0), passage("再次进取", 12), passage("后代进取", 1200)];
    const a = composeChronicleParagraphs(separated, s => s, "仍在延续。", "阶段性评论。", false);
    expect(a).toHaveLength(3); expect(a[0]).toContain("再次进取"); expect(a[0]).not.toContain("后代进取"); expect(a[1]).toContain("后代进取");
    const scaled = separated.map(p => ({ ...p, month: p.month * 10 }));
    expect(composeChronicleParagraphs(scaled, s => s, "仍在延续。", "阶段性评论。", false)).toHaveLength(3);
    expect(composeChronicleParagraphs(separated.map(p => ({ ...p, month: 1200 })), s => s, "仍在延续。", "阶段性评论。", false)).toHaveLength(2);
  });
  it("groups the Yi onset, prosperity and exile into phases, then judges the real peak/loss/continuity chain", () => {
    const c = fixture(), a = build(c);
    expect(a.paragraphs.length).toBeGreaterThanOrEqual(4);
    expect(a.paragraphs[0]).toContain("154年1月"); expect(a.paragraphs[0]).toContain("186年2月");
    expect(a.paragraphs.at(-1)).toBe(a.argument!.text); expect(a.argument!.key).toBe("PEAK_LAND_AND_EXILE");
    expect(a.argument!.months).toEqual([month(493, 10), month(542, 5), month(583, 6)]);
    expect(a.argument!.eventIds).toEqual(["exile"]); expect(a.argument!.metricKeys).toContain("lifetime.peakTerritoryBlocks");
    expect(a.argument!.text).toContain("不足五十年"); expect(a.argument!.text).toContain("四十余载");
    expect(a.argument!.text).not.toMatch(/%|\d+年\d+月|归责末君|构成其可核实/);
    const dates = [...prose(a).matchAll(/(\d+)年(\d+)月/g)].map(m => month(Number(m[1]), Number(m[2])));
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });
  it("judges a long natural house and same-month political closure differently from a peak/exile history", () => {
    const c = fixture(); const last = c.dynasty.rulers[17]; last.houseName = "钱氏"; last.givenName = "翊";
    last.accessionYear = month(583, 6); last.status = "politically-ended"; last.deathMonth = undefined; last.deathReason = undefined;
    c.dynasty.houseEpochs![0].endMonth = month(583, 6) - 1;
    c.dynasty.houseEpochs!.push({ houseName: "钱氏", startMonth: month(583, 6), foundingRulerId: "last", startReason: "NATURAL_HOUSE_SUCCESSION" });
    const a = build(c); expect(a.argument!.key).toBe("LONG_HOUSE_SAME_MONTH_END");
    expect(a.paragraphs.at(-1)).toContain("钱翊自然接统"); expect(a.paragraphs.at(-1)).not.toContain("篡朝");
    expect(prose(a)).toMatch(/583年6月，[^。]*钱翊自然易姓续统；[^。]*政权彻底终结/);
    expect(prose(a)).not.toMatch(/0个月|同月.*同月|钱翊.*实际去世/);
  });
  function activeSplits() {
    const c = fixture(); c.faction.status = "ACTIVE"; c.faction.terminationMonth = undefined; c.lifetime.terminal = undefined;
    c.worldMonth = month(4000); c.lifetime.lastObservedMonth = c.worldMonth;
    c.dynasty.rulers.push({ ...ruler("usurper", "王氏", "玄平", month(3365, 5), month(3400), 19), relationType: "USURPER" }, ruler("now", "王氏", "君安", month(3400), undefined, 20));
    c.dynasty.currentRulerId = "now"; c.dynasty.houseEpochs![0].endMonth = month(3365, 5) - 1;
    c.dynasty.houseEpochs!.push({ houseName: "王氏", startMonth: month(3365, 5), foundingRulerId: "usurper", startReason: "USURPATION" });
    c.events = [2391, 2392, 2393].map(y => event(`split-${y}`, "empire-split", month(y), { actorFactionId: "other", targetFactionId: "f" }));
    c.events = [...c.events, event("usurp", "dynasty-usurped", month(3365, 5), { rulerId: "usurper" })]; return c;
  }
  it("uses directly related successive splits and later verified usurpation for a living nation's provisional judgment", () => {
    const c = activeSplits(), a = build(c);
    expect(a.argument!.key).toBe("SPLITS_AND_LATER_USURPATION"); expect(a.argument!.eventIds).toEqual(["split-2391", "split-2392", "split-2393", "usurp"]);
    for (const y of [2391, 2392, 2393]) expect(prose(a)).toContain(`${y}年1月`);
    expect(prose(a)).toContain("王玄平篡朝"); expect(prose(a)).toContain("王君安承统");
    expect(a.paragraphs.at(-1)).toContain("仍延续"); expect(a.paragraphs.at(-1)).not.toMatch(/终于|亡国|必将|导致|绝统/);
  });
  it("does not turn contemporary foreign splits into pressure or a cause of the nation's usurpation", () => {
    const c = activeSplits(); c.events = c.events.map(e => e.type === "empire-split" ? { ...e, targetFactionId: "foreign", factionIds: ["f", "foreign"] } : e);
    const a = build(c); expect(a.argument!.key).not.toBe("SPLITS_AND_LATER_USURPATION"); expect(prose(a)).not.toContain("2391年");
    expect(a.paragraphs.join("")).not.toMatch(/外部压力|导致篡朝|遭三次分裂/);
  });
  it("merges a real founding/split group only once and preserves a distinct same-month political fact", () => {
    const c = fixture(); c.events = [...c.events, event("found", "rebel-faction-founded", month(154), { historyGroupId: "founding", cityName: "临沂" }),
      event("split", "empire-split", month(154), { targetFactionId: "parent", historyGroupId: "founding" }),
      event("crown", "emperor-proclaimed", month(154), { rulerId: "founder", historyGroupId: "separate" })];
    const s = prose(build(c)); expect((s.match(/临沂义军[^。]*建立/g) ?? [])).toHaveLength(1);
    expect(s).toContain("在政权分裂之际于临沂建立"); expect(s).toContain("称帝"); expect(s).not.toMatch(/同月.*同月/);
  });
  it.each(["去世", "战死", "被俘处死"] as const)("uses the actual %s record and explicitly retrospective recorded titles", reason => {
    const c = fixture(); Object.assign(c.dynasty.rulers[17], { deathReason: reason, templeName: "思宗", posthumousEpithet: "愍" });
    const s = prose(build(c)); expect(s).toContain("沂王宋景怀（后谥愍，后世庙号思宗）");
    expect(s).toContain(reason === "去世" ? "宋景怀实际去世" : `宋景怀${reason}`);
    expect(s).not.toContain("沂愍王宋景怀亲征"); expect((s.match(/后谥愍/g) ?? [])).toHaveLength(1);
  });
  it("does not borrow a living ruler's invalid future epithet or invent one for a ruler without an award", () => {
    const c = activeSplits(); Object.assign(c.dynasty.rulers.at(-1)!, { templeName: "太宗", posthumousEpithet: "武", naturalDeathYear: month(4100) });
    const s = prose(build(c)); expect(s).not.toMatch(/太宗|后谥武|武王/); expect(s).toContain("王君安承统");
    Object.assign(c.dynasty.rulers.at(-1)!, { deathMonth: month(4100), deathReason: "去世" });
    expect(prose(build(c))).not.toContain("后谥武");
  });
  it("does not use titles or actual death language for political end with unknown life status", () => {
    const c = fixture(); Object.assign(c.dynasty.rulers[17], { status: "politically-ended", deathMonth: undefined, deathReason: undefined, templeName: "思宗", posthumousEpithet: "愍" });
    expect(prose(build(c))).not.toMatch(/后谥|后世庙号|实际去世|战死|被俘处死/);
  });
  it("keeps a verified foreign siege actor and historical rank, without attributing a foreign person to this dynasty", () => {
    const c = fixture(); const foreign = ruler("foreign-r", "嬴氏", "康", month(530), month(550), 1);
    Object.assign(foreign, { status: "dead", deathMonth: month(550), deathReason: "战死", posthumousEpithet: "武" });
    c.factions = new Map([...c.factions, ["enemy", { ...c.faction, name: "enemy", nameHistory: [{ name: "秦", startMonth: 0 }], sovereigntyHistory: [{ rank: "KING", startMonth: 0 }] }]]);
    c.resolveRuler = (id, faction) => id === foreign.id && faction === "enemy" ? foreign : undefined;
    c.events = c.events.map(e => e.id === "capture" ? { ...e, rulerId: foreign.id } : e);
    const a = build(c); expect(prose(a)).toContain("秦王嬴康（后谥武）亲征"); expect(prose(a)).not.toContain("沂王嬴康");
    foreign.accessionYear = month(543); expect(prose(build(c))).not.toContain("嬴康");
  });
  it("does not borrow another city or its ruler from a shared history group", () => {
    const c = fixture(); const foreign = ruler("foreign-r", "嬴氏", "康", month(530), month(550), 1);
    c.factions = new Map([...c.factions, ["enemy", { ...c.faction, name: "enemy", nameHistory: [{ name: "秦", startMonth: 0 }] }]]);
    c.resolveRuler = id => id === foreign.id ? foreign : undefined;
    c.events = c.events.filter(e => e.id !== "capture");
    c.events = [...c.events, event("other-city", "capital-fallen", month(542, 5), {
      actorFactionId: "enemy", targetFactionId: "f", historyGroupId: "fall", cityId: "other", cityName: "新郑", rulerId: foreign.id })];
    const a = build(c); const body = prose(a);
    expect(body).toContain("攻陷沂都新郑"); expect(body).toContain("攻陷郢");
    expect(body).not.toMatch(/嬴康[^。；]*攻陷郢/);
    expect(a.eventIds).toContain("other-city"); expect(a.eventIds).toContain("exile");
  });
  it("retains a real restoration in the narrative and judges restored rule, not recovery of a capital", () => {
    const c = fixture(); c.lifetime.peakTerritoryBlocks.value = 0;
    c.events = [...c.events, event("restore", "faction-restored", month(560), { cityName: "郢" })];
    const a = build(c); expect(a.argument!.key).toBe("REAL_RESTORATION"); expect(a.argument!.eventIds).toEqual(["restore"]);
    expect(prose(a)).toContain("于郢复国"); expect(a.paragraphs.at(-1)).toContain("从流亡回到在国承统");
    c.events = c.events.map(e => e.id === "restore" ? { ...e, type: "city-recovered" as const } : e);
    expect(build(c).argument!.key).not.toBe("REAL_RESTORATION");
  });
  it.each(["MERGED", "SUBMITTED"] as const)("does not turn %s into warfare or death even with earlier lost capitals", reason => {
    const c = fixture(); c.faction.terminationReason = reason; c.faction.terminationTargetFactionId = "target";
    c.factions = new Map([...c.factions, ["target", { ...c.faction, name: "target", nameHistory: [{ name: "董", startMonth: 0 }] }]]);
    Object.assign(c.dynasty.rulers[17], { status: "abdicated", deathMonth: undefined, deathReason: undefined });
    const a = build(c); expect(a.argument!.key).toBe(reason); expect(a.paragraphs.at(-1)).not.toMatch(/战败|被杀|流亡所留下|无土而续/);
    expect(prose(a)).not.toContain("实际去世"); expect(prose(a)).toContain(reason === "MERGED" ? "同源合邦" : "纳土归附");
  });
  it("derives meaningful attack/defense reversal from two distinct roles rather than duplicated city metadata", () => {
    const c = fixture(); c.lifetime.peakTerritoryBlocks.value = 0;
    c.events = [event("attack", "capital-fallen", month(200), { targetFactionId: "other", cityName: "大梁", cityId: "daliang" }), ...c.events];
    const a = build(c); expect(a.argument!.key).toBe("ATTACK_DEFENSE_REVERSAL"); expect(a.argument!.eventIds).toEqual(["attack", "capture"]);
    expect(a.paragraphs.at(-1)).toContain("大梁"); expect(a.paragraphs.at(-1)).toContain("郢"); expect(a.paragraphs.at(-1)).not.toMatch(/报仇|复仇|因果报应/);
  });
  it("keeps an open exile's argument explicitly provisional and preserves separate prose across V13 ruler round-trip", () => {
    const c = fixture(); c.faction.status = "EXILED"; c.faction.terminationMonth = undefined; c.lifetime.terminal = undefined; c.lifetime.lastObservedMonth = c.worldMonth;
    c.dynasty.currentRulerId = "last"; Object.assign(c.dynasty.rulers[17], { status: "exiled", endYear: undefined, deathMonth: undefined, deathReason: undefined });
    const a = build(c); expect(a.paragraphs.at(-1)).toContain("截至此时"); expect(prose(a)).not.toContain("彻底终结");
    const before = JSON.stringify(c), rng = worldRandom.exportState();
    const loaded = { ...c, dynasty: { ...c.dynasty, rulers: c.dynasty.rulers.map(r => importRulerSave(exportRulerSave(r))) } };
    expect(buildUnifiedFactionChronicle(loaded)).toEqual(a); expect(JSON.stringify(c)).toBe(before); expect(worldRandom.exportState()).toEqual(rng);
  });
});
