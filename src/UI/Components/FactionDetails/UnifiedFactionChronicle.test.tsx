import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { UnifiedChronicleText, UnifiedFactionChronicle } from "./UnifiedFactionChronicle";
import type { HistoricalFaction } from "../../../Historiography/FactionHistoriography";
import type { HouseHistoricalFaction } from "../../../Historiography/DynastyHouseHistoriography";
import { getHouseAssessments } from "../../../Historiography/DynastyHouseAssessmentArchive";
import { getUnifiedFactionChronicle } from "../../../Historiography/UnifiedFactionChronicleArchive";
import FactionLifetimeRecords from "../../../Simulation/FactionLifetimeRecord";
import WorldHistory from "../../../History/WorldHistory";
import type { Dynasty } from "../../../Politics/Dynasty";
import { createRulerChronicle } from "../../../Politics/RulerChronicle";
import { getFactionAssessment, resetFactionAssessmentCache } from "../../../Historiography/FactionAssessmentArchive";
vi.mock("react/jsx-dev-runtime", async () => {
  const r = await vi.importActual<typeof import("react")>("react");
  return { jsxDEV: (type: React.ElementType, props: Record<string, unknown>, key?: string) => {
    const { children, ...rest } = props; return r.createElement(type, { ...rest, key }, ...(Array.isArray(children) ? children : [children]));
  }, Fragment: r.Fragment };
});
afterEach(() => { vi.restoreAllMocks(); WorldHistory.reset(); FactionLifetimeRecords.reset(); resetFactionAssessmentCache(); });
function fixture() {
  const faction: HistoricalFaction & HouseHistoricalFaction = { name: "f", displayName: "坂", status: "ACTIVE", identityStage: "STATE", color: 1,
    firstFoundedYear: 0, stateFoundedMonth: 5, cumulativeActiveYears: 100, restorationYears: [], sovereigntyHistory: [], nameHistory: [{ name: "坂", startMonth: 0 }] };
  const dynasty: Dynasty = { factionId: "f", houseName: "王氏", currentRulerId: "r", heirIds: [], houseEpochs: [{ houseName: "王氏", startMonth: 0, foundingRulerId: "r", startReason: "FOUNDING" }],
    rulers: [{ id: "r", houseName: "王氏", givenName: "宁", bornYear: -300, accessionYear: 0, status: "ruling", reignOrdinal: 1,
      chronicle: createRulerChronicle({ month: 0, population: 10, territoryShare: .1, cityCount: 1, stability: 60 }) }] };
  const live = { name: "f", status: "ACTIVE", users: { size: 10 }, cities: { length: 1 }, blocks: { children: { size: 5 } } };
  FactionLifetimeRecords.reset(100); FactionLifetimeRecords.observeWorld(100, [live], 100);
  return { dynasty, faction, factions: new Map([["f", faction]]), worldMonth: 100, live };
}
describe("direct, indexed unified royal history", () => {
  it("renders the complete article without any historical pane buttons, select, details or headings", () => {
    const c = fixture(), html = renderToStaticMarkup(<UnifiedFactionChronicle {...c} />);
    expect(html).toContain("《坂国史》"); expect(html).toContain("王宁承统"); expect(html).toContain("仍在延续");
    expect(html).not.toMatch(/<button|<select|<details|国家国评|王统摘要|史家曰|国史简述|王统总评/);
    expect((html.match(/<p /g) ?? []).length).toBeGreaterThanOrEqual(2); expect(html).toContain("overflow-wrap:anywhere");
  });
  it("renders supplied narrative paragraphs and a separate judgment without phase controls", () => {
    const html = renderToStaticMarkup(<UnifiedChronicleText article={{ title: "《长国史》", range: "0年1月～今", paragraphs: ["一百段政治王统依序相承。", "国家的延续与一姓的传承不同。"], phaseCount: 100, length: 15, eventIds: [] }} />);
    expect((html.match(/<p /g) ?? []).length).toBe(2); expect(html).not.toContain("<select"); expect(html).toContain("min-width:0");
    const source = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");
    expect(source).toContain("<UnifiedFactionChronicle"); expect(source).not.toContain("<DynastyHouseAssessment"); expect(source).not.toContain("<FactionAssessmentPanel");
    expect(source.indexOf("{archive}", source.indexOf("const orderedRulers"))).toBeLessThan(source.indexOf("储君", source.indexOf("const orderedRulers")));
  });
  it("uses only indexed history and reuses its article across repeated reads, with revision/reload invalidation", () => {
    const c = fixture(); const phases = getHouseAssessments(c.dynasty, c.faction, c.factions, c.worldMonth);
    const indexed = vi.spyOn(WorldHistory, "getEventsForFaction"), full = vi.spyOn(WorldHistory, "getEvents");
    const get = () => getUnifiedFactionChronicle(c.dynasty, c.faction, c.factions, c.worldMonth, phases);
    const first = get(); for (let i = 0; i < 100; i++) expect(get()).toBe(first);
    expect(indexed).toHaveBeenCalledTimes(1); expect(full).not.toHaveBeenCalled();
    WorldHistory.addEvent({ id: "emperor", year: 80, type: "emperor-proclaimed", actorFactionId: "f", rulerId: "r", title: "称帝", category: "politics", importance: "major" });
    expect(get()?.paragraphs.join("")).toContain("称帝"); expect(get()).not.toBe(first);
    const article = get(); FactionLifetimeRecords.importState(FactionLifetimeRecords.exportState());
    expect(get()).toEqual(article);
    expect(getUnifiedFactionChronicle({ ...c.dynasty }, c.faction, c.factions, c.worldMonth, phases)).toEqual(article);
    WorldHistory.reset(); expect(get()?.paragraphs.join("")).not.toContain("称帝");
  });
  it("leaves the existing national assessment and other consumers intact", () => {
    const c = fixture(); Object.assign(c.faction, { status: "EXTINCT", terminationMonth: 100, terminationReason: "EXTINCT" });
    c.dynasty.currentRulerId = null; Object.assign(c.dynasty.rulers[0], { status: "politically-ended", endYear: 100 });
    FactionLifetimeRecords.prepareTerminal(c.live, 100); FactionLifetimeRecords.freeze(c.live, 100);
    const before = getFactionAssessment(c.faction, c.factions, c.dynasty);
    const facts = JSON.stringify(before);
    renderToStaticMarkup(<UnifiedFactionChronicle {...c} />);
    expect(getFactionAssessment(c.faction, c.factions, c.dynasty)).toBe(before); expect(JSON.stringify(before)).toBe(facts);
  });
});

it("refreshes a participating foreign historical identity without replacing the faction map", () => {
  const c = fixture(); const foreign = { ...c.faction, name: "g", displayName: "今名", nameHistory: [{ name: "秦", startMonth: 0 }] };
  c.factions.set("g", foreign);
  WorldHistory.addEvent({ id: "foreign-fall", year: 80, type: "capital-fallen", actorFactionId: "g", targetFactionId: "f", cityName: "郢", title: "失都", category: "war", importance: "major" });
  const phases = getHouseAssessments(c.dynasty, c.faction, c.factions, c.worldMonth);
  const get = () => getUnifiedFactionChronicle(c.dynasty, c.faction, c.factions, c.worldMonth, phases);
  const first = get(); expect(first?.paragraphs.join("")).toContain("秦攻陷");
  foreign.nameHistory[0].name = "楚";
  expect(get()).not.toBe(first); expect(get()?.paragraphs.join("")).toContain("楚攻陷");
});

it("refreshes recorded own and verified foreign posthumous references without a history rewrite", () => {
  const c = fixture();
  const foreign = { ...c.faction, name: "g", nameHistory: [{ name: "秦", startMonth: 0 }], sovereigntyHistory: [{ rank: "KING", startMonth: 0 }] };
  c.factions.set("g", foreign);
  const ruler = { ...c.dynasty.rulers[0], id: "g-r", houseName: "嬴氏", givenName: "康", status: "dead" as const, endYear: 90, deathMonth: 90, deathReason: "战死" as const, posthumousEpithet: "武" };
  WorldHistory.addEvent({ id: "foreign-fall", year: 80, type: "capital-fallen", actorFactionId: "g", targetFactionId: "f", rulerId: "g-r", cityName: "郢", title: "失都", category: "war", importance: "major" });
  const phases = getHouseAssessments(c.dynasty, c.faction, c.factions, c.worldMonth);
  const get = () => getUnifiedFactionChronicle(c.dynasty, c.faction, c.factions, c.worldMonth, phases, id => id === "g" ? [ruler] : []);
  const first = get(); expect(first?.paragraphs.join("")).toContain("后谥武");
  ruler.posthumousEpithet = "庄";
  expect(get()).not.toBe(first); expect(get()?.paragraphs.join("")).toContain("后谥庄");
  Object.assign(c.dynasty.rulers[0], { status: "dead", endYear: 90, deathMonth: 90, deathReason: "去世", posthumousEpithet: "文" });
  expect(get()?.paragraphs.join("")).toContain("后谥文");
});
