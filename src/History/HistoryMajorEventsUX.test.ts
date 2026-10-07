import { describe, expect, it, vi } from "vitest";
import { WorldHistoryStore, type WorldEvent } from "./WorldHistory";
import { queryHistoryPage } from "./HistoryPageQuery";
import { isLandmarkHistoryEvent } from "./HistorySignificanceRules";
import { getRevolutionEventDetails } from "./RevolutionEventDetails";
import { HistoryBrowsingSession } from "../UI/Components/HistoryScroll/historyBrowsing";

const event = (type: WorldEvent["type"], month: number, id = `${type}-${month}`): WorldEvent => ({
  id, type, year: month, category: "politics", importance: "major", title: type, actorFactionId: "A", factionIds: ["A"],
});
describe("major history discovery over canonical bounded pages", () => {
  it.each([
    ["dynasty-usurped", "revolution"], ["state-founded", "founding"], ["emperor-proclaimed", "emperor"],
    ["faction-merged", "merge"], ["faction-restored", "restoration"], ["dynasty-restored", "restoration"],
    ["faction-exiled", "extinction"], ["faction-extinct", "extinction"], ["world-era-started", "era"],
    ["world-unification", "era"], ["world-hegemony", "era"], ["world-fractured", "era"], ["empire-split", "era"],
  ] as const)("%s appears in major events and its %s subtype", (type, subtype) => {
    const store = new WorldHistoryStore(); store.addEvent(event(type, 9867));
    expect(queryHistoryPage(store, { visibleCount: 30, filter: "featured" }).events[0].type).toBe(type);
    expect(queryHistoryPage(store, { visibleCount: 30, filter: "featured", eventTypeFilter: subtype }).events[0].type).toBe(type);
  });
  it("preserves collapse grouping before extinction selection", () => {
    const store = new WorldHistoryStore();
    for (const type of ["capital-fallen", "ruler-captured", "faction-exiled", "faction-extinct"] as const)
      store.addEvent({ ...event(type, 500), targetFactionId: "B", historyGroupId: "fall" });
    const page = queryHistoryPage(store, { visibleCount: 30, filter: "featured", eventTypeFilter: "extinction" });
    expect(page.events).toHaveLength(1);
    expect(page.events[0].metadata?.groupedEventCount).toBe(4);
  });
  it("diplomatic signing/expiry filter excludes regular warfare", () => {
    const store = new WorldHistoryStore();
    const types = ["truce-signed", "non-aggression-signed", "alliance-signed", "treaty-expired", "alliance-expired"] as const;
    types.forEach((type, i) => store.addEvent(event(type, i)));
    store.addEvent({ ...event("city-captured", 20), category: "war" });
    expect(queryHistoryPage(store, { visibleCount: 30, filter: "diplomacy" }).events.map(e => e.type)).toEqual([...types].reverse());
  });
  it("combines era, faction and subtype and supports newest/load older", () => {
    const store = new WorldHistoryStore();
    for (let month = 0; month < 1000; month++) store.addEvent({ ...event("dynasty-usurped", month), actorFactionId: month % 2 ? "A" : "B", factionIds: [month % 2 ? "A" : "B"] });
    const options = { filter: "featured" as const, eventTypeFilter: "revolution" as const, factionId: "A", startMonth: 400, endMonth: 500 };
    expect(queryHistoryPage(store, { ...options, visibleCount: 3 }).events.map(e => e.year)).toEqual([499, 497, 495]);
    const older = queryHistoryPage(store, { ...options, visibleCount: 50 });
    expect(older.events).toHaveLength(50); expect(older.events.at(-1)?.year).toBe(401); expect(older.hasMore).toBe(false);
  });
  it.each([5000, 20000])("%i events: append publishes only delta; subtype query keeps windows bounded", size => {
    const store = new WorldHistoryStore();
    for (let i = 0; i < size; i++) store.addEvent(event(i % 3 ? "city-founded" : "dynasty-usurped", i));
    const browsing = new HistoryBrowsingSession(); browsing.scroll(200);
    const revision = vi.fn(), append = vi.fn(change => browsing.append(change.events, { filter: "featured", eventTypeFilter: "revolution" }));
    const offRevision = store.subscribeRevision(revision), offAppend = store.subscribeAppends(append);
    const exportBefore = store.exportState();
    const methods = Array.prototype as unknown as { sort: (compare?: (a: WorldEvent, b: WorldEvent) => number) => WorldEvent[]; slice: (start?: number, end?: number) => WorldEvent[] };
    const full = vi.spyOn(store, "getEvents"), sort = vi.spyOn(methods, "sort"), slice = vi.spyOn(methods, "slice");
    try {
      store.addEvent(event("dynasty-usurped", size));
      expect(full).not.toHaveBeenCalled(); expect(sort).not.toHaveBeenCalled(); expect(slice).not.toHaveBeenCalled();
      expect(append.mock.calls[0][0].events).toHaveLength(1); expect(browsing.unseenCount).toBe(1);
    } finally { full.mockRestore(); sort.mockRestore(); slice.mockRestore(); }
    const window = vi.spyOn(store, "getEventWindow");
    try {
      const page = queryHistoryPage(store, { visibleCount: 30, filter: "featured", eventTypeFilter: "revolution" });
      expect(page.events).toHaveLength(30); expect(page.events[0].year).toBe(size);
      expect(window.mock.calls.every(([options]) => options.limit === 200)).toBe(true);
      expect(window.mock.results.every(result => result.value.events.length <= 200)).toBe(true);
      expect(window.mock.calls.length).toBeLessThanOrEqual(2);
    } finally { window.mockRestore(); }
    offRevision(); offAppend();
    for (let i = 0; i < 100; i++) { const off = store.subscribeAppends(() => {}); off(); }
    expect(store.getRuntimeCardinality().historyListeners).toBe(0);
    const saved = store.exportState();
    expect(saved.events.slice(0, size)).toEqual(exportBefore.events);
    expect(saved).not.toHaveProperty("unseenCount");
    const restored = new WorldHistoryStore(); restored.importState(saved); expect(restored.exportState()).toEqual(saved);
  });
  it("sparse revolution discovery copies matching anchors only, and older browsing excludes newer months", () => {
    const store = new WorldHistoryStore();
    for (let i = 0; i < 20000; i++) store.addEvent(event(i % 997 ? "city-founded" : "dynasty-usurped", i));
    const window = vi.spyOn(store, "getEventWindow");
    try {
      const page = queryHistoryPage(store, { visibleCount: 30, filter: "featured", eventTypeFilter: "revolution" });
      expect(page.events).toHaveLength(21);
      expect(window).toHaveBeenCalledTimes(1);
      expect(window.mock.results[0].value.events).toHaveLength(21);
      const before = page.events;
      store.addEvent(event("dynasty-usurped", 22000));
      expect(queryHistoryPage(store, { visibleCount: 60, filter: "featured", eventTypeFilter: "revolution", endMonth: before[0].year }).events).toEqual(before);
    } finally { window.mockRestore(); }
  });
  it("shows recorded revolution facts without invented death/kinship/current identity", () => {
    const e = { ...event("dynasty-usurped", 9867), metadata: {
      previousRulerTitle: "陵王", oldHouseName: "陆氏", newHouseName: "欧阳氏", successionReason: "combat", stability: 56,
      vulnerabilityEvidence: "MINOR_SUCCESSOR,PREDECESSOR_COMBAT_DEATH", displacedSuccessorName: "合法继承人",
      displacedSuccessorId: "沅陵义军-ruler-535", oldStateName: "陵", newStateName: "新国号", oldColor: 0x112233, newColor: 0x445566,
    } };
    expect(isLandmarkHistoryEvent(e)).toBe(true);
    const details = getRevolutionEventDetails(e).join("\n");
    expect(details).toContain("前君结局：战死"); expect(details).toContain("当时稳定度：56");
    expect(details).toContain("合法继承人未成年"); expect(details).toContain("旧王统：陆氏"); expect(details).toContain("新王统：欧阳氏");
    expect(details).toContain("被排除合法继承人：合法继承人"); expect(details).toContain("沅陵义军-ruler-535");
    expect(details).toContain("国号变化：陵 → 新国号"); expect(details).toContain("易帜：#112233 → #445566");
    expect(details).not.toMatch(/继承人.*死亡|弑君|拥戴/);
    expect(getRevolutionEventDetails({ ...e, metadata: {} })).toEqual([]);
  });
});
