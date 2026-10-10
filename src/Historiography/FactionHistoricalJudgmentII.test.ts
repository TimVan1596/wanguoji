import { describe, expect, it } from "vitest";
import { deriveFactionAssessment, type HistoricalFaction, type FactionHistoryContext } from "./FactionHistoriography";
import type { WorldEvent, WorldEventType } from "../History/WorldHistory";
import type { Ruler } from "../Politics/Dynasty";
import { WorldHistoryStore } from "../History/WorldHistory";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";
import { shouldExileBecomeExtinct } from "../Politics/ExileRules";
import worldRandom from "../Simulation/WorldRandom";
const m = (year: number, month = 1) => year * 12 + month - 1;
const ev = (type: WorldEventType, month: number, extra: Partial<WorldEvent>): WorldEvent => ({ id: `${type}-${month}`, type, year: month, monthIndex: month, title: '史料', category: 'politics', importance: 'major', ...extra });
// Synthetic, verifiable archives inspired by reported trajectories; no user save is assumed to exist.
function fixture(kind: '燕' | '赵' | '魏' | '齐'): FactionHistoryContext {
  const ends = { 燕: m(349, 3), 赵: m(162, 12), 魏: m(91, 3), 齐: m(50, 6) };
  const falls = { 燕: m(302, 2), 赵: m(106, 8), 魏: m(13, 11), 齐: m(9, 9) };
  const city = { 燕: '邯郸', 赵: '邯郸', 魏: '大梁', 齐: '临淄' }[kind];
  const nation = (name: string): HistoricalFaction => ({ name: `${name}-id`, displayName: `今日${name}`, status: 'EXTINCT', identityStage: 'STATE', firstFoundedYear: 0, stateFoundedMonth: 0,
    terminationMonth: ends[kind], extinctionYear: ends[kind], terminationReason: 'EXTINCT', cumulativeActiveYears: falls[kind], lastExiledYear: falls[kind], restorationYears: [],
    sovereigntyHistory: [{ rank: 'KING', startMonth: 0 }], nameHistory: [{ name, startMonth: 0 }] });
  const own = nation(kind), factions = new Map(['燕', '赵', '魏', '齐', '韩', '临淄义军'].map(name => { const f = name === kind ? own : nation(name); return [f.name, f] as const; }));
  const ruler: Ruler = { id: `${kind}-r1`, givenName: kind === '燕' ? '惟' : '初', houseName: '姬氏', bornYear: 0, accessionYear: 0, endYear: m(30), status: 'dead' };
  const c: FactionHistoryContext = { faction: own, factions, dynasty: { rulers: [ruler], houseEpochs: [{ houseName: '姬氏', startMonth: 0, foundingRulerId: ruler.id, startReason: 'FOUNDING' }] },
    totalWorldBlocks: 1225, lifetime: { factionId: own.name, lastObservedMonth: ends[kind],
      peakPopulation: { value: 120, month: m(5), source: 'MONTHLY' },
      peakTerritoryBlocks: { value: kind === '燕' ? 755 : 180, month: kind === '燕' ? m(58, 12) : m(5), source: 'MONTHLY' },
      peakCityCount: { value: kind === '燕' ? 6 : 2, month: m(6), source: 'MONTHLY' }, terminal: { month: ends[kind], population: 0, territoryBlocks: 0, cityCount: 0 } },
    events: [ev('state-founded', 0, { actorFactionId: own.name }),
      ev('capital-fallen', falls[kind], { actorFactionId: kind === '燕' ? undefined : kind === '齐' ? '燕-id' : kind === '魏' ? '赵-id' : '燕-id', targetFactionId: own.name, cityId: city, cityName: city, historyGroupId: 'final' }),
      ev('faction-exiled', falls[kind], { targetFactionId: own.name, cityId: city, cityName: city, historyGroupId: 'final' }),
      ev('dynasty-line-ended', ends[kind], { actorFactionId: own.name }), ev('faction-extinct', ends[kind], { targetFactionId: own.name, title: '残部消散，王统断绝' })] };
  if (kind !== '齐') c.events = [...c.events, ev('capital-fallen', kind === '燕' ? m(9, 9) : kind === '赵' ? m(13, 11) : m(4, 7), {
    actorFactionId: own.name, targetFactionId: kind === '燕' ? '齐-id' : kind === '赵' ? '魏-id' : '韩-id', cityName: kind === '燕' ? '临淄' : kind === '赵' ? '大梁' : '新郑',
    rulerId: kind === '燕' ? ruler.id : undefined })];
  if (kind === '燕') c.events = [...c.events, ev('capital-fallen', m(131, 8), { actorFactionId: '临淄义军-id', targetFactionId: own.name, cityName: '蓟', cityId: 'ji' })];
  return c;
}
const assess = (c: FactionHistoryContext) => deriveFactionAssessment(c)!;
describe('personalized judgments from factual chains, not random synonym variants', () => {
  it('a half-world expansion with distinct capital and final foothold losses outranks a simple reversal', () => {
    const a = assess(fixture('燕'));
    expect(a.selectedArguments[0].argumentKey).toBe('EXPANSION_CAPITAL_FINAL_LOSS');
    expect(a.selectedArguments.some(x => x.argumentKey === 'ATTACK_DEFENSE_REVERSAL')).toBe(false);
    expect(a.selectedArguments[0].supportingEventIds).toEqual(expect.arrayContaining([`capital-fallen-${m(9, 9)}`, `capital-fallen-${m(131, 8)}`, `faction-exiled-${m(302, 2)}`]));
    expect(a.selectedArguments[0].supportingMetricKeys).toContain('lifetime.peakTerritoryBlocks');
    const both = a.lines.join('') + a.narrative.join('');
    for (const fact of ['燕王姬惟亲征', '临淄', '755格', '61.6%', '58年12月', '蓟', '131年8月', '邯郸', '302年2月', '47年1个月']) expect(both).toContain(fact);
    expect(a.voice).not.toMatch(/今日|民心|报应|复仇|权臣|导致/);
    expect(a.milestones.map(x => x.month)).toEqual(a.milestones.map(x => x.month).sort((x, y) => x - y));
    expect(a.selectedArguments.length).toBeLessThanOrEqual(2);
  });
  it('Zhao long reversal, Wei quick reversal and Qi exile have distinguishable factual emphasis', () => {
    const zhao = assess(fixture('赵')), wei = assess(fixture('魏')), qi = assess(fixture('齐'));
    expect(zhao.voice).toContain('之后'); expect(zhao.lines[0]).toContain('13年11月'); expect(zhao.lines[0]).toContain('106年8月'); expect(zhao.voice).toContain('九十余载');
    expect(wei.voice).toContain('未及十载'); expect(wei.lines[0]).toContain('4年7月'); expect(wei.lines[0]).toContain('13年11月');
    expect(qi.lines[0]).toContain('40年9个月'); expect(qi.lines.join('')).toContain('50年6月'); expect(qi.voice).toContain('四十余载'); expect(qi.voice).toContain('临淄');
    expect(qi.voice).not.toMatch(/攻人之都|两役|亲征/);
    expect(new Set([zhao.voice, wei.voice, qi.voice]).size).toBe(3);
    // Commentary differs from the factual judgment rather than repeating its first sentence.
    expect(zhao.voice).not.toContain(zhao.lines[0]);
  });
  it('a long dynastic accumulation outranks an incidental simple reversal without erasing it', () => {
    const c = fixture('赵'), end = m(700), loss = m(600);
    c.faction.terminationMonth = end; c.faction.extinctionYear = end; c.faction.lastExiledYear = loss;
    c.faction.cumulativeActiveYears = loss; c.lifetime.lastObservedMonth = end; c.lifetime.terminal!.month = end;
    c.dynasty!.rulers = Array.from({ length: 20 }, (_, i) => ({ id: `r-${i}`, houseName: '姬氏', givenName: '某', bornYear: 0,
      accessionYear: m(i * 35), endYear: m((i + 1) * 35), status: 'dead' as const }));
    c.events = c.events.filter(e => !['faction-exiled', 'faction-extinct', 'dynasty-line-ended'].includes(e.type));
    c.events = [...c.events, ev('faction-exiled', loss, { targetFactionId: c.faction.name, cityName: '末城' }),
      ev('faction-extinct', end, { targetFactionId: c.faction.name })];
    const a = assess(c);
    expect(a.selectedArguments[0].argumentKey).toBe('LONG_RULE_COLLAPSE');
    expect(a.arguments.some(x => x.argumentKey === 'ATTACK_DEFENSE_REVERSAL')).toBe(true);
    expect(a.lines.join('')).toContain('700年'); expect(a.voice).toContain('七百载'); expect(a.voice).toContain('二十君');
  });
  it('no documented distinct capital phase means no invented three-stage trajectory', () => {
    const c = fixture('燕'); c.events = c.events.filter(e => e.cityName !== '蓟');
    expect(assess(c).arguments.some(a => a.argumentKey === 'EXPANSION_CAPITAL_FINAL_LOSS')).toBe(false);
    expect(assess(c).voice).not.toContain('蓟');
    c.events = c.events.filter(e => e.type !== 'faction-exiled');
    expect(assess(c).arguments.some(a => a.argumentKey === 'EXPANSION_CAPITAL_FINAL_LOSS')).toBe(false);
  });
  it('person belongs to the acting faction and documented reign, never the current faction or claimant', () => {
    const c = fixture('燕'); c.dynasty!.rulers[0].accessionYear = m(10);
    expect(assess(c).voice).not.toMatch(/姬惟|亲征/);
    c.dynasty!.rulers[0].accessionYear = 0;
    c.events = c.events.map(e => e.rulerId ? { ...e, rulerId: 'foreign-unverified', metadata: { rulerName: '虚构姓名' } } : e);
    expect(assess(c).voice).not.toMatch(/虚构姓名|姬惟|亲征/);
  });
  it('event-month names survive later regime renaming', () => {
    const c = fixture('燕'); c.faction.nameHistory = [{ name: '燕', startMonth: 0, endMonth: m(200) - 1 }, { name: '新国号', startMonth: m(200) }];
    const a = assess(c);
    expect(a.lines[0]).toContain('燕攻取齐都临淄'); expect(a.voice).toContain('燕王姬惟');
    expect(a.narrative.at(-1)).toContain('新国号'); expect(a.voice).not.toContain('今日燕');
  });
  it.each(['燕', '赵', '魏', '齐'] as const)('%s narrative is unchanged by JSON/historical archive round-trip or RNG state', kind => {
    const c = fixture(kind), rng = worldRandom.exportState(), raw = JSON.stringify({ faction: c.faction, dynasty: c.dynasty, lifetime: c.lifetime, totalWorldBlocks: c.totalWorldBlocks, events: c.events });
    const store = new WorldHistoryStore(); c.events.forEach(e => store.addEvent(e));
    const restoredStore = new WorldHistoryStore(); restoredStore.importState(store.exportState());
    const restored: FactionHistoryContext = { ...JSON.parse(raw), factions: new Map([...c.factions].map(([id, f]) => [id, JSON.parse(JSON.stringify(f))])), events: restoredStore.getEventsForFaction(c.faction.name) };
    expect(assess(restored)).toEqual(assess(c)); expect(worldRandom.exportState()).toEqual(rng); expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(13);
    expect(JSON.stringify({ faction: c.faction, dynasty: c.dynasty, lifetime: c.lifetime, totalWorldBlocks: c.totalWorldBlocks, events: c.events })).toBe(raw);
  });
  it('a living claimant prevents exile extinction even with no remnants or legitimacy', () => {
    expect(shouldExileBecomeExtinct(0, 0, true)).toBe(false);
    expect(shouldExileBecomeExtinct(0, 0, false)).toBe(true);
  });
});
