import { collectFactionNarrativeEvidence, buildFactionHistoricalNarrative } from "./FactionHistoricalNarrative";
import type { Ruler } from "../Politics/Dynasty";
import type { Dynasty } from "../Politics/Dynasty";
import type { WorldEvent } from "../History/WorldHistory";
import type { FactionLifetimeRecord } from "../Simulation/FactionLifetimeRecord";
import { getLifetimeAbsoluteWorldShare } from "../Simulation/FactionLifetimeRecord";
import { formatWorldDate, formatWorldDuration } from "../Simulation/WorldTime";
import { getFactionDisplayNameAtMonth } from "../Simulation/FactionIdentity";

export interface HistoricalFaction {
  name: string; displayName: string; status: string; identityStage: string;
  firstFoundedYear: number; origin?: { foundedMonth: number }; stateFoundedMonth?: number;
  extinctionYear?: number; terminationMonth?: number; terminationReason?: "EXTINCT" | "MERGED" | "SUBMITTED";
  terminationTargetFactionId?: string; cumulativeActiveYears: number;
  restorationYears: number[]; lastExiledYear?: number; proclaimedEmperorMonth?: number;
  sovereigntyHistory: { rank: string; startMonth: number; endMonth?: number }[];
  nameHistory: { name: string; startMonth: number; endMonth?: number }[];
}
export interface FactionHistoricalEvidence {
  factionId: string; name: string; foundedName: string; stateFoundedName?: string; formal: boolean; terminal: boolean;
  foundedMonth: number; stateFoundedMonth?: number; endMonth?: number;
  lifetimeMonths: number; formalMonths?: number; activeMonths: number; exileMonths: number;
  rulerCount: number; formalRulerCount: number; epochCount: number; houseCount: number;
  usurpationCount: number; restorationCount: number; wasExiled: boolean; wasEmperor: boolean; wasHegemon: boolean;
  ending?: "EXTINCT" | "MERGED" | "SUBMITTED"; targetName?: string; targetFactionId?: string;
  remnantsDissipated: boolean; terminalEventId?: string;
  lifetime: FactionLifetimeRecord; totalWorldBlocks: number; peakAbsoluteWorldShare: number;
}
export interface FactionHistoryContext {
  faction: HistoricalFaction; dynasty?: Pick<Dynasty, "rulers" | "houseEpochs">;
  lifetime: FactionLifetimeRecord; totalWorldBlocks: number;
  resolveRuler?: (rulerId: string, factionId: string) => Ruler | undefined;
  events: readonly WorldEvent[]; factions: ReadonlyMap<string, HistoricalFaction>;
}
export function deriveFactionHistoricalEvidence(context: FactionHistoryContext): FactionHistoricalEvidence {
  const { faction: f, dynasty, lifetime, events, factions, totalWorldBlocks } = context;
  const terminal = f.status === "EXTINCT" && lifetime.terminal !== undefined;
  const endMonth = terminal ? lifetime.terminal!.month : undefined;
  const foundedMonth = f.origin?.foundedMonth ?? f.firstFoundedYear;
  const end = endMonth ?? lifetime.lastObservedMonth;
  const formal = f.identityStage === "STATE" && f.stateFoundedMonth !== undefined;
  const rulers = (dynasty?.rulers ?? []).filter(r => r.accessionYear !== undefined && r.accessionYear <= end);
  // Includes a leader who acceded before formal founding and remained in office at founding.
  const formalRulers = formal ? rulers.filter(r => (r.endYear ?? end) >= f.stateFoundedMonth! && r.accessionYear! <= end) : [];
  const epochs = (dynasty?.houseEpochs ?? []).filter(e => e.startMonth <= end);
  const ending = terminal ? f.terminationReason ?? "EXTINCT" : undefined;
  const terminalType = ending === "SUBMITTED" ? "faction-submitted" : ending === "MERGED" ? "faction-merged" : "faction-extinct";
  const terminalEvent = events.find(e => e.type === terminalType && (e.monthIndex ?? e.year) === endMonth &&
    (ending === "MERGED" ? e.metadata?.absorbedFactionId === f.name : ending === "SUBMITTED" ? (e.metadata?.submittedFactionId ?? e.actorFactionId) === f.name : (e.targetFactionId === f.name || e.factionIds?.includes(f.name))));
  const target = f.terminationTargetFactionId ? factions.get(f.terminationTargetFactionId) : undefined;
  const activeMonths = f.cumulativeActiveYears;
  return { factionId: f.name, name: getFactionDisplayNameAtMonth(f, end), formal, terminal, foundedMonth, stateFoundedMonth: f.stateFoundedMonth,
    foundedName: getFactionDisplayNameAtMonth(f, foundedMonth), stateFoundedName: formal ? getFactionDisplayNameAtMonth(f, f.stateFoundedMonth!) : undefined,
    endMonth, lifetimeMonths: Math.max(0, end - foundedMonth), formalMonths: formal ? Math.max(0, end - f.stateFoundedMonth!) : undefined,
    activeMonths, exileMonths: Math.max(0, end - foundedMonth - activeMonths), rulerCount: rulers.length, formalRulerCount: formalRulers.length,
    epochCount: epochs.length, houseCount: new Set(epochs.map(e => e.houseName)).size,
    usurpationCount: epochs.filter(e => e.startReason === "USURPATION").length, restorationCount: f.restorationYears.length,
    wasExiled: f.lastExiledYear !== undefined || f.restorationYears.length > 0,
    wasEmperor: f.proclaimedEmperorMonth !== undefined || f.sovereigntyHistory.some(e => e.rank === "EMPEROR" && e.startMonth <= end),
    wasHegemon: events.some(e => e.type === "world-hegemony" && e.actorFactionId === f.name && (e.monthIndex ?? e.year) <= end),
    ending, targetFactionId: f.terminationTargetFactionId, targetName: target ? getFactionDisplayNameAtMonth(target, end) : f.terminationTargetFactionId,
    remnantsDissipated: ending === "EXTINCT" && Boolean(terminalEvent && /残部.*消散/.test(terminalEvent.title)), terminalEventId: terminalEvent?.id,
    lifetime, totalWorldBlocks, peakAbsoluteWorldShare: getLifetimeAbsoluteWorldShare(lifetime, totalWorldBlocks) };
}
export interface FactionHistoricalProfile { key: string; label: string; evidenceFields: string[]; reason: string }
export function classifyFactionHistoricalProfile(e: FactionHistoricalEvidence): FactionHistoricalProfile[] {
  const profiles: FactionHistoricalProfile[] = [];
  const add = (condition: boolean, key: string, label: string, fields: string[], reason: string) => { if (condition) profiles.push({ key, label, evidenceFields: fields, reason }); };
  add(!e.formal, "PROVISIONAL", "未正式建国势力", ["stateFoundedMonth"], "没有正式建国记录");
  add(e.lifetimeMonths <= 60, "SHORT", "短命政权", ["lifetimeMonths"], "势力历时不超过5年");
  add(e.lifetimeMonths >= 1200, "LONG", "长期存续政权", ["lifetimeMonths"], "势力存续至少100年");
  add(e.wasEmperor, "EMPIRE", "曾经称帝", ["wasEmperor"], "存在称帝或EMPEROR王权记录");
  add(e.wasHegemon, "HEGEMONY", "曾经称霸", ["wasHegemon"], "存在该国确立霸权事件");
  add(e.houseCount > 1, "MULTI_HOUSE", "多姓王统", ["houseCount", "epochCount"], "实际王统epoch包含多个姓氏");
  add(e.usurpationCount > 0, "USURPATION", "发生篡朝", ["usurpationCount"], "实际epoch有USURPATION起因");
  add(e.restorationCount >= 2, "RESTORATIONS", "多次复国", ["restorationCount"], "至少两次实际复国记录");
  add(e.wasExiled && e.exileMonths >= 120, "LONG_EXILE", "长期流亡", ["wasExiled", "exileMonths"], "累计非在国月份至少10年且存在流亡记录");
  add(e.terminal && (e.ending === "MERGED" || e.ending === "SUBMITTED") && e.lifetime.peakTerritoryBlocks.value >= 3 && e.lifetime.terminal!.territoryBlocks <= e.lifetime.peakTerritoryBlocks.value * 0.25,
    "RETREAT", "极盛后显著退潮", ["lifetime.peakTerritoryBlocks", "lifetime.terminal.territoryBlocks"], "终结前疆域不超过月度实测峰值四分之一");
  add(e.lifetime.terminal?.cityCount === 1, "ONE_CITY_END", "终局一城", ["lifetime.terminal.cityCount"], "终结前实测仅有一城");
  add(e.ending === "MERGED", "MERGED", "同源合邦", ["ending"], "canonical终结原因MERGED");
  add(e.ending === "SUBMITTED", "SUBMITTED", "和平纳土", ["ending"], "canonical终结原因SUBMITTED");
  add(e.remnantsDissipated, "REMNANTS", "残部消散后绝统", ["terminalEventId", "remnantsDissipated"], "原始终结事件明确记录残部消散");
  return profiles;
}
export function composeFactionHistorianVoice(e: FactionHistoricalEvidence, events: readonly import("./FactionHistoricalNarrative").FactionNarrativeEvidence[] = []) {
  return e.terminal ? buildFactionHistoricalNarrative(e, events).voice : undefined;
}
export function deriveFactionAssessment(context: FactionHistoryContext) {
  const e = deriveFactionHistoricalEvidence(context);
  if (!e.terminal) return undefined;
  const p = e.lifetime;
  const ending = e.ending === "SUBMITTED" ? `和平纳土，归附于${e.targetName ?? "未记录的接受国"}`
    : e.ending === "MERGED" ? `同源合邦，并入${e.targetName ?? "未记录的吸收国"}` : e.remnantsDissipated ? "残部消散，王统断绝，政权彻底终结" : "政权彻底终结";
  const facts = [`${e.formal ? "国家结局" : "势力结局"}：${ending} · ${formatWorldDate(e.endMonth!)}`,
    `${e.formal ? "势力存续" : "势力历时"}：${formatWorldDuration(e.lifetimeMonths)}（${formatWorldDate(e.foundedMonth)}～${formatWorldDate(e.endMonth!)}）`,
    ...(e.formal ? [`正式国祚历时：${formatWorldDuration(e.formalMonths!)}（自${formatWorldDate(e.stateFoundedMonth!)}正式建国）`] : []),
    `累计在国：${formatWorldDuration(e.activeMonths)}（势力阶段起累计，不含流亡）`,
    `${e.formal ? "实际历任统治者" : "历任首领"}：${e.rulerCount}位${e.formal ? ` · 正式国家时期君主：${e.formalRulerCount}位` : ""}`,
    `${e.formal ? "王统" : "家族沿革"}：${e.epochCount}段 · ${e.houseCount}姓 · 篡朝：${e.usurpationCount}次`,
    `称帝记录：${e.wasEmperor ? "有" : "未见"} · 天下霸权记录：${e.wasHegemon ? "有" : "未见"}`,
    `复国：${e.restorationCount}次${e.wasExiled ? ` · 累计流亡：${formatWorldDuration(e.exileMonths)}` : ""}`,
    `最高人口：${p.peakPopulation.value}人（${formatWorldDate(p.peakPopulation.month)}）`,
    `最大疆域：${p.peakTerritoryBlocks.value}格，占世界${(e.peakAbsoluteWorldShare * 100).toFixed(1)}%（${formatWorldDate(p.peakTerritoryBlocks.month)}）`,
    `最多城市：${p.peakCityCount.value}座（${formatWorldDate(p.peakCityCount.month)}）`,
    "峰值口径：月度记录及终结前实测；人口来自users.size，疆域来自受控格数，城市来自cities.length。未记录观测间瞬时极值。"];
  const profiles = classifyFactionHistoricalProfile(e);
  const narrativeEvidence = collectFactionNarrativeEvidence(context);
  const story = buildFactionHistoricalNarrative(e, narrativeEvidence);
  return { title: e.formal ? "国评" : "势力结语", evidence: e, profiles, facts, narrativeEvidence, ...story };
}
