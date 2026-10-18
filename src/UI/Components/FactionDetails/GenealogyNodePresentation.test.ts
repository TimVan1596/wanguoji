import { describe, it, expect } from "vitest";
import type { Dynasty, Ruler } from "../../../Politics/Dynasty";
import type { WorldEvent } from "../../../History/WorldHistory";
import { deriveGenealogyNodePresentations as derive, genealogyThemeStyles } from "./GenealogyNodePresentation";
import { buildPoliticalGenealogy } from "../../../Politics/DynasticCandidateRules";
import { exportRulerSave, importRulerSave } from "../../../Persistence/RulerSaveProjection";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../../../Persistence/WorldSaveSchema";
import random from "../../../Simulation/WorldRandom";
import { getGenealogyCanvasLayout } from "./genealogyViewport";
import { resolveHistoricalRulerDisplay } from "../../../Politics/HistoricalRulerDisplay";
const ruler = (id: string, start: number, end?: number): Ruler => ({ id, houseName: "宋氏", givenName: id, bornYear: 0,
  accessionYear: start, endYear: end, reignOrdinal: start + 1, status: end === undefined ? "ruling" : "politically-ended" });
const faction = { name: "f", color: 1, status: "ACTIVE", stateFoundedMonth: 20 };
const event = (type: WorldEvent["type"], month: number, rulerId?: string, extra: Partial<WorldEvent> = {}): WorldEvent => ({
  id: `${type}-${month}`, type, year: month, monthIndex: month, category: "politics", importance: "major", title: "证据", factionIds: ["f"], actorFactionId: "f", rulerId, ...extra });
function fixture(): Dynasty { return { factionId: "f", houseName: "宋氏", currentRulerId: "b", heirIds: ["h"], designatedHeirId: "h",
  rulers: [Object.assign(ruler("a", 0, 10), { relationType: "FOUNDER" }), ruler("b", 10), { ...ruler("h", 30), accessionYear: undefined, reignOrdinal: undefined, status: "heir" }],
  houseEpochs: [{ houseName: "宋氏", startMonth: 0, foundingRulerId: "a", startReason: "FOUNDING" }] }; }
describe("verified genealogy identity and restrained hierarchy", () => {
  it("separates founder from state founder and marks only the actual proclaiming emperor", () => {
    const d = fixture(), p = derive(d, faction, [event("state-founded", 20, "b"), event("emperor-proclaimed", 25, "b")], 40);
    expect(p.get("a")!.roles).toEqual(["势力创始"]);
    expect(p.get("b")!.roles).toEqual(["当前君主", "正式开国", "称帝"]);
    expect(p.get("b")!.labels).toHaveLength(2); expect(p.get("b")!.details).toContain("称帝");
    expect(p.get("b")!.theme).toBe("current"); expect(p.get("h")!.theme).toBe("heir");
  });
  it("rejects wrong faction, wrong tenure, foreign IDs and future records", () => {
    const d = fixture(), p = derive(d, faction, [event("state-founded", 20, "a"), event("emperor-proclaimed", 25, "foreign"),
      event("emperor-proclaimed", 30, "b", { actorFactionId: "other" }), event("emperor-proclaimed", 100, "b")], 40);
    expect(p.get("b")!.roles).toEqual(["当前君主"]); expect(p.get("a")!.roles).not.toContain("正式开国");
  });
  it.each(["USURPATION", "NATURAL_HOUSE_SUCCESSION", "RESTORATION"] as const)("requires actual usurpation event and exact epoch at %s", reason => {
    const d = fixture(); d.rulers[1].relationType = reason === "USURPATION" ? "USURPER" : "NEW_HOUSE";
    d.houseEpochs!.push({ houseName: "宋氏", startMonth: 10, foundingRulerId: "b", startReason: reason });
    expect(derive(d, faction, [], 40).get("b")!.roles).not.toContain("篡朝开统");
    expect(derive(d, faction, [event("dynasty-usurped", 10, "b")], 40).get("b")!.roles.includes("篡朝开统")).toBe(reason === "USURPATION");
    expect(d.houseEpochs).toHaveLength(2);
  });
  it("distinguishes real restoration from recovery of a city and rejects ambiguous same-month holders", () => {
    const d = fixture(); const p = derive(d, faction, [event("city-recovered", 15, "b"), event("faction-restored", 20)], 40);
    expect(p.get("b")!.roles).toContain("复国"); expect(p.get("a")!.roles).not.toContain("复国");
    expect(derive(d, faction, [event("faction-restored", 10)], 40).get("b")!.roles).not.toContain("复国");
    expect(derive(d, faction, [event("city-recovered", 15, "b")], 40).get("b")!.roles).not.toContain("复国");
  });
  it.each(["politically-ended", "dead"] as const)("marks the last actual political holder without inventing death: %s", status => {
    const d = fixture(); d.currentRulerId = null; Object.assign(d.rulers[1], { status, endYear: 30, politicalEndYear: 30,
      ...(status === "dead" ? { deathMonth: 30, deathReason: "去世" } : {}) });
    const p = derive(d, { ...faction, status: "EXTINCT", terminationMonth: 30, terminationReason: "EXTINCT" }, [], 40);
    expect(p.get("b")!.roles).toEqual(["末代承统"]); expect(p.get("a")!.roles).not.toContain("末代承统");
    expect(p.get("h")!.roles).not.toContain("储君"); expect(d.rulers[1].status).toBe(status);
    if (status === "politically-ended") expect(p.get("b")!.details).toContain("生死未载");
  });
  it("exile or a replaced house alone does not imply the last national ruler", () => {
    const d = fixture(); d.rulers[1].status = "exiled";
    expect(derive(d, { ...faction, status: "EXILED" }, [], 40).get("b")!.roles).toEqual(["当前君主"]);
    expect(derive(d, faction, [], 40).get("a")!.roles).not.toContain("末代承统");
  });
  it.each(["MERGED", "SUBMITTED"] as const)("keeps administrative retirement separate: %s", reason => {
    const d = fixture(); Object.assign(d.rulers[1], { status: "abdicated", endYear: 30 }); d.currentRulerId = null;
    const e = event(reason === "MERGED" ? "faction-merged" : "faction-submitted", 30, undefined, { metadata: reason === "MERGED" ?
      { absorbedFactionId: "f", absorbingFactionId: "other", absorbedRulerId: "b" } : { submittedFactionId: "f", receivingFactionId: "other", submittedRulerId: "b" } });
    const p = derive(d, { ...faction, status: "EXTINCT", terminationReason: reason, terminationMonth: 30 }, [e], 40);
    expect(p.get("b")!.roles).toEqual([reason === "MERGED" ? "合邦退位" : "纳土退位"]);
    expect(d.rulers[1].deathMonth).toBeUndefined(); expect(p.get("a")!.roles).not.toContain("末代承统");
  });
  it("requires recorded death for titles and preserves the existing historical name formatter", () => {
    const d = fixture(); Object.assign(d.rulers[0], { templeName: "太祖", posthumousEpithet: "武" });
    expect(derive(d, faction, [], 40).get("a")!.hasPosthumousTitle).toBe(false);
    expect(resolveHistoricalRulerDisplay(d.rulers[0], "旧国")).not.toContain("太祖");
    Object.assign(d.rulers[0], { status: "dead", deathMonth: 10, deathReason: "战死" });
    expect(derive(d, faction, [], 40).get("a")!.hasPosthumousTitle).toBe(true);
    expect(resolveHistoricalRulerDisplay(d.rulers[0], "旧国")).toContain("旧国太祖");
  });
  it("keeps 150 ordinary nodes neutral, graph and scaled bloodline layout intact; V13 projection and RNG unchanged", () => {
    const d = fixture(); d.rulers.push(...Array.from({ length: 150 }, (_, i) => ({ ...ruler(`ordinary${i}`, 40 + i), parentId: i % 2 ? `ordinary${i - 1}` : undefined })));
    const events = [event("state-founded", 20, "b")]; const before = JSON.stringify([d, events]); const rng = random.exportState();
    const graph = JSON.stringify(buildPoliticalGenealogy(d.rulers, d.currentRulerId, d.designatedHeirId, d.heirIds));
    const result = derive(d, faction, events, 500);
    for (let i = 0; i < 150; i++) expect(result.get(`ordinary${i}`)!.theme).toBe("neutral");
    expect(genealogyThemeStyles.neutral.borderColor).toBe("var(--gg-border)");
    const reload = { ...d, rulers: d.rulers.map(r => importRulerSave(exportRulerSave(r))) };
    expect([...derive(reload, faction, events, 500)]).toEqual([...result]); expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(17);
    expect(JSON.stringify([d, events])).toBe(before); expect(random.exportState()).toEqual(rng);
    expect(JSON.stringify(buildPoliticalGenealogy(d.rulers, d.currentRulerId, d.designatedHeirId, d.heirIds))).toBe(graph);
    for (const scale of [.5, 1, 1.5]) expect(getGenealogyCanvasLayout(1200, 800, 600, 400, scale).width).toBe(Math.max(600, 1200 * scale));
  });
});
