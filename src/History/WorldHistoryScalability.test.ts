import { afterEach, describe, expect, it, vi } from "vitest";
import { WorldHistoryStore, type WorldEvent } from "./WorldHistory";
import { queryHistoryPage } from "./HistoryPageQuery";
import { groupHistoryNarratives } from "./HistoryNarrativeGrouper";
import { getFilteredHistoryEvents, type HistoryFilter } from "./HistoryRenderRules";
import worldRandom from "../Simulation/WorldRandom";
import { createDeterminismCheckpoint } from "../Simulation/DeterminismFingerprint";
import { FrameAttribution } from "../Simulation/FrameAttribution";

const event = (month: number): WorldEvent => ({ id: `event-${month}`, year: month,
  type: "city-founded", category: "politics", title: "城邑建立", importance: "normal", factionIds: ["A"] });
afterEach(() => { vi.restoreAllMocks(); });

describe("history publication scaling", () => {
  it.each([1000, 5000, 20000])("append at %i never sorts/copies the archive for runtime subscribers", (size) => {
    const history = new WorldHistoryStore();
    for (let i = 0; i < size; i++) history.addEvent(event(i));
    const revision = vi.fn(); const append = vi.fn();
    const offRevision = history.subscribeRevision(revision);
    const offAppend = history.subscribeAppends(append);
    const getEvents = vi.spyOn(history, "getEvents");
    const methods = Array.prototype as unknown as { sort: (compare?: (a: WorldEvent, b: WorldEvent) => number) => WorldEvent[]; slice: (start?: number, end?: number) => WorldEvent[] };
    const sort = vi.spyOn(methods, "sort");
    const slice = vi.spyOn(methods, "slice");
    const started = performance.now();
    history.addEvent(event(size));
    const elapsedMs = performance.now() - started;
    expect(sort).not.toHaveBeenCalled(); expect(slice).not.toHaveBeenCalled();
    expect(getEvents).not.toHaveBeenCalled();
    expect(append.mock.calls[0][0].events).toHaveLength(1);
    expect(revision).toHaveBeenCalledTimes(2);
    console.info({ size, elapsedMs, publishedEvents: append.mock.calls[0][0].events.length });
    vi.restoreAllMocks();
    const window = vi.spyOn(history, "getEventWindow");
    expect(queryHistoryPage(history, { visibleCount: 30, filter: "all" }).events).toHaveLength(30);
    expect(window.mock.results[0].value.events).toHaveLength(200);
    offRevision(); offAppend();
    expect(history.getRuntimeCardinality().historyListeners).toBe(0);
  });

  it("batch appends, reset/import without replay, repeated mount/unmount", () => {
    const history = new WorldHistoryStore(); const listener = vi.fn();
    const off = history.subscribeAppends(listener);
    history.beginBatchNotifications(); history.beginBatchNotifications();
    history.addEvent(event(1)); history.addEvent(event(2));
    history.endBatchNotifications(); expect(listener).not.toHaveBeenCalled();
    history.endBatchNotifications(); expect(listener.mock.calls[0][0].events).toHaveLength(2);
    const saved = history.exportState(); history.reset(); history.importState(saved);
    expect(listener.mock.calls.slice(1).map(([change]) => [change.kind, change.events.length])).toEqual([["reset", 0], ["reset", 0]]);
    off(); off();
    for (let i = 0; i < 100; i++) { const unsubscribe = history.subscribeRevision(() => {}); unsubscribe(); }
    expect(history.getRuntimeCardinality().historyListeners).toBe(0);
  });

  it("retrospective order, stable ties, indices and canonical round trip", () => {
    const history = new WorldHistoryStore();
    [100, 200, 50, 150, 250].forEach(month => history.addEvent(event(month)));
    history.addEvent({ ...event(150), id: "tie" });
    expect(history.getEvents().map(e => e.id)).toEqual(["event-250", "event-200", "event-150", "tie", "event-100", "event-50"]);
    expect(history.getEventsBetween(100, 200).map(e => e.id)).toEqual(["event-200", "event-150", "tie", "event-100"]);
    expect(history.getEventsForFaction("A")).toEqual(history.getEvents());
    const saved = history.exportState();
    expect(saved.events.map(e => e.monthIndex)).toEqual([100, 200, 50, 150, 250, 150]);
    const restored = new WorldHistoryStore(); restored.importState(saved);
    expect(restored.exportState()).toEqual(saved);
    expect(restored.getEvents()).toEqual(history.getEvents());
    expect(restored.getEventsBetween(100, 200)).toEqual(history.getEventsBetween(100, 200));
  });

  it.each<HistoryFilter>(["all", "featured", "politics", "war", "god"])("%s pages match full reference including cross-month narrative chains", (filter) => {
    const history = new WorldHistoryStore();
    for (let month = 0; month < 1400; month++) history.addEvent({ ...event(month),
      category: month % 3 === 0 ? "war" : month % 7 === 0 ? "god" : "politics",
      factionIds: [month % 2 ? "A" : "B"], type: month % 9 === 0 ? "alliance-signed" : "city-founded" });
    history.addEvent({ ...event(1202), id: "fall", type: "capital-fallen", historyGroupId: "capital", targetFactionId: "A", importance: "major" });
    history.addEvent({ ...event(1190), id: "move", type: "capital-relocated", historyGroupId: "capital", actorFactionId: "A", importance: "major" });
    history.addEvent({ ...event(1210), id: "collapse", type: "faction-extinct", targetFactionId: "A", importance: "major" });
    history.addEvent({ ...event(1210), id: "capture", type: "ruler-captured", targetFactionId: "A", importance: "major" });
    const ranges: Array<{ startMonth?: number; endMonth?: number }> = [{}, { startMonth: 400, endMonth: 1300 }];
    for (const factionId of [undefined, "A", "B"]) for (const range of ranges) {
      const all = history.getEvents().filter(e => e.year >= (range.startMonth ?? 0) && e.year <= (range.endMonth ?? Infinity));
      const prefiltered = getFilteredHistoryEvents(all, filter === "featured" ? "all" : filter, factionId);
      const grouped = groupHistoryNarratives(prefiltered);
      const reference = filter === "featured" ? getFilteredHistoryEvents(grouped, "featured", factionId) : grouped;
      for (const visibleCount of [1, 30, 200, 400, 2000]) {
        const page = queryHistoryPage(history, { visibleCount, filter, factionId, ...range });
        expect(page.events).toEqual(reference.slice(0, visibleCount));
        expect(page.hasMore).toBe(reference.length > visibleCount);
      }
    }
  });

  it("same-seed canonical state and RNG position agree with debug on/off", () => {
    const run = (debug: boolean) => {
      worldRandom.initialize("history-scalability");
      const history = new WorldHistoryStore(); const profile = new FrameAttribution(debug);
      const off = debug ? history.subscribeRevision(() => queryHistoryPage(history, { visibleCount: 30, filter: "all" })) : () => {};
      for (let i = 0; i < 100; i++) profile.measure("AutoSimulator.advance", () => {
        history.addEvent({ ...event(i), metadata: { evidence: worldRandom.int(0, 100) } });
        profile.finishFrame(16, 2, 1); if (debug) profile.snapshot();
      });
      off();
      const random = worldRandom.exportState();
      return { canonical: history.exportState(), random,
        checkpoint: createDeterminismCheckpoint({ worldMonth: 100, random, factions: [], cities: [], territory: [] }) };
    };
    expect(run(true)).toEqual(run(false));
  });
});
