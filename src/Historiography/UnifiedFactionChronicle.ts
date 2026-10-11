import { collectFactionNarrativeEvidence, type FactionNarrativeEvidence } from "./FactionHistoricalNarrative";
import { deriveFactionHistoricalEvidence, type FactionHistoryContext } from "./FactionHistoriography";
import type { HouseAssessment } from "./DynastyHouseHistoriography";
import { getCapitalCaptureEvidence } from "./FactionHistoricalArguments";
import { hasRecordedRulerDeath } from "../Politics/RulerLifeState";
import { formatWorldDate as date, formatWorldDuration as duration } from "../Simulation/WorldTime";

export interface UnifiedChronicleContext extends FactionHistoryContext { phases: readonly HouseAssessment[]; worldMonth: number }
interface Passage { key: string; month: number; order: number; priority: number; text: string; required?: boolean }
export interface UnifiedChronicle { title: string; range: string; paragraphs: string[]; eventIds: string[]; phaseCount: number; length: number }
const meta = (e: FactionNarrativeEvidence, key: string) => typeof e.metadata[key] === "string" ? e.metadata[key] as string : undefined;
const person = (r: NonNullable<FactionHistoryContext["dynasty"]>["rulers"][number]) => `${r.houseName.replace(/氏$/, "")}${r.givenName}`;
/** Re-select facts; never concatenate the old assessment/judgment/voice strings. */
export function buildUnifiedFactionChronicle(c: UnifiedChronicleContext): UnifiedChronicle {
  const fact = deriveFactionHistoricalEvidence(c);
  const end = Math.min(c.worldMonth, fact.endMonth ?? c.worldMonth);
  const events = collectFactionNarrativeEvidence(c).filter(e => e.month >= fact.foundedMonth && e.month <= end);
  const phases = c.phases.filter(p => p.startMonth <= end);
  const candidates: Passage[] = [];
  const add = (key: string, month: number, priority: number, text: string, required = false, order = 2) => {
    if (month >= fact.foundedMonth && month <= end && text) candidates.push({ key, month, priority, text, required, order });
  };
  const first = phases[0];
  add("origin", fact.foundedMonth, 100, `${fact.foundedName}建立${first?.startMonth === fact.foundedMonth && first.founderName ? `，${first.founderName}开创${first.houseName}王统` : ""}`, true, 0);
  const state = events.find(e => e.type === "state-founded" && e.factionRole === "ACTOR" && e.month === fact.stateFoundedMonth);
  if (fact.formal) {
    const holders = c.dynasty?.rulers.filter(r => phases.some(p => p.rulerIds.includes(r.id)) && r.accessionYear !== undefined && r.accessionYear <= fact.stateFoundedMonth! && (r.endYear ?? end) >= fact.stateFoundedMonth!) ?? [];
    const who = state?.rulerName ?? (holders.length === 1 ? person(holders[0]) : undefined);
    add(state?.eventId ?? "state", fact.stateFoundedMonth!, 100, `${who ? `${who}在位时，` : ""}${fact.stateFoundedName}正式建国`, true, 1);
  }
  // Epoch facts include natural changes that need not have a retained world event.
  const selectedPhases = phases.length <= 8 ? phases : [...new Set([phases[0], ...phases.filter(p => p.usurpationProven).slice(-2), ...phases.filter(p => p.startReason === "RESTORATION").slice(-2), ...phases.slice(-3)])];
  for (const p of selectedPhases) {
    if (p === first && p.startMonth === fact.foundedMonth) continue;
    const previous = phases[phases.indexOf(p) - 1];
    const old = previous ? `${previous.houseName}之后，` : "";
    const opening = p.usurpationProven ? `${p.founderName ?? p.houseName}篡朝，王统转入${p.houseName}` :
      p.startReason === "NATURAL_HOUSE_SUCCESSION" ? `${old}${p.founderName ?? p.houseName}自然易姓续统` :
      p.startReason === "RESTORATION" ? `${p.houseName}开启复国后的政治阶段` : `${p.founderName ?? p.houseName}开启${p.houseName}王统`;
    const usurp = events.find(e => e.type === "dynasty-usurped" && e.rulerId === p.founderId && e.month === p.startMonth);
    add(usurp?.eventId ?? `epoch:${p.key}`, p.startMonth, 110, opening + (p.rulerCount > 1 ? `，此段历${p.rulerCount}位统治者` : ""), true);
  }
  const peak = c.lifetime.peakTerritoryBlocks;
  if (peak.value > 0 && c.totalWorldBlocks > 0) add("peak", peak.month, 80,
    `疆域达到${peak.source === "MONTHLY" ? "月度记录" : "终结前观测"}峰值${peak.value}格，占世界${(fact.peakAbsoluteWorldShare * 100).toFixed(1)}%`);
  const captures = getCapitalCaptureEvidence(events);
  const exiles = events.filter(e => e.type === "faction-exiled" && e.factionRole === "TARGET");
  const groups = new Set<string>();
  const validActor = (e: FactionNarrativeEvidence) => ["ACTOR", "CONQUEROR"].includes(e.factionRole);
  for (const e of events) {
    if (e.type === "dynasty-usurped" || e.type === "state-founded") continue;
    if (e.type === "faction-exiled" && e.factionRole === "TARGET") {
      const group = `exile:${e.month}:${e.historyGroupId ?? e.eventId}`;
      if (groups.has(group)) continue; groups.add(group);
      const capture = captures.find(x => x.month === e.month && x.factionRole === "TARGET" &&
        (x.historyGroupId && x.historyGroupId === e.historyGroupId || x.cityId && x.cityId === e.cityId));
      add(e.eventId, e.month, 108, `${capture?.rulerName ? `${capture.rulerName}亲征，` : ""}${capture?.actorName ?? e.actorName ?? ""}${capture?.actorName || e.actorName ? "攻陷" : ""}${e.cityName ?? capture?.cityName ?? "最后据点"}，${e.factionName}失去最后据点，王室转入流亡`, false, 3);
      continue;
    }
    if (e.type === "empire-split" && e.factionRole === "TARGET") add(e.eventId, e.month, 95, `${e.factionName}发生分裂${e.actorName ? `，${e.actorName}另立政权` : ""}`);
    if (!validActor(e)) continue;
    if (e.type === "emperor-proclaimed") add(e.eventId, e.month, 104, `${e.rulerName ?? e.factionName}称帝`);
    if (e.type === "world-unification") add(e.eventId, e.month, 109, `${e.factionName}完成天下统一`);
    if (e.type === "world-hegemony") add(e.eventId, e.month, 100, `${e.factionName}确立天下霸权`);
    if (e.type === "faction-restored") {
      const group = `restore:${e.month}:${e.historyGroupId ?? e.eventId}`;
      if (!groups.has(group)) { add(e.eventId, e.month, 107, `${e.factionName}${e.cityName ? `于${e.cityName}` : ""}复国`); groups.add(group); }
    }
    if (e.type === "capital-relocated" && (meta(e, "newCapitalName") || e.cityName)) add(e.eventId, e.month, 65, `${e.factionName}${meta(e, "previousCapitalName") ? `由${meta(e, "previousCapitalName")}城` : ""}迁都${meta(e, "newCapitalName") ?? e.cityName ?? "新都"}`);
    if (e.type === "empire-split" && e.factionRole === "ACTOR") add(e.eventId, e.month, 70, `${e.factionName}建立于分裂之际`);
  }
  for (const e of captures) {
    if (!e.cityName || exiles.some(x => x.month === e.month && (x.historyGroupId && x.historyGroupId === e.historyGroupId || x.cityId && x.cityId === e.cityId))) continue;
    if (validActor(e)) add(e.eventId, e.month, 82, `${e.factionName}攻取${e.targetName ?? "敌国"}都${e.cityName}${e.rulerName ? `，此役由${e.rulerName}亲征` : ""}`);
    else if (e.factionRole === "TARGET") add(e.eventId, e.month, 79, `${e.actorName ? `${e.actorName}攻陷` : ""}${e.factionName}都${e.cityName}${e.actorName ? "" : "失守"}`);
  }
  const last = phases.at(-1);
  const ruler = last?.terminalRulerName ? c.dynasty?.rulers.find(r => last.rulerIds.includes(r.id) && person(r) === last.terminalRulerName && r.endYear === end) : undefined;
  if (fact.terminal) {
    const ending = fact.ending === "MERGED" ? `${fact.name}并入${fact.targetName ?? "同源政权"}（同源合邦），独立建制终止` :
      fact.ending === "SUBMITTED" ? `${fact.name}纳土归附${fact.targetName ?? "接受国"}，独立建制终止` : `${fact.name}政权彻底终结`;
    add(fact.terminalEventId ?? "terminal", end, 120, `${ruler && hasRecordedRulerDeath(ruler) && ruler.deathMonth === end ? `${person(ruler)}实际去世，同月` : ""}${ending}`, true, 4);
  }
  // Mandatory political stages plus a bounded, period-diverse representative sample.
  const selected = candidates.filter(x => x.required);
  const remaining = candidates.filter(x => !x.required);
  const phase = (x: Passage) => Math.min(3, Math.floor(4 * (x.month - fact.foundedMonth) / Math.max(1, end - fact.foundedMonth)));
  const target = Math.max(9, selected.length);
  while (selected.length < target && remaining.length) {
    const score = (x: Passage) => x.priority + (selected.some(y => !y.required && phase(y) === phase(x)) ? 0 : 12) - (selected.some(y => y.key === x.key) ? 1000 : 0);
    remaining.sort((a, b) => score(b) - score(a) || a.month - b.month || a.key.localeCompare(b.key));
    const next = remaining.shift()!;
    if (!selected.some(x => x.key === next.key)) selected.push(next);
  }
  selected.sort((a, b) => a.month - b.month || a.order - b.order || a.key.localeCompare(b.key));
  const sentences = selected.map((x, i) => {
    const time = i && x.month === selected[i - 1].month ? "同月" : !i ? date(x.month) :
      x.key === "peak" ? `至${date(x.month)}` : x.order === 4 ? `到${date(x.month)}` :
      x.key.startsWith("epoch:") ? `其后在${date(x.month)}` : date(x.month);
    return `${time}，${x.text}。`;
  });
  const lastExile = exiles.at(-1);
  if (lastExile && !events.some(e => e.type === "faction-restored" && e.month > lastExile.month && validActor(e))) {
    const known = new Set(phases.flatMap(p => p.rulerIds));
    const successors = (c.dynasty?.rulers ?? []).filter(r => known.has(r.id) && r.accessionYear !== undefined && r.accessionYear > lastExile.month && r.accessionYear <= end)
      .sort((a, b) => a.accessionYear! - b.accessionYear! || a.id.localeCompare(b.id));
    if (successors.length) {
      const names = successors.slice(-2).map(person).join("、");
      // Insert before the dated terminal sentence, rather than after the end.
      const terminalIndex = selected.findIndex(x => x.order === 4);
      sentences.splice(terminalIndex < 0 ? sentences.length : terminalIndex, 0, `失国以后，${names}${successors.length > 1 ? "先后" : ""}承接流亡王统。`);
    }
  }
  const actualHolders = new Set(phases.flatMap(p => p.rulerIds)).size;
  const transmission = phases.length > 1 ? `其间历${actualHolders}位统治者、${phases.length}段政治王统` : `此统先后历${actualHolders}位统治者`;
  const live = c.faction.status === "EXILED" ? `截至${date(end)}，${last?.houseName ?? "王统"}仍在流亡中延续${last?.currentRulerName ? `，由${last.currentRulerName}承统` : ""}。` :
    `截至${date(end)}，${last?.houseName ?? "王统"}仍在延续${last?.currentRulerName ? `，当前由${last.currentRulerName}承统` : ""}。`;
  const narrativeSentenceCount = sentences.length;
  sentences.push(`${transmission}${fact.terminal ? "。" : `；${live}`}`);
  const finalExile = exiles.at(-1);
  const restored = events.some(e => e.type === "faction-restored" && validActor(e));
  const judgment = !fact.terminal ? "" : fact.ending === "MERGED" ? "独立王统终于同源合邦，国家旧史并未因此消失。" :
    fact.ending === "SUBMITTED" ? "独立统治以和平纳土收束，旧王室在退位归附中结束政治传承。" :
    finalExile && !events.some(e => e.type === "faction-restored" && e.month > finalExile.month && validActor(e)) ?
      `城土虽失，王统${end > finalExile.month ? `仍在流亡中延续${duration(end - finalExile.month)}` : "亦于同月终结"}；这一国的失土与传承，各有其起落。` :
    restored ? "国统曾在失国后复续，恢复独立建制成为这段历史的重要转折。" :
    phases.some(p => p.usurpationProven) ? "王统曾被篡夺，国家经历与一家传承并非同一条线。" : "统治者先后承接的是一国建制，其终局不宜尽归于末代一人。";
  if (judgment) sentences.push(judgment);
  // Exceptionally many/long names remain bounded, without cutting a factual
  // sentence halfway. All phase counts survive even when individual episodes omit.
  const bounded: string[] = [];
  const conclusion = sentences.slice(narrativeSentenceCount).join("");
  let used = conclusion.length;
  for (const sentence of sentences.slice(0, narrativeSentenceCount)) {
    if (used + sentence.length <= 1600) { bounded.push(sentence); used += sentence.length; }
  }
  const text = bounded.join("") + (conclusion.length <= 1600 ? conclusion : "政治阶段众多，详见历代君主档案。");
  return { title: `《${fact.name}${fact.formal && !fact.name.endsWith("国") ? "国" : ""}史》`, range: `${date(fact.foundedMonth)}～${fact.terminal ? date(end) : "今"}`,
    paragraphs: [text], eventIds: selected.map(x => x.key).filter(id => events.some(e => e.eventId === id)), phaseCount: phases.length, length: text.length };
}
