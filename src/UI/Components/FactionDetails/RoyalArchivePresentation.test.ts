import { describe, expect, it } from "vitest";
import { deriveHouseAssessments, type HouseHistoryContext } from "../../../Historiography/DynastyHouseHistoriography";
import type { Ruler } from "../../../Politics/Dynasty";
import { createRulerChronicle } from "../../../Politics/RulerChronicle";
import { exportRulerSave, importRulerSave } from "../../../Persistence/RulerSaveProjection";
import worldRandom from "../../../Simulation/WorldRandom";
import { formatHouseOpening, formatHouseRange, getHouseArchiveSummary, getHouseStateFounder, houseStates } from "./RoyalArchivePresentation";
const ruler = (id: string, house: string, start: number, end: number | undefined, ordinal: number): Ruler => ({
  id, houseName: house, givenName: id, bornYear: start - 300, accessionYear: start, endYear: end,
  reignOrdinal: ordinal, status: end === undefined ? "ruling" : "politically-ended",
  chronicle: createRulerChronicle({ month: start, population: 1, cityCount: 1, territoryShare: .1, stability: 60 }),
});
function fixture(): HouseHistoryContext {
  return { faction: { name: "f", displayName: "郸", status: "EXTINCT", color: 1, stateFoundedMonth: 1827 * 12,
    terminationMonth: 2466 * 12 + 10, terminationReason: "EXTINCT" }, factions: new Map(), worldMonth: 2500 * 12, events: [],
    dynasty: { factionId: "f", currentRulerId: null, houseEpochs: [
      { houseName: "萧氏", startMonth: 1796 * 12, endMonth: 2466 * 12 + 9, foundingRulerId: "开", startReason: "FOUNDING" },
      { houseName: "钱氏", startMonth: 2466 * 12 + 10, foundingRulerId: "继", startReason: "NATURAL_HOUSE_SUCCESSION" }],
    rulers: [ruler("开", "萧氏", 1796 * 12, 2466 * 12 + 10, 1), ruler("继", "钱氏", 2466 * 12 + 10, 2466 * 12 + 10, 2)] } };
}
describe("royal archive concise presentation, without new facts", () => {
  it("describes a same-month natural succession/terminal phase without fabricating a duration", () => {
    const c = fixture(), [old, latest] = deriveHouseAssessments(c);
    expect(formatHouseRange(latest)).toBe("2466年11月开始并于同月终结");
    expect(latest.endMonth! - latest.startMonth).toBe(0);
    expect(formatHouseOpening(latest)).toBe("自然易姓续统");
    expect(getHouseArchiveSummary(old, latest, 2).join("")).toContain("钱氏承接王统，本国建制继续");
    expect(getHouseArchiveSummary(latest, undefined, 2).join("")).not.toMatch(/篡朝|萧氏|1827|享年|死亡/);
    expect(old.rulerIds).toEqual(["开"]); expect(latest.rulerIds).toEqual(["继"]);
    expect(getHouseStateFounder(latest, c.dynasty.rulers)).toBeUndefined();
    expect(getHouseStateFounder(old, c.dynasty.rulers)?.name).toBe("萧开");
  });
  it("keeps single-house text to one transmission conclusion and leaves the national account out", () => {
    const c = fixture(); c.dynasty.houseEpochs = c.dynasty.houseEpochs!.slice(0, 1); c.dynasty.houseEpochs[0].endMonth = undefined;
    const p = deriveHouseAssessments(c)[0]; const summary = getHouseArchiveSummary(p);
    expect(summary).toHaveLength(1); expect(summary.join("")).not.toMatch(/疆域|迁都|失守|史家曰|实际死亡另载|宗亲全部死亡|国家事实/);
  });
  it("uses a holder present at state foundation, not a later ruler", () => {
    const c = fixture(), p = deriveHouseAssessments(c)[0];
    expect(getHouseStateFounder(p, c.dynasty.rulers)).toEqual({ month: 1827 * 12, name: "萧开" });
    c.dynasty.rulers[0].endYear = 1826 * 12;
    expect(getHouseStateFounder(p, c.dynasty.rulers)).toEqual({ month: 1827 * 12, name: undefined });
  });
  it("does not assign an ambiguous boundary-month founder without ruler evidence", () => {
    const c = fixture(); c.faction.stateFoundedMonth = 2466 * 12 + 10;
    const [old, latest] = deriveHouseAssessments(c);
    expect(getHouseStateFounder(old, c.dynasty.rulers)).toBeUndefined();
    expect(getHouseStateFounder(latest, c.dynasty.rulers)?.name).toBe("钱继");
  });
  it("uses true usurpation proof rather than a changed house name", () => {
    const c = fixture(); c.dynasty.houseEpochs![1].startReason = "USURPATION";
    expect(formatHouseOpening(deriveHouseAssessments(c)[1])).not.toContain("篡朝");
    c.dynasty.rulers[1].relationType = "USURPER";
    const p = deriveHouseAssessments(c)[1];
    expect(formatHouseOpening(p)).toContain("篡朝"); expect(getHouseArchiveSummary(p, undefined, 2)[0]).toContain("钱继以篡朝");
  });
  it("preserves same-house restoration as a separate political phase without invented bloodline", () => {
    const c = fixture(); c.dynasty.houseEpochs![1].houseName = "萧氏"; c.dynasty.houseEpochs![1].startReason = "RESTORATION"; c.dynasty.rulers[1].houseName = "萧氏";
    const p = deriveHouseAssessments(c);
    expect(p).toHaveLength(2); expect(p[0].key).not.toBe(p[1].key);
    expect(getHouseArchiveSummary(p[1], undefined, 2).join("")).toContain("复国");
    expect(getHouseArchiveSummary(p[1], undefined, 2).join("")).not.toMatch(/同宗|血脉|篡朝/);
  });
  it.each(["ACTIVE", "EXILED"])("retains an actual current ruler in %s without a premature ending", status => {
    const c = fixture(); Object.assign(c.faction, { status, terminationMonth: undefined });
    c.dynasty.currentRulerId = "继"; c.dynasty.rulers[1].status = status === "ACTIVE" ? "ruling" : "exiled"; c.dynasty.rulers[1].endYear = undefined;
    const p = deriveHouseAssessments(c)[1];
    expect(p.currentRulerName).toBe("钱继"); expect(houseStates[p.status]).toContain("尚在延续");
    expect(getHouseArchiveSummary(p, undefined, 2).join("")).not.toMatch(/终结|末世|绝统|死亡/);
  });
  it.each(["MERGED", "SUBMITTED"] as const)("retains peaceful %s ending without calling it a death", terminationReason => {
    const c = fixture(); c.faction.terminationReason = terminationReason; c.dynasty.rulers[1].status = "abdicated";
    const p = deriveHouseAssessments(c)[1], summary = getHouseArchiveSummary(p).join("");
    expect(summary).toContain(terminationReason === "MERGED" ? "同源合邦" : "纳土退位"); expect(summary).not.toMatch(/战败|战死|灭亡|死亡/);
  });
  it("same-month recorded death does not turn political closure into an asserted biological cause", () => {
    const c = fixture(); Object.assign(c.dynasty.rulers[1], { status: "dead", deathMonth: c.faction.terminationMonth, deathReason: "去世" });
    const p = deriveHouseAssessments(c)[1]; expect(p.terminalDeathSameMonth).toBe(true);
    expect(getHouseArchiveSummary(p).join("")).not.toMatch(/死亡|去世|享年|宗亲/);
  });
  it("retains concise V13-derived output with identical canonical input, events and RNG", () => {
    const c = fixture(), before = JSON.stringify(c), rng = worldRandom.exportState();
    const project = (ctx: HouseHistoryContext) => deriveHouseAssessments(ctx).map((p, i, all) => ({
      range: formatHouseRange(p), summary: getHouseArchiveSummary(p, all[i + 1], all.length), founder: getHouseStateFounder(p, ctx.dynasty.rulers) }));
    const first = project(c), reloaded = { ...c, dynasty: { ...c.dynasty, rulers: c.dynasty.rulers.map(r => importRulerSave(exportRulerSave(r))) } };
    expect(project(reloaded)).toEqual(first); expect(JSON.stringify(c)).toBe(before); expect(worldRandom.exportState()).toEqual(rng);
  });
});
