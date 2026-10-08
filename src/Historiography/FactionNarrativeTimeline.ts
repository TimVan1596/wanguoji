import type { FactionHistoricalEvidence } from "./FactionHistoriography";
import type { FactionNarrativeEvidence } from "./FactionHistoricalNarrative";
import type { FactionHistoricalArgument } from "./FactionHistoricalArguments";
import { getCapitalCaptureEvidence, getFinalFactionLoss } from "./FactionHistoricalArguments";
import { formatWorldDate as date } from "../Simulation/WorldTime";

export interface FactionTimelineMilestone {
  month: number; kind: string; eventId?: string; metricKey?: string;
  priority: number; text: string; required?: boolean;
}
const meta = (e: FactionNarrativeEvidence, key: string) => typeof e.metadata[key] === "string" ? e.metadata[key] as string : undefined;
export function factionTerminalWording(e: FactionHistoricalEvidence, events: readonly FactionNarrativeEvidence[]) {
  if (e.ending === "MERGED") return `${e.name}并入${e.targetName ?? "同源政权"}（同源合邦），末代统治者退位，独立建制终止`;
  if (e.ending === "SUBMITTED") return `${e.name}纳土归附${e.targetName ?? "接受国"}，末代统治者退位，独立建制终止`;
  const lineEnded = events.some(x => x.type === "dynasty-line-ended" && x.month === e.endMonth);
  return `${lineEnded || e.remnantsDissipated ? `${e.name}王统断绝，` : ""}${e.remnantsDissipated ? "残部消散，" : ""}政权彻底终结`;
}
export function buildFactionTimeline(e: FactionHistoricalEvidence, events: readonly FactionNarrativeEvidence[], arguments_: readonly FactionHistoricalArgument[]): FactionTimelineMilestone[] {
  const candidates: FactionTimelineMilestone[] = [];
  const add = (month: number, kind: string, priority: number, text: string, extra: Partial<FactionTimelineMilestone> = {}) => {
    if (month < e.foundedMonth || month > e.endMonth!) return;
    candidates.push({ month, kind, priority, text: `${date(month)}，${text}`, ...extra });
  };
  const founder = events.find(x => x.type === "state-founded" && x.factionRole === "ACTOR" && x.month === e.stateFoundedMonth);
  add(e.foundedMonth, "ORIGIN", 100, `${e.foundedName}势力建立${e.formal && e.stateFoundedMonth === e.foundedMonth ? `，${e.stateFoundedName}正式建国${founder?.rulerName ? `，${founder.rulerName}在位` : ""}` : ""}`, { metricKey: "foundedMonth", required: true });
  if (e.formal && e.stateFoundedMonth !== e.foundedMonth) add(e.stateFoundedMonth!, "STATE_FOUNDING", 100,
    `${e.stateFoundedName}正式建国${founder?.rulerName ? `，${founder.rulerName}在位` : ""}`, { eventId: founder?.eventId, metricKey: "stateFoundedMonth", required: true });
  if (e.lifetime.peakTerritoryBlocks.value > 0) add(e.lifetime.peakTerritoryBlocks.month, "PEAK_TERRITORY", 82,
    `疆域达到${e.lifetime.peakTerritoryBlocks.source === "MONTHLY" ? "月度记录" : "终结前观测"}峰值${e.lifetime.peakTerritoryBlocks.value}格，占世界${(e.peakAbsoluteWorldShare * 100).toFixed(1)}%`, { metricKey: "lifetime.peakTerritoryBlocks" });
  if (e.lifetime.peakCityCount.value > 1) add(e.lifetime.peakCityCount.month, "PEAK_CITIES", 70, `城市最多${e.lifetime.peakCityCount.value}座`, { metricKey: "lifetime.peakCityCount" });
  if (!e.lifetime.peakTerritoryBlocks.value && e.lifetime.peakPopulation.value > 0) add(e.lifetime.peakPopulation.month, "PEAK_POPULATION", 60, `人口达到记录峰值${e.lifetime.peakPopulation.value}人`, { metricKey: "lifetime.peakPopulation" });
  const finalLoss = e.ending === "EXTINCT" ? getFinalFactionLoss(events) : undefined;
  const captures = getCapitalCaptureEvidence(events);
  for (const x of captures) {
    const matchesLoss = finalLoss && x.month === finalLoss.loss.month &&
      ((x.historyGroupId && x.historyGroupId === finalLoss.loss.historyGroupId) || (x.cityId && x.cityId === finalLoss.loss.cityId));
    if (matchesLoss || !x.cityName) continue;
    if (["ACTOR", "CONQUEROR"].includes(x.factionRole)) add(x.month, "CAPITAL_CONQUEST", 87,
      `${x.rulerName ? `${x.rulerName}亲征，` : ""}${x.factionName}攻陷${x.targetName ?? "敌国"}都${x.cityName}`, { eventId: x.eventId });
    else if (x.factionRole === "TARGET") add(x.month, "CAPITAL_LOSS", 90,
      `${x.rulerName ? `${x.rulerName}亲征，` : ""}${x.actorName ? `${x.actorName}攻陷${x.factionName}都${x.cityName}` : `${x.factionName}都${x.cityName}失陷`}`, { eventId: x.eventId });
  }
  const dedup = new Set<string>();
  const restorationKey = (x: FactionNarrativeEvidence) => `${x.month}:${x.historyGroupId ?? x.cityId ?? x.cityName ?? "restoration"}`;
  const restorations = new Map(events.filter(x => x.type === "faction-restored" && x.factionRole === "ACTOR").map(x => [restorationKey(x), x]));
  for (const x of events) {
    if (x.factionRole !== "ACTOR" && !(x.type === "empire-split" && x.factionRole === "TARGET")) continue;
    const extra = { eventId: x.eventId };
    if (x.type === "emperor-proclaimed") add(x.month, "EMPEROR", 97, `${x.rulerName ?? `${x.factionName}在位君主`}称帝`, extra);
    if (x.type === "world-unification") add(x.month, "UNIFICATION", 105, `${x.factionName}统一天下`, extra);
    if (x.type === "world-hegemony") add(x.month, "HEGEMONY", 98, `${x.factionName}确立天下霸权`, extra);
    if (x.type === "dynasty-usurped") add(x.month, "USURPATION", 100, meta(x, "oldHouseName") && meta(x, "newHouseName")
      ? `${x.factionName}王统由${meta(x, "oldHouseName")}转入${meta(x, "newHouseName")}，发生篡朝` : `${x.factionName}发生篡朝`, extra);
    if (x.type === "empire-split" && x.factionRole === "TARGET") add(x.month, "SPLIT", 94, `${x.factionName}发生分裂${x.actorName ? `，${x.actorName}势力建立` : ""}`, extra);
    if (x.type === "capital-relocated") {
      const old = meta(x, "previousCapitalName"), next = meta(x, "newCapitalName") ?? x.cityName;
      const country = old === x.factionName || next === x.factionName ? `${x.factionName}国` : x.factionName;
      add(x.month, "RELOCATION", 74, `${country}${old ? `由${old === x.factionName ? `${old}城` : old}` : ""}迁都${next ?? ""}`, extra);
    }
    if (["faction-restored", "dynasty-restored"].includes(x.type)) {
      const key = restorationKey(x);
      if (dedup.has(key)) continue;
      dedup.add(key);
      const restored = restorations.get(key);
      const source = restored ?? x;
      add(x.month, "RESTORATION", restored ? 101 : 91, `${x.factionName}${x.cityName ? `在${x.cityName}` : ""}${restored || x.type === "faction-restored" ? "复国" : "王室还都"}`, { eventId: source.eventId });
    }
  }
  if (finalLoss) {
    const { loss, capture } = finalLoss, city = loss.cityName ?? capture?.cityName;
    const attacker = capture?.actorName ?? loss.actorName;
    add(loss.month, "FINAL_LOSS", 110, `${capture?.rulerName ? `${capture.rulerName}亲征，` : ""}${attacker ? `${attacker}攻陷${city ?? "最后据点"}，` : city ? `${city}失陷，` : ""}${loss.factionName}失去最后据点，王室流亡`, { eventId: loss.eventId, required: true });
  }
  const terminalEvent = events.find(x => x.month === e.endMonth &&
    (x.type === "faction-extinct" && x.factionRole === "TARGET" || x.type === "faction-merged" && x.factionRole === "ABSORBED" || x.type === "faction-submitted" && x.factionRole === "SUBMITTED"));
  add(e.endMonth!, "TERMINAL", 120, factionTerminalWording(e, events), { eventId: terminalEvent?.eventId, metricKey: "endMonth", required: true });
  const supporting = new Set(arguments_.flatMap(x => x.supportingEventIds));
  const compare = (a: FactionTimelineMilestone, b: FactionTimelineMilestone) => a.month - b.month ||
    (a.kind === b.kind ? 0 : a.kind === "ORIGIN" ? -1 : b.kind === "ORIGIN" ? 1 : a.kind === "TERMINAL" ? 1 : b.kind === "TERMINAL" ? -1 : 0) ||
    a.kind.localeCompare(b.kind) || (a.eventId ?? a.metricKey ?? "").localeCompare(b.eventId ?? b.metricKey ?? "");
  const selected = candidates.filter(x => x.required);
  const remaining = candidates.filter(x => !x.required);
  // Importance, argument relevance and coverage of different life phases jointly
  // select a bounded sample. Chronology is applied only after material selection.
  const phase = (x: FactionTimelineMilestone) => Math.min(3, Math.floor(4 * (x.month - e.foundedMonth) / Math.max(1, e.lifetimeMonths)));
  while (selected.length < 7 && remaining.length) {
    const score = (x: FactionTimelineMilestone) => x.priority + (x.eventId && supporting.has(x.eventId) ? 18 : 0) +
      (selected.some(y => !y.required && phase(y) === phase(x)) ? 0 : 9);
    remaining.sort((a, b) => score(b) - score(a) || compare(a, b));
    selected.push(remaining.shift()!);
  }
  return selected.sort(compare);
}
