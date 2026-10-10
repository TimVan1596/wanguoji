import { describe, expect, it } from "vitest";
import type { Ruler } from "./Dynasty";
import type { WorldEvent } from "../History/WorldHistory";
import { buildRulerTags, createRulerChronicle, finishRulerChronicle } from "./RulerChronicle";
import { composeHistorianVoice, deriveRulerAssessment, type RulerHistoriographyContext } from "./RulerHistoriography";
import { exportRulerSave, importRulerSave } from "../Persistence/RulerSaveProjection";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";
import worldRandom from "../Simulation/WorldRandom";

const event = (type: WorldEvent["type"], month: number, factionId = "沂"): WorldEvent => ({
  id: `${type}-${month}-${factionId}`, type, year: month, monthIndex: month,
  category: "politics", title: type, importance: "major", factionIds: [factionId],
  ...(type === "faction-restored" ? { actorFactionId: factionId } : { targetFactionId: factionId }),
});
function context(total: number, active: number, terminal = false): RulerHistoriographyContext {
  const start = 100, end = start + total;
  const snapshot = (month: number) => ({ month, population: 0, territoryShare: 0, cityCount: 0, stability: 0 });
  const chronicle = createRulerChronicle(snapshot(start));
  finishRulerChronicle(chronicle, snapshot(end), "去世");
  const ruler: Ruler = { id: "沂-ruler-18", houseName: "宋氏", givenName: "景怀", reignOrdinal: 18,
    bornYear: start - 35 * 12, accessionYear: start, endYear: end, politicalEndYear: end,
    status: "dead", endReason: "去世", deathMonth: end, deathReason: "去世", chronicle };
  return { ruler, dynasty: { rulers: [ruler] }, faction: { name: "沂", stateFoundedMonth: 0 },
    events: active < total ? [event("faction-exiled", active === 0 ? start - 1 : start + active),
      ...(terminal ? [event("faction-extinct", end)] : [])] : [], worldMonth: end + 600 };
}
const result = (ctx: RulerHistoriographyContext) => {
  const assessment = deriveRulerAssessment(ctx);
  return { evidence: assessment.evidence, tags: buildRulerTags(assessment.evidence),
    assessment: assessment.lines.join(""), voice: composeHistorianVoice(assessment.evidence) };
};

describe("tenure and historical role integrity", () => {
  it("keeps all 453 months of inherited exile without assigning short reign or governance", () => {
    const actual = result(context(453, 0, true));
    expect(actual.evidence.tenure).toMatchObject({ totalTenureMonths: 453, activeRuleMonths: 0,
      exileMonths: 453, exiledAtAccession: true, diedInExile: true, extinctInExile: true });
    expect(actual.evidence.roles).toEqual(expect.arrayContaining(["LONG_EXILE", "LAST_RULER"]));
    expect(actual.evidence.roles).not.toContain("SHORT_REIGN");
    expect(actual.tags).toContain("流亡"); expect(actual.tags).not.toContain("短祚");
    expect(actual.assessment).toContain("全部承统岁月均在流亡");
    expect(actual.assessment).toContain("王统政治终结");
    expect(actual.voice).toContain("无一月在国治理");
    expect(actual.voice).toContain("王统终结");
    expect(actual.assessment + actual.voice).not.toMatch(/短祚|在位不足五年|身后最重要的遗留|其一生|终其一生/);
  });
  it.each([3, 60])("recognizes genuinely brief tenure of %i months including the five-year boundary", months => {
    const actual = result(context(months, months));
    expect(actual.evidence.tenure.totalTenureMonths).toBe(months);
    expect(actual.evidence.roles).toContain("SHORT_REIGN"); expect(actual.tags).toContain("短祚");
    expect(actual.assessment).toContain("承统不超过五年");
    expect(actual.voice).toMatch(/短|有限|未久|不长/);
  });
  it.each([[62, 22], [400, 22]])("does not confuse %i months of tenure with %i months in-country", (total, active) => {
    const actual = result(context(total, active));
    expect(actual.evidence.tenure).toMatchObject({ totalTenureMonths: total, activeRuleMonths: active, exileMonths: total - active });
    expect(actual.evidence.roles).not.toContain("SHORT_REIGN"); expect(actual.tags).not.toContain("短祚");
    expect(actual.assessment + actual.voice).not.toMatch(/不足五年|短祚|全部承统岁月|无一月/);
    if (total === 400) expect(actual.evidence.roles).toContain("LONG_EXILE");
  });
  it("does not turn thirty years in-country and two in exile into a full-exile or short reign", () => {
    const actual = result(context(384, 360));
    expect(actual.evidence.tenure).toMatchObject({ totalTenureMonths: 384, activeRuleMonths: 360, exileMonths: 24 });
    expect(actual.evidence.roles).not.toContain("SHORT_REIGN");
    expect(actual.evidence.roles).not.toContain("LONG_EXILE");
    expect(actual.evidence.roles).not.toContain("LAST_RULER");
    expect(actual.assessment + actual.voice).not.toMatch(/全部承统岁月|无一月|亡国之君/);
  });
  it("does not infer the last ruler from an exile death followed by legitimate succession and restoration", () => {
    const ctx = context(453, 0);
    const successor = { ...ctx.ruler, id: "successor", reignOrdinal: 19, predecessorId: ctx.ruler.id,
      accessionYear: ctx.ruler.endYear!, endYear: undefined, politicalEndYear: undefined,
      status: "ruling" as const, deathMonth: undefined, deathReason: undefined, endReason: undefined };
    ctx.dynasty.rulers.push(successor);
    ctx.events.push(event("faction-restored", ctx.ruler.endYear! + 120));
    const actual = result(ctx);
    expect(actual.evidence.tenure.diedInExile).toBe(true);
    expect(actual.evidence.roles).toContain("LONG_EXILE");
    expect(actual.evidence.roles).not.toContain("LAST_RULER");
    expect(actual.evidence.terminalCollapse).toBe(false);
    expect(actual.assessment + actual.voice).not.toMatch(/王统政治终结|王统终结于此|亡国之君|王统未绝是其身后/);
  });
  it("attributes a same-month terminal event only to the final holder, not his deceased predecessor", () => {
    const ctx = context(453, 0, true);
    ctx.dynasty.rulers.push({ ...ctx.ruler, id: "successor", reignOrdinal: 19,
      accessionYear: ctx.ruler.endYear!, status: "politically-ended", deathMonth: undefined, deathReason: undefined, endReason: "政治终结" });
    expect(result(ctx).evidence.roles).not.toContain("LAST_RULER");
    const last = result({ ...ctx, ruler: ctx.dynasty.rulers[1] });
    expect(last.evidence.roles).toContain("LAST_RULER");
    expect(last.evidence.hasRecordedDeath).toBe(false);
  });
  it.each(["合邦退位", "纳土退位"])("preserves %s without death, collapse or a false last-exile role", reason => {
    const ctx = context(453, 0);
    Object.assign(ctx.ruler, { status: "abdicated", endReason: reason, deathMonth: undefined, deathReason: undefined });
    ctx.ruler.chronicle!.deathCause = undefined;
    const actual = result(ctx);
    expect(actual.evidence.hasRecordedDeath).toBe(false);
    expect(actual.evidence.roles).not.toContain("LAST_RULER");
    expect(actual.evidence.terminalCollapse).toBe(false);
    expect(actual.assessment + actual.voice).not.toMatch(/身后|去世|终其一生|亡国之君|王统终结于此/);
  });
  it("uses political closure for a final holder whose life/death is unrecorded", () => {
    const ctx = context(453, 0, true);
    Object.assign(ctx.ruler, { status: "politically-ended", endReason: "政治终结", deathMonth: undefined, deathReason: undefined });
    ctx.ruler.chronicle!.deathCause = undefined;
    const actual = result(ctx);
    expect(actual.evidence.roles).toContain("LAST_RULER");
    expect(actual.evidence.hasRecordedDeath).toBe(false);
    expect(actual.assessment + actual.voice).not.toMatch(/身后|去世|终其一生/);
  });
  it("sums multiple real exile/restoration episodes without changing total tenure", () => {
    const ctx = context(480, 480);
    ctx.events = [event("faction-exiled", 112), event("faction-restored", 232),
      event("faction-exiled", 300), event("faction-restored", 360)];
    const actual = result(ctx);
    expect(actual.evidence.tenure).toMatchObject({ totalTenureMonths: 480, activeRuleMonths: 300, exileMonths: 180,
      restoredExileMonths: 180, exileEpisodeCount: 2, restoredDuringTenure: true });
    expect(actual.evidence.roles).toContain("RESTORED_FROM_EXILE");
    expect(actual.evidence.roles).not.toContain("SHORT_REIGN");
    expect(actual.evidence.roles).not.toContain("LAST_RULER");
    expect(actual.assessment).toContain("复国");
  });
  it("preserves normal 313-month rule and keeps derived results deterministic across V13 DTO JSON", () => {
    for (const ctx of [context(313, 313), context(453, 0, true), context(62, 22)]) {
      const canonical = JSON.stringify(ctx), rng = worldRandom.exportState();
      const before = result(ctx);
      const restored = JSON.parse(canonical) as RulerHistoriographyContext;
      restored.dynasty.rulers = ctx.dynasty.rulers.map(r => importRulerSave(JSON.parse(JSON.stringify(exportRulerSave(r)))));
      restored.ruler = restored.dynasty.rulers[0];
      expect(result(restored)).toEqual(before); expect(result(ctx)).toEqual(before);
      expect(JSON.stringify(ctx)).toBe(canonical); expect(worldRandom.exportState()).toEqual(rng);
      expect(before.evidence.roles).not.toContain("SHORT_REIGN");
    }
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(13);
  });
});
