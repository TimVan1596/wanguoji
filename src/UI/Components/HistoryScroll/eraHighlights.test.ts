import { describe, expect, it, vi } from "vitest";
import { WorldHistoryStore, type WorldEvent } from "../../../History/WorldHistory";
import { groupHistoryNarratives } from "../../../History/HistoryNarrativeGrouper";
import { queryEraHighlights, selectEraHighlights, isAfterEraSnapshot } from "./eraHighlights";
import { VISIBLE_MAJOR_EVENT_FILTERS, normalizeVisibleMajorEventFilter, matchesMajorEventFilter } from "../../../History/HistoryMajorEventFilters";
import { eraSelectionUIReducer, initialEraSelectionUIState, getAtlasEraForEvent } from "./eraSelection";
import { queryHistoryPage } from "../../../History/HistoryPageQuery";
import worldRandom from "../../../Simulation/WorldRandom";
const era = { id: 'era', startMonth: 0, endMonth: 1500 };
const event = (type: WorldEvent['type'], year: number, id = `${type}-${year}`): WorldEvent => ({ id, type, year, category: 'politics', importance: 'major', title: '攻陷', actorFactionId: 'a' });
describe('era highlights, editorial selection over authoritative history', () => {
  it('excludes routine conquests and diplomacy, without filler or title-based promotion', () => {
    const input = [event('state-founded', 5), event('city-captured', 20), event('alliance-signed', 25), event('relation-renewed', 30), event('capital-fallen', 40)];
    expect(selectEraHighlights(era, input, 1500).map(e => e.type)).toEqual(['capital-fallen', 'state-founded']);
    expect(selectEraHighlights(era, [event('city-captured', 1)], 1500)).toEqual([]);
    expect(selectEraHighlights(era, [{ ...event('city-captured', 1), metadata: { wasCapital: 1 } }], 1500)).toHaveLength(1);
  });
  it('retains early political landmarks across the entire era rather than the newest page', () => {
    const store = new WorldHistoryStore();
    const types = ['world-unification', 'emperor-proclaimed', 'dynasty-usurped', 'faction-restored', 'faction-merged', 'faction-submitted', 'state-founded', 'capital-fallen', 'faction-exiled', 'faction-extinct'] as const;
    types.forEach((type, i) => store.addEvent(event(type, i * 10)));
    for (let i = 100; i < 1500; i++) store.addEvent(event('city-captured', i));
    expect(new Set(queryEraHighlights(store, era, 1500).map(e => e.type))).toEqual(new Set(types));
    expect(queryEraHighlights(store, era, 1500)).toHaveLength(10);
  });
  it('groups one fall once while preserving much later extinction as a distinct event', () => {
    const input = ['city-captured', 'capital-fallen', 'faction-exiled'].map(type => ({ ...event(type as WorldEvent['type'], 50, type), targetFactionId: 'b', historyGroupId: 'fall', cityName: '都' }));
    input.push({ ...event('faction-extinct', 500), targetFactionId: 'b', historyGroupId: 'end', cityName: '都' });
    const selected = selectEraHighlights(era, groupHistoryNarratives(input), 1500);
    expect(selected.map(e => e.type)).toEqual(['faction-extinct', 'faction-exiled']);
    expect(selected[1].metadata?.groupedEventCount).toBe(3);
  });
  it('uses range/cutoff/revision keys, clears on hydration, and never queries future events', () => {
    const store = new WorldHistoryStore(); [10, 20, 100].forEach(month => store.addEvent(event('state-founded', month)));
    expect(queryEraHighlights(store, { ...era, startMonth: 15 }, 50).map(e => e.year)).toEqual([20]);
    const cached = queryEraHighlights(store, era, 50), window = vi.spyOn(store, 'getEventWindow');
    expect(queryEraHighlights(store, era, 50)).toBe(cached); expect(window).not.toHaveBeenCalled();
    store.addEvent(event('dynasty-usurped', 30));
    expect(queryEraHighlights(store, era, 50).map(e => e.year)).toEqual([30, 20, 10]);
    store.importState(new WorldHistoryStore().exportState());
    expect(queryEraHighlights(store, era, 50)).toEqual([]);
  });
  it('balances distinct stages and categories deterministically without altering events', () => {
    const input = Array.from({ length: 30 }, (_, i) => event('state-founded', 1400 + i));
    input.push(event('state-founded', 5), event('state-founded', 750), event('dynasty-usurped', 800), event('faction-submitted', 1000));
    const before = JSON.stringify(input), selected = selectEraHighlights(era, input, 1500);
    expect(selected.some(e => e.year === 5)).toBe(true); expect(selected.some(e => e.year >= 500 && e.year < 1000)).toBe(true);
    expect(selected.some(e => e.type === 'dynasty-usurped')).toBe(true);
    expect(selectEraHighlights(era, [...input].reverse(), 1500)).toEqual(selected);
    expect(JSON.stringify(input)).toBe(before);
    expect(selected.map(e => e.year)).toEqual(selected.map(e => e.year).sort((a, b) => b - a));
  });
  it('20k events and 100 eras use bounded indexed queries and preserve canonical save/RNG', () => {
    const store = new WorldHistoryStore(); for (let i = 0; i < 20000; i++) store.addEvent(event(i % 200 === 0 ? 'emperor-proclaimed' : 'city-captured', i));
    const full = vi.spyOn(store, 'getEvents'), window = vi.spyOn(store, 'getEventWindow'), before = store.exportState(), rng = worldRandom.exportState();
    for (let i = 0; i < 100; i++) expect(queryEraHighlights(store, { id: `era-${i}`, startMonth: i * 200, endMonth: i * 200 + 199 }, 20000)).toHaveLength(1);
    expect(window).toHaveBeenCalledTimes(100); expect(full).not.toHaveBeenCalled();
    expect(window.mock.calls.every(([options]) => options.limit === 200)).toBe(true);
    expect(store.exportState()).toEqual(before); expect(worldRandom.exportState()).toEqual(rng);
    const restored = new WorldHistoryStore(); restored.importState(before);
    expect(queryEraHighlights(restored, era, 1500)).toEqual(queryEraHighlights(store, era, 1500));
  });
  it('snapshot warning uses event month and has no guessed fallback', () => {
    expect(isAfterEraSnapshot(event('state-founded', 20), 10)).toBe(true);
    expect(isAfterEraSnapshot(event('state-founded', 10), 10)).toBe(false);
    expect(isAfterEraSnapshot({ ...event('state-founded', 20), monthIndex: 5 }, 10)).toBe(false);
    expect(isAfterEraSnapshot(event('state-founded', 20))).toBe(false);
  });
  it('consolidates the visible entry while retaining legacy queries, exact era map links and complete history', () => {
    expect(VISIBLE_MAJOR_EVENT_FILTERS.some(item => (item.value as string) === 'era')).toBe(false);
    expect(normalizeVisibleMajorEventFilter('era')).toBe('all'); expect(normalizeVisibleMajorEventFilter('revolution')).toBe('revolution');
    expect(matchesMajorEventFilter(event('world-era-started', 30), 'all')).toBe(true);
    const open = eraSelectionUIReducer(initialEraSelectionUIState, { type: 'OPEN_ERA_MAP', eraId: era.id });
    const history = eraSelectionUIReducer(open, { type: 'SELECT', eraId: era.id });
    expect(history).toMatchObject({ selectedEraId: era.id, eraMapOpen: false });
    const store = new WorldHistoryStore(); store.addEvent(event('city-captured', 20));
    expect(queryHistoryPage(store, { visibleCount: 200, filter: 'all', eventTypeFilter: 'all', startMonth: era.startMonth, endMonth: era.endMonth }).events).toHaveLength(1);
    expect(getAtlasEraForEvent({ ...event('world-era-started', 30), metadata: { eraId: era.id } }, [{ ...era, confirmedMonth: 40 } as import('../../../Simulation/WorldEra').WorldEra])?.id).toBe(era.id);
  });
});
