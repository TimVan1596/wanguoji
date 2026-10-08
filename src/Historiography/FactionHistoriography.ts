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
  factionId: string; name: string; formal: boolean; terminal: boolean;
  foundedMonth: number; stateFoundedMonth?: number; endMonth?: number;
  lifetimeMonths: number; formalMonths?: number; activeMonths: number; exileMonths: number;
  rulerCount: number; formalRulerCount: number; epochCount: number; houseCount: number;
  usurpationCount: number; restorationCount: number; wasExiled: boolean; wasEmperor: boolean; wasHegemon: boolean;
  ending?: "EXTINCT" | "MERGED" | "SUBMITTED"; targetName?: string;
  remnantsDissipated: boolean; terminalEventId?: string;
  lifetime: FactionLifetimeRecord; totalWorldBlocks: number; peakAbsoluteWorldShare: number;
}
export interface FactionHistoryContext {
  faction: HistoricalFaction; dynasty?: Pick<Dynasty, "rulers" | "houseEpochs">;
  lifetime: FactionLifetimeRecord; totalWorldBlocks: number;
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
    endMonth, lifetimeMonths: Math.max(0, end - foundedMonth), formalMonths: formal ? Math.max(0, end - f.stateFoundedMonth!) : undefined,
    activeMonths, exileMonths: Math.max(0, end - foundedMonth - activeMonths), rulerCount: rulers.length, formalRulerCount: formalRulers.length,
    epochCount: epochs.length, houseCount: new Set(epochs.map(e => e.houseName)).size,
    usurpationCount: epochs.filter(e => e.startReason === "USURPATION").length, restorationCount: f.restorationYears.length,
    wasExiled: f.lastExiledYear !== undefined || f.restorationYears.length > 0,
    wasEmperor: f.proclaimedEmperorMonth !== undefined || f.sovereigntyHistory.some(e => e.rank === "EMPEROR" && e.startMonth <= end),
    wasHegemon: events.some(e => e.type === "world-hegemony" && e.actorFactionId === f.name && (e.monthIndex ?? e.year) <= end),
    ending, targetName: target ? getFactionDisplayNameAtMonth(target, end) : f.terminationTargetFactionId,
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
  add(e.terminal && e.lifetime.peakTerritoryBlocks.value >= 3 && e.lifetime.terminal!.territoryBlocks <= e.lifetime.peakTerritoryBlocks.value * 0.25,
    "RETREAT", "极盛后显著退潮", ["lifetime.peakTerritoryBlocks", "lifetime.terminal.territoryBlocks"], "终结前疆域不超过月度实测峰值四分之一");
  add(e.lifetime.terminal?.cityCount === 1, "ONE_CITY_END", "终局一城", ["lifetime.terminal.cityCount"], "终结前实测仅有一城");
  add(e.ending === "MERGED", "MERGED", "同源归并", ["ending"], "canonical终结原因MERGED");
  add(e.ending === "SUBMITTED", "SUBMITTED", "和平纳土", ["ending"], "canonical终结原因SUBMITTED");
  add(e.remnantsDissipated, "REMNANTS", "残部消散后绝统", ["terminalEventId", "remnantsDissipated"], "原始终结事件明确记录残部消散");
  return profiles;
}
function choose(e: FactionHistoricalEvidence, key: string, variants: string[]) {
  let hash = 2166136261;
  for (const char of `${e.factionId}:${key}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return variants[(hash >>> 0) % variants.length];
}
export function composeFactionHistorianVoice(e: FactionHistoricalEvidence) {
  if (!e.terminal) return undefined;
  const has = (key: string) => classifyFactionHistoricalProfile(e).some(p => p.key === key);
  // Distinct factual axes determine emphasis, not a random evaluation or a claim about motives.
  const history = has("RESTORATIONS") ? choose(e, "restore", ["城池数失，国统数续，复国之迹使其历史不止一次兴亡。", "失地之后仍曾再立，数度复国是此国最鲜明的曲折。"])
    : has("MULTI_HOUSE") ? choose(e, "houses", ["一国历经数姓王统，国之沿革与一家兴替不可混为一谈。", "王统数更而势力历史相续，易姓并未另造一个国家。"])
    : has("LONG") && e.wasEmperor ? choose(e, "long-empire", ["立国既久，亦曾称帝，帝制与长久存续共同构成其历史分量。", "久历岁月而曾建帝制，其历史不能仅以最后一朝的结局概括。"])
    : has("LONG_EXILE") ? choose(e, "exile", ["离土之岁亦属其史，流亡与在国须分别记述。", "国土失去之后，政权曾续于流亡，终结不能倒写为失城之日。"])
    : has("SHORT") && !e.formal ? choose(e, "short", ["兴起未久而独立建制已终，未正式建国是其历史边界。", "势力短暂兴起，未及正式建国便告终结，记其所见，不补其未有。"])
    : e.lifetimeMonths >= 600 && e.lifetime.peakCityCount.value === 1 ? "势力延续至少五十年，月度记录最多仅一城；其历史分量在延续，不在城邑扩张。"
    : e.wasHegemon ? "曾经确立天下霸权，足见其影响不止于一隅；终局仍须与盛时分别记述。"
    : has("RETREAT") ? choose(e, "retreat", ["实测疆域峰值与终结前相去甚远，盛衰之差见于版图，不必另托虚构的兴亡缘由。", "疆域曾盛而后退潮，所得与所失均有记录，其史当兼记两端。"])
    : has("LONG") ? "势力绵延百年以上，其历史分量在长期延续，非终局一事所能尽括。"
    : e.lifetime.peakCityCount.value >= 3 ? `月度记录中城市最多${e.lifetime.peakCityCount.value}座，人口最高${e.lifetime.peakPopulation.value}人，城邑与人口各有可考之峰。`
    : "其史以实际建制与疆域记录为据，不以未记载的功过补成兴亡故事。";
  const ending = e.ending === "SUBMITTED" ? choose(e, "submitted", ["终其独立建制，以和平纳土收束，并非君主战死或王室被杀。", "末以纳土终止独立建制，退位与死亡有别，旧王室仍可稽考。"])
    : e.ending === "MERGED" ? choose(e, "merged", ["终归同源合邦，其终结在政治归并，不在战败覆灭。", "同源政权终而合邦，独立建制的终点不应误作一场征服。"])
    : e.remnantsDissipated ? "终结事件明载残部消散，失城与绝统之间仍有一段历史。"
    : "独立政权最终彻底终结；没有明确终结归责的记录，不据此归功于最后攻城者。";
  return `${history}${ending}`;
}
export function deriveFactionAssessment(context: FactionHistoryContext) {
  const e = deriveFactionHistoricalEvidence(context);
  if (!e.terminal) return undefined;
  const p = e.lifetime;
  const ending = e.ending === "SUBMITTED" ? `和平纳土，归附于${e.targetName ?? "未记录的接受国"}`
    : e.ending === "MERGED" ? `同源合邦，并入${e.targetName ?? "未记录的吸收国"}` : e.remnantsDissipated ? "残部消散，王统断绝，政权彻底终结" : "政权彻底终结";
  const facts = [`国家结局：${ending} · ${formatWorldDate(e.endMonth!)}`,
    `${e.formal ? "势力存续" : "势力历时"}：${formatWorldDuration(e.lifetimeMonths)}（${formatWorldDate(e.foundedMonth)}～${formatWorldDate(e.endMonth!)}）`,
    ...(e.formal ? [`正式国祚历时：${formatWorldDuration(e.formalMonths!)}（自${formatWorldDate(e.stateFoundedMonth!)}正式建国）`] : []),
    `累计在国：${formatWorldDuration(e.activeMonths)}（势力阶段起累计，不含流亡）`,
    `${e.formal ? "实际历任统治者" : "历任首领"}：${e.rulerCount}位${e.formal ? ` · 正式国家时期君主：${e.formalRulerCount}位` : ""}`,
    `王统：${e.epochCount}段 · ${e.houseCount}姓 · 篡朝：${e.usurpationCount}次`,
    `称帝记录：${e.wasEmperor ? "有" : "未见"} · 天下霸权记录：${e.wasHegemon ? "有" : "未见"}`,
    `复国：${e.restorationCount}次${e.wasExiled ? ` · 累计流亡：${formatWorldDuration(e.exileMonths)}` : ""}`,
    `最高人口：${p.peakPopulation.value}人（${formatWorldDate(p.peakPopulation.month)}）`,
    `最大疆域：${p.peakTerritoryBlocks.value}格，占世界${(e.peakAbsoluteWorldShare * 100).toFixed(1)}%（${formatWorldDate(p.peakTerritoryBlocks.month)}）`,
    `最多城市：${p.peakCityCount.value}座（${formatWorldDate(p.peakCityCount.month)}）`,
    "峰值口径：月度记录及终结前实测；人口来自users.size，疆域来自受控格数，城市来自cities.length。未记录观测间瞬时极值。"];
  const profiles = classifyFactionHistoricalProfile(e);
  const core = e.restorationCount >= 2 ? `实际复国${e.restorationCount}次，流亡与重建构成其历史的重要转折。`
    : e.houseCount > 1 ? `同一势力经历${e.epochCount}段、${e.houseCount}姓王统${e.usurpationCount ? `，其中${e.usurpationCount}次篡朝` : ""}，不能以一家兴亡概括其国史。`
    : e.wasEmperor ? "存在称帝记录，帝制是其国家历史中的明确阶段。"
    : e.wasHegemon ? "曾确立天下霸权，对世界格局有明确影响。"
    : e.lifetimeMonths >= 1200 ? "势力存续超过百年，长期延续构成其历史的主要特征。"
    : !e.formal ? "终结时尚未正式建国，其历史应记为势力兴替。" : "正式建国与独立统治构成其可核实的国家经历。";
  const retreat = profiles.some(p => p.key === "RETREAT") ? "终结前疆域已不超过记录峰值四分之一，版图有明显退潮。" : undefined;
  return { title: e.formal ? "国评" : "势力结语", evidence: e, profiles, facts,
    lines: [core, retreat, `最终政治结局为${ending}。`].filter((line): line is string => Boolean(line)),
    voice: composeFactionHistorianVoice(e)!,
    summary: `${e.formal ? "势力存续" : "势力历时"}${formatWorldDuration(e.lifetimeMonths)}${e.formal ? ` · 正式国祚${formatWorldDuration(e.formalMonths!)} · 历${e.formalRulerCount}君` : ` · 历${e.rulerCount}位首领`} · ${e.epochCount}段王统 · ${ending}。${core}` };
}
