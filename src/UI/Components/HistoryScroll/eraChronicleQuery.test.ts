import { describe, expect, it, vi } from "vitest";
import { WorldHistoryStore, type WorldEvent } from "../../../History/WorldHistory";
import { queryEraChroniclePage } from "./eraChronicleQuery";
import { getHistoryCardPresentation } from "../../../History/HistoryCardPresentation";
import worldRandom from "../../../Simulation/WorldRandom";
const event = (month: number, id = `e-${month}`, type: WorldEvent['type'] = 'state-founded'): WorldEvent => ({ id, type, year: month, actorFactionId: 'a', title: type, category: 'politics', importance: 'major' });
describe("era chronicle bounded canonical queries", () => {
  it("caps open and closed eras at the actual world month, without future events", () => {
    const store = new WorldHistoryStore(); for (let i = 0; i <= 30; i++) store.addEvent(event(i));
    const era = { startMonth: 10, endMonth: 20 };
    expect(queryEraChroniclePage(store, era, 15).events.map(e => e.year)).toEqual([15, 14, 13, 12, 11, 10]);
    expect(queryEraChroniclePage(store, { startMonth: 10 }, 15)).toEqual(queryEraChroniclePage(store, era, 15));
    expect(queryEraChroniclePage(store, { startMonth: 40 }, 15).events).toEqual([]);
    expect(queryEraChroniclePage(store, era, 30).events.map(e => e.year)).toEqual([20, 19, 18, 17, 16, 15, 14, 13, 12, 11]);
  });
  it("groups capture, capital loss and exile once and excludes diplomacy even with major importance", () => {
    const store = new WorldHistoryStore();
    for (const type of ['city-captured', 'capital-fallen', 'faction-exiled'] as const)
      store.addEvent({ ...event(50, type, type), targetFactionId: 'b', historyGroupId: 'fall', cityName: '新郑' });
    for (const type of ['relation-renewed', 'alliance-signed', 'non-aggression-signed', 'truce-signed'] as const) store.addEvent(event(51, type, type));
    const page = queryEraChroniclePage(store, { startMonth: 40, endMonth: 60 }, 60);
    expect(page.events).toHaveLength(1); expect(page.events[0].metadata?.groupedEventCount).toBe(3);
    expect(page.events[0].type).toBe('faction-exiled');
  });
  it("keeps 20k events bounded and paginates without omissions or duplicate page accumulation", () => {
    const store = new WorldHistoryStore(); for (let i = 0; i < 20000; i++) store.addEvent(event(i));
    const full = vi.spyOn(store, 'getEvents'), window = vi.spyOn(store, 'getEventWindow'), rng = worldRandom.exportState();
    const era = { startMonth: 1000, endMonth: 1099 };
    let page = queryEraChroniclePage(store, era, 19000), ids: string[] = [];
    for (;;) {
      expect(page.events.length).toBeLessThanOrEqual(10); ids.push(...page.events.map(e => e.id));
      if (!page.cursor) break;
      expect(page.cursor.remaining.length).toBeLessThanOrEqual(200);
      page = queryEraChroniclePage(store, era, 19000, page.cursor);
    }
    expect(ids).toEqual(Array.from({ length: 100 }, (_, i) => `e-${1099 - i}`));
    expect(full).not.toHaveBeenCalled(); expect(window).toHaveBeenCalledTimes(1);
    expect(window.mock.calls[0][0]).toMatchObject({ startMonth: 1000, endMonth: 1099, limit: 200 });
    expect(worldRandom.exportState()).toEqual(rng);
    expect(queryEraChroniclePage(store, { startMonth: 1500, endMonth: 1501 }, 19000).events.map(e => e.id)).toEqual(['e-1501', 'e-1500']);
  });
  it("keeps event-time country names through a rename inside the same era and does not mutate canonical history", () => {
    const store = new WorldHistoryStore(); store.addEvent(event(50)); store.addEvent(event(150));
    const before = store.exportState(), factions = new Map([['a', { name: 'a', displayName: '今天', color: 0x123456,
      nameHistory: [{ name: '秦', startMonth: 0, endMonth: 99 }, { name: '鄄', startMonth: 100 }] }]]);
    const page = queryEraChroniclePage(store, { startMonth: 0, endMonth: 200 }, 200);
    expect(getHistoryCardPresentation(page.events[0], undefined, factions).title).toContain('鄄');
    expect(getHistoryCardPresentation(page.events[1], undefined, factions).title).toContain('秦');
    expect(store.exportState()).toEqual(before);
    const restored = new WorldHistoryStore(); restored.importState(before);
    expect(queryEraChroniclePage(restored, { startMonth: 0, endMonth: 200 }, 200)).toEqual(page);
  });
});
