import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DynastyHouseAssessment, RoyalArchiveBody, getRoyalArchiveDefaultView } from "./DynastyHouseAssessment";
import { getHouseAssessments } from "../../../Historiography/DynastyHouseAssessmentArchive";
import WorldHistory from "../../../History/WorldHistory";
import { createRulerChronicle } from "../../../Politics/RulerChronicle";
import type { Dynasty } from "../../../Politics/Dynasty";
import { getFactionAssessment, resetFactionAssessmentCache } from "../../../Historiography/FactionAssessmentArchive";
import FactionLifetimeRecords from "../../../Simulation/FactionLifetimeRecord";
import type { HistoricalFaction } from "../../../Historiography/FactionHistoriography";
import type { HouseHistoricalFaction } from "../../../Historiography/DynastyHouseHistoriography";
vi.mock("react/jsx-dev-runtime", async () => {
  const react = await vi.importActual<typeof import("react")>("react");
  return { jsxDEV: (type: React.ElementType, props: Record<string, unknown>, key?: string) => {
    const { children, ...rest } = props; return react.createElement(type, { ...rest, key }, ...(Array.isArray(children) ? children : [children]));
  }, Fragment: react.Fragment };
});
afterEach(() => { vi.restoreAllMocks(); WorldHistory.reset(); FactionLifetimeRecords.reset(); resetFactionAssessmentCache(); });
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
    expect(markup).toContain("国史与王统"); expect(markup).toContain("尚在延续"); expect(markup).toContain("王统一览"); expect(markup).toContain("当前承统：氏0宁"); expect(markup).not.toContain("史家曰");
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

function terminalFixture(n = 1) {
  const c = fixture(n);
  const faction: HistoricalFaction & HouseHistoricalFaction = { ...c.faction, status: "EXTINCT", identityStage: "STATE", firstFoundedYear: 0,
    cumulativeActiveYears: c.worldMonth, restorationYears: [], sovereigntyHistory: [], nameHistory: [], terminationMonth: c.worldMonth, terminationReason: "EXTINCT" };
  c.dynasty.currentRulerId = null; c.dynasty.rulers[n - 1].status = "politically-ended"; c.dynasty.rulers[n - 1].endYear = c.worldMonth;
  const live = { name: "f", status: "ACTIVE", users: { size: 20 }, cities: { length: 2 }, blocks: { children: { size: 10 } } };
  FactionLifetimeRecords.reset(100); FactionLifetimeRecords.observeWorld(0, [live], 100);
  FactionLifetimeRecords.prepareTerminal(live, c.worldMonth); FactionLifetimeRecords.freeze(live, c.worldMonth);
  const factions = new Map([["f", faction]]);
  const nationalAssessment = getFactionAssessment(faction, factions, c.dynasty)!;
  return { ...c, faction, factions, nationalAssessment };
}
describe("one royal archive with genuinely concise house prose", () => {
  it("defaults a terminal single house to the full national pane, without a second historian voice", () => {
    const c = terminalFixture(), html = renderToStaticMarkup(<DynastyHouseAssessment {...c} />);
    expect(getRoyalArchiveDefaultView(1, true)).toBe("national");
    expect(html).toContain("国史与王统"); expect(html).toContain("王统一览"); expect(html).toContain("最高人口：20人");
    expect(html).toContain("国史简述"); expect(html).toContain("史评"); expect(html).toContain("史家曰");
    expect((html.match(/史家曰/g) ?? []).length).toBe(1); expect(html).not.toContain('data-archive-pane="house"');
    expect((html.match(/<details /g) ?? []).length).toBe(1); expect(html).not.toContain("王统总评");
  });
  it("keeps every national fact and narrative line available, but mounts none of them in house view", () => {
    const c = terminalFixture(), phases = getHouseAssessments(c.dynasty, c.faction, c.factions, c.worldMonth);
    const props = { ...c, phases, onSelect: vi.fn(), onView: vi.fn(), view: "national" as const };
    const full = renderToStaticMarkup(<RoyalArchiveBody {...props} />);
    for (const line of [...c.nationalAssessment.facts, ...c.nationalAssessment.narrative, ...c.nationalAssessment.lines, c.nationalAssessment.voice]) expect(full).toContain(line);
    const concise = renderToStaticMarkup(<RoyalArchiveBody {...props} view="house" />);
    expect(concise).toContain('data-archive-pane="house"'); expect(concise).not.toContain("最高人口"); expect(concise).not.toContain("史家曰");
    expect(concise).not.toContain("国史简述"); expect((concise.match(/<p /g) ?? []).length).toBe(1);
    expect(concise).not.toMatch(/国家事实|宗亲全部死亡|实际死亡另载|非正式国祚|王统阶段历时/);
    expect(concise.length).toBeLessThan(full.length);
  });
  it("defaults multiple houses to the selected latest stage, not the country's entire national account", () => {
    const c = terminalFixture(2), phases = getHouseAssessments(c.dynasty, c.faction, c.factions, c.worldMonth);
    expect(getRoyalArchiveDefaultView(2, true)).toBe("house");
    const props = { ...c, phases, onSelect: vi.fn(), onView: vi.fn(), view: "house" as const };
    const latest = renderToStaticMarkup(<RoyalArchiveBody {...props} />);
    expect(latest).toContain("自然易姓续统"); expect(latest).toContain("氏1宁"); expect(latest).not.toContain("最高人口"); expect(latest).not.toContain("0年1月 ·");
    expect(latest).not.toContain("正式建国：");
    const old = renderToStaticMarkup(<RoyalArchiveBody {...props} selected={phases[0].key} />);
    expect(old).toContain("氏0宁"); expect(old).toContain("旧王统结束，国家继续"); expect(old).toContain("正式建国：0年1月");
    expect(old).not.toContain("篡朝");
    expect(renderToStaticMarkup(<RoyalArchiveBody {...props} selected="absent-old-world-key" />)).toBe(latest);
  });
  it("routes pane/stage controls to session-only callbacks and preserves stage selection when switching panes", () => {
    const c = terminalFixture(2), phases = getHouseAssessments(c.dynasty, c.faction, c.factions, c.worldMonth);
    const onSelect = vi.fn(), onView = vi.fn();
    const tree = RoyalArchiveBody({ ...c, phases, selected: phases[0].key, onSelect, onView, view: "house" });
    const controls: React.ReactElement[] = [];
    const visit = (node: React.ReactNode) => { if (Array.isArray(node)) node.forEach(visit); else if (node && typeof node === "object" && "props" in node) {
      const el = node as React.ReactElement; if (["button", "select"].includes(String(el.type))) controls.push(el); visit(el.props.children);
    } };
    visit(tree);
    controls.find(el => el.props.children === "国家国评")!.props.onClick(); expect(onView).toHaveBeenLastCalledWith("national"); expect(onSelect).not.toHaveBeenCalled();
    controls.find(el => el.type === "select")!.props.onChange({ target: { value: phases[1].key } });
    expect(onSelect).toHaveBeenLastCalledWith(phases[1].key); expect(onView).toHaveBeenLastCalledWith("house");
    controls.find(el => el.props.children === "王统摘要")!.props.onClick(); expect(onView).toHaveBeenLastCalledWith("house");
    expect(c.dynasty.houseEpochs).toHaveLength(2);
  });
  it("uses a responsive bounded shell and mounts just one short pane in a 100-stage archive", () => {
    const c = fixture(100), html = renderToStaticMarkup(<DynastyHouseAssessment {...c} />);
    expect(html).toContain("flex-wrap:wrap"); expect(html).toContain("min-width:0"); expect(html).toContain("max-width:100%"); expect(html).toContain("overflow-wrap:anywhere");
    expect((html.match(/<option /g) ?? []).length).toBe(100); expect((html.match(/<p /g) ?? []).length).toBe(2);
    expect(html).not.toContain("<dialog"); expect(html).not.toContain("<canvas");
  });
  it("never offers a final national assessment for a truly active or still-exiled house", () => {
    const c = fixture(); expect(getRoyalArchiveDefaultView(1, false)).toBe("house");
    for (const status of ["ACTIVE", "EXILED"]) {
      const html = renderToStaticMarkup(<DynastyHouseAssessment {...c} faction={{ ...c.faction, status }} />);
      expect(html).toContain("当前承统：氏0宁"); expect(html).toContain("尚在延续"); expect(html).not.toContain("国家国评");
      expect(html).not.toMatch(/国家覆灭|王统终结|末世|已绝统/);
    }
  });
});

it("renders a same-month phase as a political transition, not a zero-month reign", () => {
  const c = fixture(2); Object.assign(c.faction, { status: "EXTINCT", terminationMonth: 100, terminationReason: "EXTINCT" });
  c.dynasty.currentRulerId = null; c.dynasty.rulers[1].status = "politically-ended"; c.dynasty.rulers[1].endYear = 100;
  const html = renderToStaticMarkup(<DynastyHouseAssessment {...c} />);
  expect(html).toContain("8年5月开始并于同月终结"); expect(html).toContain("当月1位君主承统");
  expect(html).not.toContain("历时0个月"); expect(html).not.toContain("正式建国：0年1月"); expect(html).not.toContain("篡朝");
});

it("keeps the national full text accessible even when the archive lacks house phases", () => {
  const c = terminalFixture();
  expect(getRoyalArchiveDefaultView(0, true)).toBe("national");
  const html = renderToStaticMarkup(<RoyalArchiveBody {...c} phases={[]} view="house" onView={vi.fn()} onSelect={vi.fn()} />);
  expect(html).toContain("最高人口：20人"); expect(html).toContain("国史简述"); expect(html).toContain("史家曰");
  expect(html).not.toContain("王统摘要"); expect(html).not.toContain("暂无王统阶段记录");
});
