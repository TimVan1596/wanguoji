import { collectFactionNarrativeEvidence, type FactionNarrativeEvidence } from "./FactionHistoricalNarrative";
import { deriveFactionHistoricalEvidence, type FactionHistoryContext } from "./FactionHistoriography";
import type { HouseAssessment } from "./DynastyHouseHistoriography";
import { getCapitalCaptureEvidence } from "./FactionHistoricalArguments";
import { hasRecordedRulerDeath } from "../Politics/RulerLifeState";
import { formatWorldDate as date } from "../Simulation/WorldTime";

import { composeChronicleParagraphs, createChroniclePeople, type ChroniclePassage, type ChronicleKind } from "./ChronicleComposition";
import { deriveChronicleArguments, type ChronicleArgument } from "./ChronicleJudgment";
export interface UnifiedChronicleContext extends FactionHistoryContext { phases: readonly HouseAssessment[]; worldMonth: number }
export interface UnifiedChronicle { title: string; range: string; paragraphs: string[]; eventIds: string[]; phaseCount: number; length: number; argument?: ChronicleArgument }
const meta = (e: FactionNarrativeEvidence, key: string) => typeof e.metadata[key] === "string" ? e.metadata[key] as string : undefined;
const person = (r: NonNullable<FactionHistoryContext["dynasty"]>["rulers"][number]) => `${r.houseName.replace(/氏$/, "")}${r.givenName}`;
/** Re-select facts; never concatenate the old assessment/judgment/voice strings. */
export function buildUnifiedFactionChronicle(c: UnifiedChronicleContext): UnifiedChronicle {
  const fact = deriveFactionHistoricalEvidence(c);
  const end = Math.min(c.worldMonth, fact.endMonth ?? c.worldMonth);
  const events = collectFactionNarrativeEvidence(c).filter(e => e.month >= fact.foundedMonth && e.month <= end);
  const phases = c.phases.filter(p => p.startMonth <= end);
  const candidates: ChroniclePassage[] = [];
  const people = createChroniclePeople(c.factions, end);
  const own = new Map(c.dynasty?.rulers.map(r => [r.id, r]) ?? []);
  const reference = (id: string | undefined, month: number, fallback: string | undefined, factionId = fact.factionId) => {
    const r = id ? factionId === fact.factionId ? own.get(id) : c.resolveRuler?.(id, factionId) : undefined;
    return r && r.id === id && r.accessionYear !== undefined && r.accessionYear <= month && (r.endYear ?? end) >= month
      ? people.ref(r, factionId, month) : fallback;
  };
  const eventPerson = (e: FactionNarrativeEvidence) => e.rulerName ? reference(e.rulerId, e.month, e.rulerName,
    ["capital-fallen", "city-captured"].includes(e.type) ? e.actorFactionId ?? e.conquerorFactionId ?? fact.factionId : fact.factionId) : undefined;
  const add = (key: string, month: number, priority: number, text: string, required = false, order = 2, kind: ChronicleKind = "POLITICS") => {
    if (month >= fact.foundedMonth && month <= end && text) candidates.push({ key, month, priority, text, required, order, kind });
  };
  const first = phases[0];
  const founding = events.find(e => e.month === fact.foundedMonth && e.factionRole === "ACTOR" &&
    ["rebel-faction-founded", "frontier-faction-founded", "empire-split"].includes(e.type));
  const splitOrigin = events.some(e => e.type === "empire-split" && e.factionRole === "ACTOR" && e.month === fact.foundedMonth);
  const originCity = founding?.cityName ?? (founding ? meta(founding, "splitCoreCityName") : undefined);
  add(founding?.eventId ?? "origin", fact.foundedMonth, 100, `${fact.foundedName}${splitOrigin ? "在政权分裂之际" : ""}${originCity ? `于${originCity}` : ""}建立${first?.startMonth === fact.foundedMonth && first.founderName ? `，${reference(first.founderId, first.startMonth, first.founderName)}开创${first.houseName}王统` : ""}`, true, 0, "ORIGIN");
  const state = events.find(e => e.type === "state-founded" && e.factionRole === "ACTOR" && e.month === fact.stateFoundedMonth);
  if (fact.formal) {
    const holders = c.dynasty?.rulers.filter(r => phases.some(p => p.rulerIds.includes(r.id)) && r.accessionYear !== undefined && r.accessionYear <= fact.stateFoundedMonth! && (r.endYear ?? end) >= fact.stateFoundedMonth!) ?? [];
    const who = state ? eventPerson(state) : holders.length === 1 ? reference(holders[0].id, fact.stateFoundedMonth!, person(holders[0])) : undefined;
    add(state?.eventId ?? "state", fact.stateFoundedMonth!, 100, `${who ? `${who}在位时，` : ""}${fact.stateFoundedName}正式建国`, true, 1, "STATE");
  }
  // Epoch facts include natural changes that need not have a retained world event.
  const selectedPhases = phases.length <= 8 ? phases : [...new Set([phases[0], ...phases.filter(p => p.usurpationProven).slice(-2), ...phases.filter(p => p.startReason === "RESTORATION").slice(-2), ...phases.slice(-3)])];
  for (const p of selectedPhases) {
    if (p === first && p.startMonth === fact.foundedMonth) continue;
    const previous = phases[phases.indexOf(p) - 1];
    const old = previous ? `${previous.houseName}之后，` : "";
    const founder = reference(p.founderId, p.startMonth, p.founderName ?? p.houseName);
    const opening = p.usurpationProven ? `${founder}篡朝，王统转入${p.houseName}` :
      p.startReason === "NATURAL_HOUSE_SUCCESSION" ? `${old}${founder}自然易姓续统` :
      p.startReason === "RESTORATION" ? `${p.houseName}开启复国后的政治阶段` : `${founder}开启${p.houseName}王统`;
    const usurp = events.find(e => e.type === "dynasty-usurped" && e.rulerId === p.founderId && e.month === p.startMonth);
    add(usurp?.eventId ?? `epoch:${p.key}`, p.startMonth, 110, opening + (p.rulerCount > 1 ? `，此段历${p.rulerCount}位统治者` : ""), true);
  }
  const peak = c.lifetime.peakTerritoryBlocks;
  if (peak.value > 0 && c.totalWorldBlocks > 0) add("peak", peak.month, 80,
    `疆域达到${peak.source === "MONTHLY" ? "月度记录" : "终结前观测"}峰值${peak.value}格，占世界${(fact.peakAbsoluteWorldShare * 100).toFixed(1)}%`, false, 2, "PEAK");
  const captures = getCapitalCaptureEvidence(events);
  const exiles = events.filter(e => e.type === "faction-exiled" && e.factionRole === "TARGET");
  const capturesByGroup = new Map<string, FactionNarrativeEvidence>(), capturesByCity = new Map<string, FactionNarrativeEvidence>();
  const exileGroups = new Set(exiles.filter(e => e.historyGroupId && !e.cityId).map(e => `${e.month}:${e.historyGroupId}`));
  const exileCities = new Set(exiles.filter(e => e.cityId).map(e => `${e.month}:${e.cityId}`));
  for (const capture of captures) {
    if (capture.factionRole !== "TARGET") continue;
    if (capture.historyGroupId) capturesByGroup.set(`${capture.month}:${capture.historyGroupId}`, capture);
    if (capture.cityId) capturesByCity.set(`${capture.month}:${capture.cityId}`, capture);
  }
  const groups = new Set<string>();
  const sameFact = new Set<string>();
  const validActor = (e: FactionNarrativeEvidence) => ["ACTOR", "CONQUEROR"].includes(e.factionRole);
  for (const e of events) {
    if (e.type === "dynasty-usurped" || e.type === "state-founded") continue;
    const factKey = `${e.month}:${e.type}:${e.factionRole}:${e.historyGroupId ?? e.eventId}`;
    if (sameFact.has(factKey)) continue;
    sameFact.add(factKey);
    if (e.type === "faction-exiled" && e.factionRole === "TARGET") {
      const group = `exile:${e.month}:${e.historyGroupId ?? e.eventId}`;
      if (groups.has(group)) continue; groups.add(group);
      const groupedCapture = e.historyGroupId ? capturesByGroup.get(`${e.month}:${e.historyGroupId}`) : undefined;
      const capture = (e.cityId ? capturesByCity.get(`${e.month}:${e.cityId}`) : undefined) ??
        (groupedCapture && (!e.cityId || !groupedCapture.cityId || e.cityId === groupedCapture.cityId) ? groupedCapture : undefined);
      add(e.eventId, e.month, 108, `${capture?.rulerName ? `${eventPerson(capture)}亲征，` : ""}${capture?.actorName ?? e.actorName ?? ""}${capture?.actorName || e.actorName ? "攻陷" : ""}${e.cityName ?? capture?.cityName ?? "最后据点"}，${e.factionName}失去最后据点，王室转入流亡`, false, 3, "EXILE");
      continue;
    }
    if (e.type === "empire-split" && e.factionRole === "TARGET") add(e.eventId, e.month, 95, `${e.factionName}发生分裂${e.actorName ? `，${e.actorName}另立政权` : ""}`);
    if (!validActor(e)) continue;
    if (e.type === "emperor-proclaimed") add(e.eventId, e.month, 104, `${eventPerson(e) ?? e.factionName}称帝`);
    if (e.type === "world-unification") add(e.eventId, e.month, 109, `${e.factionName}完成天下统一`);
    if (e.type === "world-hegemony") add(e.eventId, e.month, 100, `${e.factionName}确立天下霸权`);
    if (e.type === "faction-restored") {
      const group = `restore:${e.month}:${e.historyGroupId ?? e.eventId}`;
      if (!groups.has(group)) { add(e.eventId, e.month, 107, `${e.factionName}${e.cityName ? `于${e.cityName}` : ""}复国`, false, 2, "RESTORE"); groups.add(group); }
    }
    if (e.type === "capital-relocated" && (meta(e, "newCapitalName") || e.cityName)) add(e.eventId, e.month, 65, `${e.factionName}${meta(e, "previousCapitalName") ? `由${meta(e, "previousCapitalName")}城` : ""}迁都${meta(e, "newCapitalName") ?? e.cityName ?? "新都"}`, false, 2, "MOVE");
    if (e.type === "empire-split" && e.factionRole === "ACTOR" && e.month !== fact.foundedMonth) add(e.eventId, e.month, 70, `${e.factionName}参与政权分裂`);
  }
  for (const e of captures) {
    if (!e.cityName || (e.factionRole === "TARGET" && ((e.historyGroupId && exileGroups.has(`${e.month}:${e.historyGroupId}`)) || (e.cityId && exileCities.has(`${e.month}:${e.cityId}`))))) continue;
    if (validActor(e)) add(e.eventId, e.month, 82, `${e.factionName}攻取${e.targetName ?? "敌国"}都${e.cityName}${e.rulerName ? `，此役由${eventPerson(e)}亲征` : ""}`, false, 2, "CAMPAIGN");
    else if (e.factionRole === "TARGET") add(e.eventId, e.month, 79, `${e.rulerName ? `${eventPerson(e)}亲征，` : ""}${e.actorName ? `${e.actorName}攻陷` : ""}${e.factionName}都${e.cityName}${e.actorName ? "" : "失守"}`, false, 2, "CAMPAIGN");
  }
  const last = phases.at(-1);
  const ruler = last?.terminalRulerName ? c.dynasty?.rulers.find(r => last.rulerIds.includes(r.id) && person(r) === last.terminalRulerName && r.endYear === end) : undefined;
  if (fact.terminal) {
    const ending = fact.ending === "MERGED" ? `${fact.name}并入${fact.targetName ?? "同源政权"}（同源合邦），独立建制终止` :
      fact.ending === "SUBMITTED" ? `${fact.name}纳土归附${fact.targetName ?? "接受国"}，独立建制终止` : `${fact.name}政权彻底终结`;
    add(fact.terminalEventId ?? "terminal", end, 120, `${ruler && hasRecordedRulerDeath(ruler) && ruler.deathMonth === end ? `${reference(ruler.id, end, person(ruler))}${ruler.deathReason === "战死" ? "战死" : ruler.deathReason === "被俘处死" ? "被俘处死" : "实际去世"}，同月` : ""}${ending}`, true, 4, "TERMINAL");
  }
  // Mandatory political stages plus a bounded, period-diverse representative sample.
  const selected = candidates.filter(x => x.required);
  const remaining = candidates.filter(x => !x.required);
  const phase = (x: ChroniclePassage) => Math.min(3, Math.floor(4 * (x.month - fact.foundedMonth) / Math.max(1, end - fact.foundedMonth)));
  const target = Math.max(9, selected.length);
  while (selected.length < target && remaining.length) {
    const score = (x: ChroniclePassage) => x.priority + (selected.some(y => !y.required && phase(y) === phase(x)) ? 0 : 12) + (selected.some(y => y.kind === x.kind) ? 0 : 16) - (selected.some(y => y.key === x.key) ? 1000 : 0);
    remaining.sort((a, b) => score(b) - score(a) || a.month - b.month || a.key.localeCompare(b.key));
    const next = remaining.shift()!;
    if (!selected.some(x => x.key === next.key)) selected.push(next);
  }
  selected.sort((a, b) => a.month - b.month || a.order - b.order || a.key.localeCompare(b.key));
  const lastExile = exiles.at(-1);
  if (lastExile && !events.some(e => e.type === "faction-restored" && e.month > lastExile.month && validActor(e))) {
    const known = new Set(phases.flatMap(p => p.rulerIds));
    const successors = (c.dynasty?.rulers ?? []).filter(r => known.has(r.id) && r.accessionYear !== undefined && r.accessionYear <= end && (r.endYear ?? end) > lastExile.month)
      .sort((a, b) => a.accessionYear! - b.accessionYear! || a.id.localeCompare(b.id));
    if (successors.length) {
      const names = successors.slice(-2).map(r => reference(r.id, Math.max(lastExile.month, r.accessionYear!), person(r))).join("、");
      // Insert before the dated terminal sentence, rather than after the end.
      const terminalIndex = selected.findIndex(x => x.order === 4);
      selected.splice(terminalIndex < 0 ? selected.length : terminalIndex, 0, { key: "exile-holders", month: end,
        order: 3, priority: 100, kind: "EXILE", text: `流亡期间，${names}${successors.length > 1 ? "先后" : ""}承统` });
    }
  }
  const actualHolders = new Set(phases.flatMap(p => p.rulerIds)).size;
  const transmission = phases.length > 1 ? `其间历${actualHolders}位统治者、${phases.length}段政治王统` : `此统先后历${actualHolders}位统治者`;
  const current = last?.currentRulerName ? c.dynasty?.rulers.find(r => last.rulerIds.includes(r.id) && person(r) === last.currentRulerName && ["ruling", "exiled"].includes(r.status) && r.endYear === undefined) : undefined;
  const currentName = current ? reference(current.id, end, person(current)) : undefined;
  const live = c.faction.status === "EXILED" ? `截至${date(end)}，${last?.houseName ?? "王统"}仍在流亡中延续${currentName ? `，由${currentName}承统` : ""}。` :
    `截至${date(end)}，${last?.houseName ?? "王统"}仍在延续${currentName ? `，当前由${currentName}承统` : ""}。`;
  const arguments_ = deriveChronicleArguments(fact, events, phases, end);
  const argument = arguments_[0];
  const tail = `${transmission}${fact.terminal ? "。" : `；${live}`}`;
  const paragraphs = composeChronicleParagraphs(selected, people.render, tail, argument?.text ?? "", fact.terminal);
  return { title: `《${fact.name}${fact.formal && !fact.name.endsWith("国") ? "国" : ""}史》`, range: `${date(fact.foundedMonth)}～${fact.terminal ? date(end) : "今"}`,
    paragraphs, eventIds: selected.map(x => x.key).filter(id => events.some(e => e.eventId === id)), phaseCount: phases.length,
    length: paragraphs.join("").length, argument };
}
