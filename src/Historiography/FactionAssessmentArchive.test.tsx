import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getFactionAssessment, resetFactionAssessmentCache } from "./FactionAssessmentArchive";
import FactionLifetimeRecords from "../Simulation/FactionLifetimeRecord";
import WorldHistory, { type WorldEvent } from "../History/WorldHistory";
import { FactionAssessmentPanel, FactionTerminalRetrospective } from "../UI/Components/FactionAssessment";
import type { HistoricalFaction } from "./FactionHistoriography";
import type { Dynasty } from "../Politics/Dynasty";
import worldRandom from "../Simulation/WorldRandom";

vi.mock("react/jsx-dev-runtime", async () => {
  const react = await vi.importActual<typeof import("react")>("react");
  return { jsxDEV: (type: React.ElementType, props: Record<string, unknown>, key?: string) => {
    const { children, ...rest } = props;
    return react.createElement(type, { ...rest, key }, ...(Array.isArray(children) ? children : [children]));
  }, Fragment: react.Fragment };
});
afterEach(() => { vi.restoreAllMocks(); resetFactionAssessmentCache(); FactionLifetimeRecords.reset(); WorldHistory.reset(); });
function fixture() {
  const f: HistoricalFaction = { name: "a", displayName: "甲", status: "EXTINCT", identityStage: "STATE", firstFoundedYear: 0,
    stateFoundedMonth: 0, cumulativeActiveYears: 120, restorationYears: [], sovereigntyHistory: [], nameHistory: [], extinctionYear: 120, terminationReason: "EXTINCT" };
  const live = { name: "a", status: "ACTIVE", users: { size: 20 }, cities: { length: 2 }, blocks: { children: { size: 10 } } };
  FactionLifetimeRecords.reset(100); FactionLifetimeRecords.observeWorld(0, [live], 100);
  FactionLifetimeRecords.prepareTerminal(live, 120); FactionLifetimeRecords.freeze(live, 120);
  const dynasty: Dynasty = { factionId: "a", houseName: "陈氏", currentRulerId: null, rulers: [], heirIds: [],
    houseEpochs: [{ houseName: "陈氏", startMonth: 0, foundingRulerId: "r", startReason: "FOUNDING" }] };
  const event: WorldEvent = { id: "end", type: "faction-extinct", year: 120, category: "politics", importance: "major", title: "甲终结", targetFactionId: "a", factionIds: ["a"] };
  return { f, dynasty, event, factions: new Map([["a", f]]), dynasties: new Map([["a", dynasty]]) };
}
describe("bounded, on-demand terminal faction presentation", () => {
  it("caches one assessment via the faction index even with 20k history events and repeated UI reads", () => {
    const { f, dynasty, event, factions, dynasties } = fixture();
    for (let i = 0; i < 20000; i++) WorldHistory.addEvent({ ...event, id: `old-${i}`, year: i, type: "city-founded", factionIds: ["unrelated"], targetFactionId: undefined });
    WorldHistory.addEvent(event);
    const query = vi.spyOn(WorldHistory, "getEventsForFaction"), full = vi.spyOn(WorldHistory, "getEvents");
    const rng = worldRandom.exportState(), original = JSON.stringify(WorldHistory.exportState());
    const first = getFactionAssessment(f, factions, dynasty);
    for (let i = 0; i < 100; i++) expect(getFactionAssessment(f, factions, dynasty)).toBe(first);
    const panel = renderToStaticMarkup(<FactionAssessmentPanel faction={f} factions={factions} dynasty={dynasty} />);
    const summary = renderToStaticMarkup(<FactionTerminalRetrospective event={event} factions={factions} dynasties={dynasties} />);
    expect(panel).toContain("国评"); expect(panel).toContain("最高人口：20人"); expect(panel).toContain("史家曰");
    expect(panel.match(/<details[^>]*>/)?.[0]).not.toContain("open");
    expect(summary).toContain("国祚回顾"); expect(summary).toContain("10年");
    expect(query).toHaveBeenCalledTimes(1); expect(full).not.toHaveBeenCalled();
    expect(WorldHistory.getEventCount()).toBe(20001); expect(JSON.stringify(WorldHistory.exportState())).toBe(original);
    expect(worldRandom.exportState()).toEqual(rng);
  });
  it("indexes only an actually participating foreign ruler archive once", () => {
    const { f, dynasty, factions } = fixture();
    const rival = { ...f, name: "qin", displayName: "秦", nameHistory: [{ name: "秦", startMonth: 0 }], sovereigntyHistory: [{ rank: "KING", startMonth: 0 }] };
    factions.set("qin", rival);
    const ruler = { id: "qin-ruler", houseName: "嬴氏", givenName: "康", bornYear: 0, accessionYear: 0, status: "ruling" as const };
    const lookup = vi.fn(() => [ruler]);
    for (let i = 1; i <= 100; i++) WorldHistory.addEvent({ id: `capture-${i}`, year: i, type: "city-captured", category: "war", importance: "major", title: "原始史料", actorFactionId: "qin", targetFactionId: "a", cityName: "范阳", rulerId: ruler.id });
    const first = getFactionAssessment(f, factions, dynasty, lookup)!;
    expect(lookup).toHaveBeenCalledTimes(1); expect(lookup).toHaveBeenCalledWith("qin");
    expect(first.narrativeEvidence.filter(e => e.rulerName === "秦王嬴康")).toHaveLength(100);
    for (let i = 0; i < 100; i++) expect(getFactionAssessment(f, factions, dynasty, lookup)).toBe(first);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
  it("does not finalize an exiled faction or cache incomplete dynasty loading", () => {
    const { f, dynasty, factions } = fixture();
    expect(getFactionAssessment(f, factions)).toBeUndefined();
    expect(getFactionAssessment(f, factions, dynasty)).toBeDefined();
    expect(getFactionAssessment({ ...f, status: "EXILED" }, factions, dynasty)).toBeUndefined();
    expect(renderToStaticMarkup(<FactionAssessmentPanel faction={{ ...f, status: "ACTIVE" }} factions={factions} dynasty={dynasty} />)).toBe("");
  });
  it("rebuilds derived presentation after hydration without changing any permanent record", () => {
    const { f, dynasty, factions } = fixture(); const first = getFactionAssessment(f, factions, dynasty)!;
    const state = FactionLifetimeRecords.exportState(); FactionLifetimeRecords.importState(state);
    const second = getFactionAssessment(f, factions, dynasty)!;
    expect(second).not.toBe(first); expect(second).toEqual(first); expect(FactionLifetimeRecords.exportState()).toEqual(state);
  });
});
