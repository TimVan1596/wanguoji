import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DynastyHouseAssessment } from "./DynastyHouseAssessment";
import { getHouseAssessments } from "../../../Historiography/DynastyHouseAssessmentArchive";
import WorldHistory from "../../../History/WorldHistory";
import { createRulerChronicle } from "../../../Politics/RulerChronicle";
import type { Dynasty } from "../../../Politics/Dynasty";
vi.mock("react/jsx-dev-runtime", async () => {
  const react = await vi.importActual<typeof import("react")>("react");
  return { jsxDEV: (type: React.ElementType, props: Record<string, unknown>, key?: string) => {
    const { children, ...rest } = props; return react.createElement(type, { ...rest, key }, ...(Array.isArray(children) ? children : [children]));
  }, Fragment: react.Fragment };
});
afterEach(() => { vi.restoreAllMocks(); WorldHistory.reset(); });
function fixture(n = 1) {
  const faction = { name: "f", displayName: "秦", color: 1, status: "ACTIVE", stateFoundedMonth: 0 };
  const dynasty: Dynasty = { factionId: "f", houseName: `氏${n - 1}`, heirIds: [], currentRulerId: `r${n - 1}`,
    rulers: Array.from({ length: n }, (_, i) => ({ id: `r${i}`, houseName: `氏${i}`, givenName: "宁", bornYear: i * 100 - 300,
      accessionYear: i * 100, reignOrdinal: i + 1, status: i === n - 1 ? "ruling" : "dead", endYear: i === n - 1 ? undefined : (i + 1) * 100,
      chronicle: createRulerChronicle({ month: i * 100, population: 1, territoryShare: .1, cityCount: 1, stability: 70 }) })),
    houseEpochs: Array.from({ length: n }, (_, i) => ({ houseName: `氏${i}`, startMonth: i * 100, endMonth: i === n - 1 ? undefined : (i + 1) * 100 - 1,
      foundingRulerId: `r${i}`, startReason: i === 0 ? "FOUNDING" : "NATURAL_HOUSE_SUCCESSION" })) };
  return { dynasty, faction, factions: new Map([["f", faction]]), worldMonth: n * 100 };
}
describe("compact house assessment and indexed cache", () => {
  it("opens one compact phase and distinguishes current governance from a completed assessment", () => {
    const markup = renderToStaticMarkup(<DynastyHouseAssessment {...fixture()} />);
    expect(markup).toContain("王统总评"); expect(markup).toContain("尚在统治"); expect(markup).toContain("王统概览");
    expect(markup).not.toContain("选择王统阶段"); expect(markup).not.toContain("国家已覆灭");
  });
  it("offers 100 text options but mounts only the latest phase's prose, without another dialog", () => {
    const markup = renderToStaticMarkup(<DynastyHouseAssessment {...fixture(100)} />);
    expect((markup.match(/<option /g) ?? []).length).toBe(100);
    expect((markup.match(/<details /g) ?? []).length).toBe(1);
    expect(markup).toContain("氏99"); expect(markup).not.toContain("<canvas"); expect(markup).not.toContain("<dialog");
  });
  it("reuses a cached indexed result and invalidates on revision, month, faction and hydrated dynasty identity", () => {
    const c = fixture(); const query = vi.spyOn(WorldHistory, "getEventsForFaction");
    const get = () => getHouseAssessments(c.dynasty, c.faction, c.factions, c.worldMonth);
    const first = get(); expect(get()).toBe(first); expect(query).toHaveBeenCalledTimes(1);
    expect(getHouseAssessments(c.dynasty, { ...c.faction }, new Map(c.factions), c.worldMonth)).toBe(first);
    expect(query).toHaveBeenCalledTimes(1);
    WorldHistory.addEvent({ id: "emperor", year: 50, type: "emperor-proclaimed", category: "politics", title: "称帝", importance: "major", actorFactionId: "f", rulerId: "r0", factionIds: ["f"] });
    const changed = get(); expect(changed).not.toBe(first); expect(changed[0].assessment.join("")).toContain("称帝");
    c.worldMonth++; expect(get()).not.toBe(changed);
    const beforeMutation = get(); c.dynasty.rulers[0].givenName = "慎"; expect(get()).not.toBe(beforeMutation);
    expect(getHouseAssessments({ ...c.dynasty }, c.faction, c.factions, c.worldMonth)).not.toBe(get());
    expect(getHouseAssessments(c.dynasty, { ...c.faction, status: "EXILED" }, c.factions, c.worldMonth)[0].status).toBe("EXILED");
    WorldHistory.reset(); expect(get()[0].milestones).toHaveLength(0);
    expect(query.mock.calls.every(([id]) => id === "f")).toBe(true);
  });
});
