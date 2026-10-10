import { describe, expect, it } from "vitest";
import { historianNumber, historianSpan, historianTerritory } from "./HistorianVoiceLanguage";
import { buildFactionHistoricalNarrative, type FactionNarrativeEvidence } from "./FactionHistoricalNarrative";
import type { FactionHistoricalEvidence } from "./FactionHistoriography";
import worldRandom from "../Simulation/WorldRandom";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";
const m = (y: number, month = 1) => y * 12 + month - 1;
function facts(extra: Partial<FactionHistoricalEvidence> = {}): FactionHistoricalEvidence {
  const end = m(349, 3);
  return { factionId: 'a', name: '燕', foundedName: '燕', stateFoundedName: '燕', formal: true, terminal: true,
    foundedMonth: 0, stateFoundedMonth: 0, endMonth: end, lifetimeMonths: end, formalMonths: end, activeMonths: m(302, 2), exileMonths: 565,
    rulerCount: 10, formalRulerCount: 10, epochCount: 1, houseCount: 1, usurpationCount: 0, restorationCount: 0,
    wasExiled: true, wasEmperor: false, wasHegemon: false, ending: 'EXTINCT', remnantsDissipated: true,
    totalWorldBlocks: 1225, peakAbsoluteWorldShare: 755 / 1225,
    lifetime: { factionId: 'a', lastObservedMonth: end, peakPopulation: { value: 200, month: m(50), source: 'MONTHLY' },
      peakTerritoryBlocks: { value: 755, month: m(58, 12), source: 'MONTHLY' }, peakCityCount: { value: 8, month: m(60), source: 'MONTHLY' },
      terminal: { month: end, population: 0, cityCount: 0, territoryBlocks: 0 } }, ...extra };
}
function event(type: FactionNarrativeEvidence['type'], month: number, role: FactionNarrativeEvidence['factionRole'], extra: Partial<FactionNarrativeEvidence> = {}): FactionNarrativeEvidence {
  return { eventId: `${type}-${month}`, type, month, factionId: 'a', factionRole: role, factionName: '燕', metadata: {}, ...extra };
}
function yan() {
  return [event('capital-fallen', m(9, 9), 'ACTOR', { actorFactionId: 'a', targetFactionId: 'qi', targetName: '齐', cityName: '临淄', rulerId: 'yan-r', rulerName: '燕王姬惟' }),
    event('capital-fallen', m(131, 8), 'TARGET', { actorName: '临淄义军', cityName: '蓟' }),
    event('city-recovered', m(160), 'ACTOR', { cityName: '蓟' }),
    event('city-captured', m(302, 2), 'TARGET', { cityId: 'handan', cityName: '邯郸', historyGroupId: 'loss' }),
    event('faction-exiled', m(302, 2), 'TARGET', { cityId: 'handan', cityName: '邯郸', historyGroupId: 'loss' }),
    event('dynasty-line-ended', m(349, 3), 'ACTOR')];
}
const story = (e: FactionHistoricalEvidence, events: FactionNarrativeEvidence[]) => buildFactionHistoricalNarrative(e, events);
describe('commentary style isolated from exact historical statistics', () => {
  it('verbalizes known values without converting names or whole prose', () => {
    expect(historianTerritory(.616)).toBe('天下六成有余'); expect(historianTerritory(.569)).toBe('天下过半之地');
    expect(historianTerritory(.6)).toBe('天下六成'); expect(historianTerritory(.5)).toBe('天下半数之地');
    expect(historianSpan(47 * 12 + 1)).toBe('四十余载'); expect(historianSpan(40 * 12 + 9)).toBe('四十余载');
    expect(historianSpan(9 * 12 + 4)).toBe('未及十载'); expect(historianSpan(40 * 12)).toBe('四十载');
    expect(historianSpan(0)).toBe('同月'); expect(historianSpan(1)).toBe('未及一年');
    expect(historianNumber(37)).toBe('三十七'); expect(historianNumber(101)).toBe('一百零一');
  });
  it('Yan keeps its documented person, peak and separate losses without claiming Ji was never recovered', () => {
    const e = facts(), events = yan(), before = JSON.stringify({ e, events }), a = story(e, events);
    expect(a.voice).toContain('燕王姬惟亲征取临淄'); expect(a.voice).toContain('天下六成有余');
    expect(a.voice).toContain('蓟曾失'); expect(a.voice).toContain('邯郸'); expect(a.voice).toContain('四十余载');
    expect(a.voice).not.toMatch(/[0-9%]|个月|年月|一直|从未|长守蓟|半壁之盛与无土之久相映/);
    expect(a.lines[0]).toContain('755格'); expect(a.lines[0]).toContain('61.6%'); expect(a.lines[0]).toContain('58年12月');
    expect(a.lines[0]).toContain('131年8月'); expect(a.lines[0]).toContain('302年2月'); expect(a.lines[0]).toContain('47年1个月');
    expect(a.selectedArguments[0].argumentKey).toBe('EXPANSION_CAPITAL_FINAL_LOSS');
    expect(a.milestones.map(x => x.month)).toEqual(a.milestones.map(x => x.month).sort((a, b) => a - b));
    expect(JSON.stringify({ e, events })).toBe(before);
  });
  it('Wei rapid reversal and Qi exile remain different without statistical months in either voice', () => {
    const weak = facts({ name: '魏', peakAbsoluteWorldShare: .2 });
    const wei = story(weak, [event('capital-fallen', m(4, 7), 'ACTOR', { factionName: '魏', targetFactionId: 'han', targetName: '韩', cityName: '新郑' }),
      event('capital-fallen', m(13, 11), 'TARGET', { factionName: '魏', cityName: '大梁', actorName: '赵' })]);
    const qi = story(facts({ name: '齐', endMonth: m(50, 6), peakAbsoluteWorldShare: .2 }), [event('faction-exiled', m(9, 9), 'TARGET', { factionName: '齐', cityName: '临淄' })]);
    expect(wei.voice).toContain('未及十载'); expect(wei.voice).toContain('新郑'); expect(wei.voice).toContain('大梁');
    expect(qi.voice).toContain('四十余载'); expect(qi.voice).toContain('临淄'); expect(qi.voice).not.toContain('攻城所得');
    expect(qi.lines[0]).toContain('40年9个月'); expect(wei.lines[0]).toContain('4年7月');
    expect(wei.voice + qi.voice).not.toMatch(/[0-9%]|个月/);
  });
  it('Yuan former capital attack and later union do not turn a past peak into end-of-reign power', () => {
    const e = facts({ name: '元', ending: 'MERGED', targetName: '淄', targetFactionId: 'zi', peakAbsoluteWorldShare: .569, endMonth: m(600) });
    const a = story(e, [event('capital-fallen', m(10), 'ACTOR', { factionName: '元', targetFactionId: 'zi', targetName: '淄', cityName: '临淄' }),
      event('faction-merged', m(600), 'ABSORBED')]);
    expect(a.voice).toContain('昔取淄都临淄'); expect(a.voice).toContain('盛时曾据天下过半');
    expect(a.voice).toContain('并入淄（同源合邦）'); expect(a.voice).not.toMatch(/当时仍|合邦前.*过半|灭国|战败|战死|兄弟|血缘|[0-9%]/);
    expect(a.selectedArguments[0].argumentKey).toBe('FORMER_OPPONENT_UNION');
  });
  it('actual restoration remains distinct from retaking an old capital without changing argument selection', () => {
    const e = facts({ peakAbsoluteWorldShare: .2, restorationCount: 1 });
    const events = [event('faction-exiled', m(100), 'TARGET'), event('faction-restored', m(200), 'ACTOR', { cityName: '故城' })];
    const a = story(e, events);
    expect(a.narrative.join('')).toContain('故城复国'); expect(a.selectedArguments.some(x => x.argumentKey === 'EXILE_CONTINUITY')).toBe(false);
    const twice = story({ ...e, restorationCount: 2 }, [...events, event('faction-restored', m(250), 'ACTOR', { cityName: '再起城' })]);
    expect(twice.voice).toContain('二次复国'); expect(twice.lines[0]).toContain('复国2次');
    expect(twice.voice).not.toMatch(/[0-9%]|个月/);
    expect(story({ ...e, restorationCount: 0 }, [event('city-recovered', m(200), 'ACTOR', { cityName: '故城' })]).voice).not.toContain('复国');
  });
  it('same-month usurpation keeps factual house change without invented causal blame', () => {
    const loss = m(300), e = facts({ houseCount: 2, epochCount: 2, usurpationCount: 1, peakAbsoluteWorldShare: .2 });
    const a = story(e, [event('dynasty-usurped', loss, 'ACTOR', { metadata: { oldHouseName: '刘氏', newHouseName: '张氏' } }), event('faction-exiled', loss, 'TARGET', { cityName: '临淄' })]);
    expect(a.voice).toContain('张氏方接王统'); expect(a.lines[0]).toContain('张氏取代刘氏');
    expect(a.voice).not.toMatch(/导致|因此|权臣|将军|[0-9%]/);
  });
  it('submission and sparse short states do not acquire deaths, kinship or fabricated episodes', () => {
    const submitted = story(facts({ ending: 'SUBMITTED', targetName: '楚', targetFactionId: 'chu' }), [event('faction-submitted', m(349, 3), 'SUBMITTED')]);
    expect(submitted.lines[0]).toContain('纳土退位'); expect(submitted.voice).not.toMatch(/同源|战死|被杀|血脉/);
    const sparse = story(facts({ endMonth: 48, formalMonths: 48, lifetimeMonths: 48, peakAbsoluteWorldShare: .01 }), []);
    expect(sparse.voice).not.toMatch(/亲征|称帝|临淄|篡朝|[0-9%]/); expect(sparse.selectedArguments[0].argumentKey).toBe('SHORT_FORMAL_STATE');
  });
  it('never strips digits from names or changes deterministic source data and RNG', () => {
    const e = facts(), events = yan(); events[0].rulerName = '燕王甲2'; events[0].cityName = '第3城';
    const rng = worldRandom.exportState(), before = JSON.stringify({ e, events }), a = story(e, events);
    expect(a.voice).toContain('燕王甲2'); expect(a.voice).toContain('第3城');
    expect(story(JSON.parse(JSON.stringify(e)), JSON.parse(JSON.stringify(events)))).toEqual(a);
    expect(JSON.stringify({ e, events })).toBe(before); expect(worldRandom.exportState()).toEqual(rng);
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(12);
  });
});
