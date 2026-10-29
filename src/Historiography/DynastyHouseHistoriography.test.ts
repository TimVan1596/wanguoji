import { describe, expect, it } from "vitest";
import type { Ruler, Dynasty } from "../Politics/Dynasty";
import type { WorldEvent } from "../History/WorldHistory";
import { createRulerChronicle } from "../Politics/RulerChronicle";
import { deriveHouseAssessments, type HouseHistoryContext } from "./DynastyHouseHistoriography";
import { exportRulerSave, importRulerSave } from "../Persistence/RulerSaveProjection";
import worldRandom from "../Simulation/WorldRandom";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";
const ruler = (id: string, accession: number, end: number | undefined, ordinal: number, houseName = "宋氏"): Ruler => ({
  id, houseName, givenName: id, bornYear: accession - 360, accessionYear: accession, endYear: end,
  politicalEndYear: end, reignOrdinal: ordinal, status: end === undefined ? "ruling" : "politically-ended",
  endReason: end === undefined ? undefined : "政治终结", chronicle: createRulerChronicle({ month: accession, population: 2, cityCount: 1, territoryShare: .1, stability: 70 }),
});
const event = (id: string, type: WorldEvent["type"], month: number, extra: Partial<WorldEvent> = {}): WorldEvent => ({
  id, type, monthIndex: month, year: month, title: id, category: "politics", importance: "major", actorFactionId: "f", factionIds: ["f"], ...extra,
});
function fixture(): HouseHistoryContext {
  return { worldMonth: 100, faction: { name: "f", displayName: "今国", color: 1, status: "ACTIVE", stateFoundedMonth: 20,
    nameHistory: [{ name: "旧义军", startMonth: 0, endMonth: 19 }, { name: "旧国", startMonth: 20, endMonth: 59 }, { name: "今国", startMonth: 60 }] },
    factions: new Map(), events: [], dynasty: { factionId: "f", currentRulerId: "b", rulers: [ruler("a", 0, 30, 1), ruler("b", 30, undefined, 2)],
      houseEpochs: [{ houseName: "宋氏", startMonth: 0, foundingRulerId: "a", startReason: "FOUNDING" }] } };
}
const text = (c: HouseHistoryContext) => deriveHouseAssessments(c).map(p => p.assessment.join("") + p.voice).join("");
describe("political house epoch assessment", () => {
  it("distinguishes the 18 holders and 17 formal-era rulers of a long inherited-exile history", () => {
    const c = fixture(), start = 154 * 12, state = 186 * 12 + 1, end = 583 * 12 + 5;
    c.worldMonth = end + 12; Object.assign(c.faction, { status: "EXTINCT", stateFoundedMonth: state, terminationMonth: end, terminationReason: "EXTINCT" });
    c.dynasty.houseEpochs![0].startMonth = start;
    c.dynasty.rulers = Array.from({ length: 18 }, (_, i) => ruler(i === 1 ? "宋景" : i === 17 ? "宋景怀" : `君${i}`, i === 0 ? start : i === 1 ? 185 * 12 : i === 17 ? 545 * 12 + 8 : (190 + (i - 2) * 22) * 12,
      i === 0 ? 185 * 12 : i === 1 ? 190 * 12 : i === 17 ? end : (190 + (i - 1) * 22) * 12, i + 1));
    c.dynasty.houseEpochs![0].foundingRulerId = c.dynasty.rulers[0].id;
    c.dynasty.currentRulerId = null;
    Object.assign(c.dynasty.rulers[17], { status: "dead", deathMonth: end, deathReason: "去世", endReason: "去世" });
    c.events = [event("state", "state-founded", state, { rulerId: "宋景" }), event("move", "capital-relocated", 318 * 12 + 6, { cityName: "郢" }),
      event("exile", "faction-exiled", 542 * 12 + 4, { actorFactionId: "enemy", targetFactionId: "f", cityName: "郢" }),
      event("end", "faction-extinct", end, { targetFactionId: "f" })];
    const p = deriveHouseAssessments(c)[0];
    expect(p).toMatchObject({ rulerCount: 18, formalRulerCount: 17, startMonth: start, endMonth: end, status: "EXTINCT" });
    expect(p.assessment.join("")).toContain("186年2月"); expect(p.assessment.join("")).toContain("郢");
    expect(p.assessment.join("")).not.toContain("154年1月正式建国");
    expect(p.terminalDeathSameMonth).toBe(true); expect(p.assessment.join("")).toContain("实际死亡另载于同月");
    expect(p.voice).toContain("流亡之统犹续"); expect(p.voice).not.toMatch(/宋景怀.*造成|宗亲全部死亡|享年/);
    expect(c.dynasty.rulers[17].deathMonth).toBe(end);
  });
  it.each(["NATURAL_HOUSE_SUCCESSION", "USURPATION"] as const)("separates same-month holders at %s", reason => {
    const c = fixture(); c.dynasty.rulers[0].endYear = 30;
    c.dynasty.rulers[1].houseName = "乙氏";
    c.dynasty.rulers[1].relationType = reason === "USURPATION" ? "USURPER" : "NEW_HOUSE";
    c.dynasty.houseEpochs![0].endMonth = 29;
    c.dynasty.houseEpochs!.push({ houseName: "乙氏", startMonth: 30, foundingRulerId: "b", startReason: reason });
    if (reason === "USURPATION") c.events = [...c.events, event("usurp", "dynasty-usurped", 30, { rulerId: "b" })];
    const [old, next] = deriveHouseAssessments(c);
    expect(old.rulerIds).toEqual(["a"]); expect(next.rulerIds).toEqual(["b"]);
    expect(old.status).toBe("REPLACED"); expect(next.status).toBe("CONTINUING");
    expect(next.usurpationProven).toBe(reason === "USURPATION");
    expect(old.assessment.join("")).toContain("国家历史并未因此终止");
    if (reason === "NATURAL_HOUSE_SUCCESSION") expect(text(c)).not.toMatch(/篡朝|夺统/);
  });
  it("keeps a same-surname restoration phase distinct from an imagined new bloodline", () => {
    const c = fixture(); c.dynasty.rulers[0].endYear = 30;
    c.dynasty.houseEpochs![0].endMonth = 29;
    c.dynasty.houseEpochs!.push({ houseName: "宋氏", startMonth: 30, foundingRulerId: "b", startReason: "RESTORATION" });
    c.events = [event("exile", "faction-exiled", 10, { targetFactionId: "f" }), event("restore", "faction-restored", 30, { rulerId: "b" })];
    const p = deriveHouseAssessments(c);
    expect(p).toHaveLength(2); expect(p[0].rulerIds).toEqual(["a"]); expect(p[1].rulerIds).toEqual(["b"]);
    expect(p[1].assessment.join("")).toContain("新的政治阶段");
    expect(text(c)).not.toMatch(/血脉相认|兄弟王室|全新家族/);
  });
  it("counts real repeated exile/restoration and never uses recovery of a city as restoration", () => {
    const c = fixture(); c.events = [event("x1", "faction-exiled", 5, { targetFactionId: "f" }), event("r1", "faction-restored", 10),
      event("x2", "faction-exiled", 40, { targetFactionId: "f" }), event("r2", "faction-restored", 50), event("city", "city-recovered", 80)];
    expect(text(c)).toContain("流亡2次、复国2次");
    c.events = [event("city", "city-recovered", 80)]; expect(text(c)).not.toContain("复国");
  });
  it.each(["MERGED", "SUBMITTED"] as const)("distinguishes %s retirement from extinction and death", ending => {
    const c = fixture(); Object.assign(c.faction, { status: "EXTINCT", terminationMonth: 90, terminationReason: ending });
    Object.assign(c.dynasty.rulers[1], { endYear: 90, status: "abdicated", endReason: ending === "MERGED" ? "合邦退位" : "纳土退位" });
    c.dynasty.currentRulerId = null;
    c.factions = new Map([["receiver", { name: "receiver", displayName: "后来名", color: 2, nameHistory: [{ name: "当时名", startMonth: 0, endMonth: 100 }, { name: "后来名", startMonth: 101 }] }]]);
    c.events = [event("admin", ending === "MERGED" ? "faction-merged" : "faction-submitted", 90, { metadata: ending === "MERGED" ?
      { absorbedFactionId: "f", absorbingFactionId: "receiver", absorbedRulerId: "b" } : { submittedFactionId: "f", receivingFactionId: "receiver", submittedRulerId: "b" } })];
    const p = deriveHouseAssessments(c)[0]; expect(p.status).toBe(ending); expect(text(c)).toContain("当时名");
    expect(text(c)).not.toMatch(/战败|战死|被杀|后来名/); expect(c.dynasty.rulers[1].deathMonth).toBeUndefined();
  });
  it("does not conclude an active or exiled phase's future", () => {
    const c = fixture(); expect(deriveHouseAssessments(c)[0].currentRulerName).toContain("b");
    expect(text(c)).not.toMatch(/已覆灭|最终绝统|亡国|末世/);
    c.faction.status = "EXILED"; expect(deriveHouseAssessments(c)[0].status).toBe("EXILED"); expect(text(c)).toContain("尚不能作最终结语");
  });
  it("does not infer usurpation from a surname change without explicit evidence", () => {
    const c = fixture(); c.dynasty.houseEpochs![0].startReason = "USURPATION";
    expect(deriveHouseAssessments(c)[0].usurpationProven).toBe(false); expect(text(c)).not.toContain("篡朝");
  });
  it("verifies faction, ID, role and tenure; does not attribute an opponent's ruler to the defended house", () => {
    const c = fixture(); c.events = [event("foreign", "emperor-proclaimed", 40, { rulerId: "foreigner" }),
      event("wrong", "state-founded", 60, { rulerId: "a" }), event("attack", "capital-fallen", 50, { actorFactionId: "enemy", targetFactionId: "f", rulerId: "foreigner", cityName: "郢" })];
    const m = deriveHouseAssessments(c)[0].milestones; expect(m.map(x => x.eventId)).toEqual(["attack"]); expect(m[0].rulerId).toBeUndefined();
  });
  it("uses historical names and cannot call a provisional phase a formal kingdom", () => {
    const c = fixture(); c.events = [event("state", "state-founded", 20, { rulerId: "a" }), event("emperor", "emperor-proclaimed", 80, { rulerId: "b" })];
    const m = deriveHouseAssessments(c)[0].milestones; expect(m[0].text).toContain("旧国");
    c.faction.stateFoundedMonth = undefined; c.events = [];
    expect(deriveHouseAssessments(c)[0].formalRulerCount).toBe(0); expect(text(c)).not.toMatch(/王朝国祚|正式建国|历.*帝/);
  });
  it("excludes heirs and kin, tolerates missing evidence and never deduces family death", () => {
    const c = fixture(); c.dynasty.rulers.push({ ...ruler("heir", 0, undefined, 3), reignOrdinal: undefined, status: "heir" });
    expect(deriveHouseAssessments(c)[0].rulerCount).toBe(2);
    c.dynasty.rulers = []; expect(deriveHouseAssessments(c)[0].founderName).toBeUndefined(); expect(text(c)).not.toContain("篡朝");
  });
  it("keeps a grouped last-city fall as one turning point and a decades-later extinction separate", () => {
    const c = fixture(); Object.assign(c.faction, { status: "EXTINCT", terminationMonth: 100, terminationReason: "EXTINCT" });
    c.events = [event("capital", "capital-fallen", 50, { targetFactionId: "f", historyGroupId: "fall", cityName: "郢" }),
      event("exile", "faction-exiled", 50, { targetFactionId: "f", historyGroupId: "fall", cityName: "郢" }),
      event("end", "faction-extinct", 100, { targetFactionId: "f" })];
    expect(deriveHouseAssessments(c)[0].milestones.map(m => m.eventId)).toEqual(["exile", "end"]);
  });
  it.each([30, 31])("attributes contiguous/shared boundary month %i without double counting predecessor and successor", boundary => {
    const c = fixture(); c.dynasty.houseEpochs![0].endMonth = 30;
    Object.assign(c.dynasty.rulers[1], { accessionYear: boundary, houseName: "乙氏" });
    c.dynasty.houseEpochs!.push({ houseName: "乙氏", startMonth: boundary, foundingRulerId: "b", startReason: "NATURAL_HOUSE_SUCCESSION" });
    const p = deriveHouseAssessments(c); expect(p[0].rulerIds).toEqual(["a"]); expect(p[1].rulerIds).toEqual(["b"]);
    expect(p[0].transitionMonth).toBe(boundary);
  });
  it("allows one real holder across a recorded restoration phase without creating a new person or family", () => {
    const c = fixture(); c.dynasty.rulers = [ruler("a", 0, undefined, 1)]; c.dynasty.currentRulerId = "a";
    c.dynasty.houseEpochs![0].endMonth = 29;
    c.dynasty.houseEpochs!.push({ houseName: "宋氏", startMonth: 30, foundingRulerId: "a", startReason: "RESTORATION" });
    c.events = [event("restore", "faction-restored", 30, { rulerId: "a" })];
    const p = deriveHouseAssessments(c); expect(p).toHaveLength(2); expect(p.every(x => x.rulerIds.length === 1 && x.rulerIds[0] === "a")).toBe(true);
    expect(c.dynasty.rulers).toHaveLength(1); expect(text(c)).not.toMatch(/全新血缘|兄弟王室/);
  });
  it("does not extend an explicitly closed final epoch to a later national termination", () => {
    const c = fixture(); c.dynasty.houseEpochs![0].endMonth = 75;
    Object.assign(c.faction, { status: "EXTINCT", terminationMonth: 100, terminationReason: "EXTINCT" });
    const p = deriveHouseAssessments(c)[0]; expect(p.endMonth).toBe(75); expect(p.status).toBe("ENDED");
    expect(p.terminalRulerName).toBeUndefined();
  });
  it("does not mutate canonical history, RNG or V13 DTO and is identical after JSON round-trip", () => {
    const c = fixture(), before = JSON.stringify(c.dynasty), history = JSON.stringify(c.events), rng = worldRandom.exportState();
    const expected = deriveHouseAssessments(c);
    const restored = { ...c, dynasty: JSON.parse(before) as Dynasty };
    restored.dynasty.rulers = c.dynasty.rulers.map(r => importRulerSave(JSON.parse(JSON.stringify(exportRulerSave(r)))));
    expect(deriveHouseAssessments(restored)).toEqual(expected); expect(deriveHouseAssessments(c)).toEqual(expected);
    expect(JSON.stringify(c.dynasty)).toBe(before); expect(JSON.stringify(c.events)).toBe(history); expect(worldRandom.exportState()).toEqual(rng);
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(31);
  });
  it("keeps 100 phases and 20k indexed events bounded without rendering or storing another event database", () => {
    const c = fixture(); c.worldMonth = 10000;
    c.dynasty.rulers = Array.from({ length: 100 }, (_, i) => ruler(`r${i}`, i * 100, i === 99 ? undefined : (i + 1) * 100, i + 1, `氏${i}`));
    c.dynasty.houseEpochs = c.dynasty.rulers.map((r, i) => ({ houseName: r.houseName, startMonth: i * 100, endMonth: i === 99 ? undefined : (i + 1) * 100 - 1, foundingRulerId: r.id, startReason: "NATURAL_HOUSE_SUCCESSION" }));
    c.events = Array.from({ length: 20000 }, (_, i) => event(`city${i}`, "city-captured", i % 10000));
    const p = deriveHouseAssessments(c); expect(p).toHaveLength(100); expect(p.every(x => x.milestones.length <= 3 && x.assessment.length <= 3)).toBe(true);
  });
});
