import type { WorldEvent, WorldEventType } from "../History/WorldHistory";
import type { Ruler } from "../Politics/Dynasty";
import type { FactionHistoricalEvidence, FactionHistoryContext } from "./FactionHistoriography";
import { getFactionDisplayNameAtMonth } from "../Simulation/FactionIdentity";
import { formatWorldDate, formatWorldDuration } from "../Simulation/WorldTime";

export type NarrativeRole = "ACTOR" | "TARGET" | "CONQUEROR" | "SUBMITTED" | "RECEIVING" | "ABSORBED";
export interface FactionNarrativeEvidence {
  eventId: string; month: number; type: WorldEventType; factionId: string; factionRole: NarrativeRole;
  factionName: string; cityId?: string; cityName?: string; rulerId?: string; rulerName?: string;
  actorName?: string; targetName?: string; actorFactionId?: string; targetFactionId?: string; conquerorFactionId?: string; historyGroupId?: string;
  metadata: Readonly<NonNullable<WorldEvent["metadata"]>>;
}
const RELEVANT = new Set<WorldEventType>(["world-born", "rebel-faction-founded", "frontier-faction-founded", "empire-split", "state-founded", "emperor-proclaimed", "world-unification", "world-hegemony", "dynasty-usurped", "capital-fallen", "capital-relocated", "city-captured", "city-recovered", "faction-exiled", "faction-restored", "dynasty-restored", "faction-merged", "faction-submitted", "dynasty-line-ended", "faction-extinct"]);
const str = (event: WorldEvent, key: string) => typeof event.metadata?.[key] === "string" ? event.metadata[key] as string : undefined;

// A related-faction index is a query accelerator, never evidence of who acted.
export function collectFactionNarrativeEvidence(c: FactionHistoryContext): FactionNarrativeEvidence[] {
  const id = c.faction.name;
  const name = (factionId: string | undefined, month: number) => {
    if (!factionId) return undefined;
    const f = c.factions.get(factionId);
    return f ? getFactionDisplayNameAtMonth(f, month) : undefined;
  };
  const ownRulers = new Map(c.dynasty?.rulers.map(r => [r.id, r]) ?? []);
  const seen = new Set<string>();
  const result: FactionNarrativeEvidence[] = [];
  for (const event of c.events) {
    const month = event.monthIndex ?? event.year;
    if (!RELEVANT.has(event.type) || seen.has(event.id) || month > (c.lifetime.terminal?.month ?? c.lifetime.lastObservedMonth)) continue;
    let role: NarrativeRole | undefined;
    if (event.type === "faction-submitted") {
      if ((str(event, "submittedFactionId") ?? event.actorFactionId) === id) role = "SUBMITTED";
      else if (str(event, "receivingFactionId") === id || event.targetFactionId === id) role = "RECEIVING";
    } else if (event.type === "faction-merged") {
      if (str(event, "absorbedFactionId") === id) role = "ABSORBED";
      else if (str(event, "absorbingFactionId") === id || event.actorFactionId === id) role = "RECEIVING";
    } else if (event.targetFactionId === id || event.previousOwnerFactionId === id) role = "TARGET";
    else if (event.actorFactionId === id) role = "ACTOR";
    else if (event.conquerorFactionId === id) role = "CONQUEROR";
    // world-born is explicit evidence of initial participants, not a war role.
    else if (event.type === "world-born" && event.factionIds?.includes(id)) role = "ACTOR";
    if (!role) continue;
    const rulerId = event.rulerId ?? str(event, "rulerId") ??
      (role === "SUBMITTED" ? str(event, "submittedRulerId") : role === "RECEIVING" ? str(event, "receivingRulerId") : undefined);
    const rulerFactionId = (event.type === "city-captured" || event.type === "capital-fallen")
      ? event.actorFactionId ?? event.conquerorFactionId : id;
    const ruler: Ruler | undefined = rulerId && rulerFactionId ? (rulerFactionId === id
      ? ownRulers.get(rulerId) : c.resolveRuler?.(rulerId, rulerFactionId)) : undefined;
    // Use only a documented ID belonging to the acting faction, during its real reign.
    const inReign = ruler && ruler.id === rulerId && ruler.accessionYear !== undefined && ruler.accessionYear <= month && (ruler.endYear === undefined || ruler.endYear >= month);
    const rulerFaction = rulerFactionId ? c.factions.get(rulerFactionId) : undefined;
    const rank = rulerFaction?.sovereigntyHistory.slice().reverse().find(h => h.startMonth <= month && (h.endMonth === undefined || month <= h.endMonth))?.rank;
    const rulerName = inReign ? `${name(rulerFactionId, month) ?? ""}${rank === "EMPEROR" ? "帝" : rank === "KING" ? "王" : rank === "LEADER" ? "首领" : ""}${ruler!.houseName.replace(/氏$/, "")}${ruler!.givenName}` : undefined;
    result.push({ eventId: event.id, month, type: event.type, factionId: id, factionRole: role,
      factionName: name(id, month)!, cityId: event.cityId ?? str(event, "cityId"), cityName: event.cityName ?? str(event, "cityName"),
      rulerId, rulerName, actorFactionId: event.actorFactionId, targetFactionId: event.targetFactionId, conquerorFactionId: event.conquerorFactionId, actorName: name(event.actorFactionId ?? event.conquerorFactionId, month), targetName: name(event.targetFactionId, month),
      historyGroupId: event.historyGroupId, metadata: { ...event.metadata } });
    seen.add(event.id);
  }
  return result.sort((a, b) => a.month - b.month || a.eventId.localeCompare(b.eventId));
}

function lastLoss(events: readonly FactionNarrativeEvidence[]) {
  const loss = [...events].reverse().find(e => e.type === "faction-exiled" && e.factionRole === "TARGET");
  if (!loss || events.some(e => e.month > loss.month && (e.type === "faction-restored" || e.type === "dynasty-restored") && e.factionRole === "ACTOR")) return undefined;
  const capture = events.find(e => (e.type === "capital-fallen" || e.type === "city-captured") && e.factionRole === "TARGET" && e.month === loss.month &&
    ((loss.historyGroupId && loss.historyGroupId === e.historyGroupId) || (loss.cityId && loss.cityId === e.cityId)));
  return { loss, capture };
}
function turnText(e: FactionNarrativeEvidence): string | undefined {
  const date = formatWorldDate(e.month), name = e.factionName;
  if (e.type === "dynasty-usurped" && e.factionRole === "ACTOR") {
    const old = e.metadata.oldHouseName, next = e.metadata.newHouseName;
    return typeof old === "string" && typeof next === "string" ? `${date}，${name}王统由${old}转入${next}，发生篡朝` : `${date}，${name}发生王统易代`;
  }
  if ((e.type === "capital-fallen" || e.type === "city-captured" && e.metadata.wasCapital === 1) && (e.factionRole === "ACTOR" || e.factionRole === "CONQUEROR") && e.cityName)
    return `${date}，${e.rulerName ? `${e.rulerName}亲征，` : ""}${name}攻陷${e.targetName ? `${e.targetName}都` : ""}${e.cityName}`;
  if (e.type === "capital-fallen" && e.factionRole === "TARGET" && e.cityName)
    return `${date}，${e.rulerName ? `${e.rulerName}亲征，` : ""}${e.actorName ? `${e.actorName}攻陷` : "失守之都为"}${e.actorName ? `${name}都` : ""}${e.cityName}`;
  if (e.type === "capital-relocated" && e.factionRole === "ACTOR")
    return `${date}，${name}${typeof e.metadata.previousCapitalName === "string" ? `自${e.metadata.previousCapitalName}` : ""}迁都${e.metadata.newCapitalName ?? e.cityName ?? "新都"}`;
  if ((e.type === "faction-restored" || e.type === "dynasty-restored") && e.factionRole === "ACTOR")
    return `${date}，${name}${e.cityName ? `在${e.cityName}` : ""}${e.type === "faction-restored" ? "复国" : "王室还都"}`;
  return undefined;
}
export function buildFactionHistoricalNarrative(e: FactionHistoricalEvidence, events: readonly FactionNarrativeEvidence[]) {
  const date = formatWorldDate, duration = formatWorldDuration;
  const foundedName = e.foundedName;
  const foundation = events.find(x => x.type === "state-founded" && x.factionRole === "ACTOR");
  const narrative = [`${date(e.foundedMonth)}，${foundedName ?? e.name}势力建立${e.formal ? `；${date(e.stateFoundedMonth!)}${e.stateFoundedName ?? ""}正式建国${foundation?.rulerName ? `，${foundation.rulerName}在位` : ""}` : "，终未正式建国"}。`];
  if (e.lifetime.peakTerritoryBlocks.value > 0) narrative.push(`${date(e.lifetime.peakTerritoryBlocks.month)}，疆域达到${e.lifetime.peakTerritoryBlocks.source === "MONTHLY" ? "月度记录" : "终结前观测"}峰值${e.lifetime.peakTerritoryBlocks.value}格，占世界${(e.peakAbsoluteWorldShare * 100).toFixed(1)}%${e.lifetime.peakCityCount.value > 1 ? `；${date(e.lifetime.peakCityCount.month)}，城市最多${e.lifetime.peakCityCount.value}座` : ""}。`);
  const landmark = ["world-unification", "world-hegemony", "emperor-proclaimed"].map(type => events.find(x => x.type === type && x.factionRole === "ACTOR")).find(Boolean);
  if (landmark) narrative.push(`${date(landmark.month)}，${landmark.type === "world-unification" ? `${landmark.factionName}统一天下` : landmark.type === "world-hegemony" ? `${landmark.factionName}确立天下霸权` : `${landmark.rulerName ?? `${landmark.factionName}在位君主`}称帝`}。`);
  const finalLoss = e.ending === "EXTINCT" ? lastLoss(events) : undefined;
  const turning = events.filter(x => turnText(x) && (!finalLoss || x !== finalLoss.capture) && x.month < e.endMonth!);
  // Prefer real political turning points; cap text independently of archive size.
  const selected = turning.filter(x => x.type === "dynasty-usurped" || x.type === "faction-restored");
  if (selected.length === 0 && turning.length) selected.push(turning[turning.length - 1]);
  const seenGroups = new Set<string>();
  const turnLimit = Math.max(0, 5 - narrative.length - (finalLoss ? 1 : 0));
  for (const turn of turnLimit ? selected.slice(-turnLimit) : []) {
    const key = turn.historyGroupId ?? turn.eventId;
    if (!seenGroups.has(key)) { narrative.push(`${turnText(turn)}。`); seenGroups.add(key); }
  }
  let lossText: string | undefined;
  if (finalLoss) {
    const { loss, capture } = finalLoss;
    const city = loss.cityName ?? capture?.cityName;
    lossText = `${date(loss.month)}，${capture?.rulerName ? `${capture.rulerName}亲征，` : ""}${capture?.actorName ?? loss.actorName ?? ""}${capture?.actorName || loss.actorName ? `攻陷${city ?? "最后据点"}，` : city ? `${city}失陷，` : ""}${loss.factionName}失去最后据点，王室流亡`;
    narrative.push(`${lossText}。`);
  }
  const lineEnded = events.find(x => x.type === "dynasty-line-ended" && x.month === e.endMonth);
  const end = e.ending === "SUBMITTED" ? `${e.name}纳土归附${e.targetName ?? "接受国"}，末代统治者退位，独立建制终止`
    : e.ending === "MERGED" ? `${e.name}与${e.targetName ?? "同源政权"}合邦，末代统治者退位，独立建制终止`
    : `${lineEnded || e.remnantsDissipated ? `${e.name}王统断绝，` : ""}${e.remnantsDissipated ? "残部消散，" : ""}政权彻底终结`;
  const exileGap = finalLoss ? Math.max(0, e.endMonth! - finalLoss.loss.month) : undefined;
  narrative.push(`${date(e.endMonth!)}，${end}${exileGap ? `；距最后失国已${duration(exileGap)}` : ""}。`);
  let judgment: string;
  if (e.ending === "SUBMITTED") judgment = `以和平纳土结束独立建制，${e.name}的末代统治者退位，国土转入接受国。`;
  else if (e.ending === "MERGED") judgment = `归入同源政权，${e.name}的独立建制止于合邦。`;
  else if (finalLoss && e.peakAbsoluteWorldShare >= 0.5) judgment = `曾据世界过半疆土，终失${finalLoss.loss.cityName ?? finalLoss.capture?.cityName ?? "最后据点"}；盛时版图与失国后的流亡相映，国势折转尤深。`;
  else if (finalLoss && !exileGap) judgment = `最后据点失守，流亡与政权终结均记于${date(e.endMonth!)}。`;
  else if (finalLoss) judgment = `${finalLoss.loss.cityName ?? finalLoss.capture?.cityName ?? "最后据点"}失陷后，国土尽失而政权未即终结${exileGap ? `，流亡延续${duration(exileGap)}` : ""}。`;
  else if (e.restorationCount >= 2) judgment = `复国${e.restorationCount}次，失而复得是其国史的反复。`;
  else if (e.houseCount > 1) judgment = `历${e.houseCount}姓王统${e.usurpationCount ? `，其中篡朝${e.usurpationCount}次` : "，未见篡朝记录"}，一家兴替未截断同一势力的历史。`;
  else if (landmark) judgment = `曾${landmark.type === "world-unification" ? "统一天下" : landmark.type === "world-hegemony" ? "确立霸权" : "称帝"}，终局与盛时须并观。`;
  else judgment = `${e.formal ? `正式国祚${duration(e.formalMonths!)}，历${e.formalRulerCount}君` : `势力历时${duration(e.lifetimeMonths)}，未及正式建国`}，至${date(e.endMonth!)}终结。`;
  const houseVoice = e.houseCount > 1 ? `历${e.houseCount}姓${e.usurpationCount ? `，王统间有${e.usurpationCount}次篡夺` : "，王统虽更，国史相续"}。` : "";
  let voice = finalLoss && !exileGap ? `${e.peakAbsoluteWorldShare >= 0.5 ? "盛时据世界过半，" : ""}${finalLoss.loss.cityName ?? finalLoss.capture?.cityName ?? "最后据点"}一失，城土不存，同月政权亦终。`
    : finalLoss ? `${e.peakAbsoluteWorldShare >= 0.5 ? "盛时据世界过半，" : ""}${finalLoss.loss.cityName ?? finalLoss.capture?.cityName ?? "最后据点"}一失，城土不存，政权犹续${exileGap ? duration(exileGap) : "于流亡"}。${lineEnded || e.remnantsDissipated ? "失国之日，非绝统之时。" : "失国与终结，原非同日。"}`
    : e.ending === "SUBMITTED" ? `终其独立建制，纳土而退位；土地转属${e.targetName ?? "接受国"}，未以兵戈绝其王室。`
    : e.ending === "MERGED" ? `同源而分，终以合邦归于一体；所终者为独立建制。`
    : e.restorationCount >= 2 ? `城池数失，国统数续；${e.restorationCount}次复国，所得亦曾再失。`
    : e.lifetimeMonths <= 60 && !e.formal ? "骤起而骤终，未及成国，兴亡已见。"
    : landmark ? `${landmark.type === "world-unification" ? "一统之势" : landmark.type === "world-hegemony" ? "霸业" : "帝制"}曾立，终局仍至；盛时之名，未使其建制长存。`
    : `${e.formal ? `历${e.formalRulerCount}君，国祚${duration(e.formalMonths!)}` : `未及成国，势力历${duration(e.lifetimeMonths)}`}，独立建制至此而终。`;
  voice = `${houseVoice}${voice}${!finalLoss && e.ending === "EXTINCT" && e.remnantsDissipated ? "残部消散，王统至此而绝。" : ""}`;
  const coreSummary = `${e.formal ? `${e.name}正式国祚${duration(e.formalMonths!)}，历${e.formalRulerCount}君` : `${e.name}势力历时${duration(e.lifetimeMonths)}，历${e.rulerCount}位首领`}。`;
  return { narrative, lines: [judgment, `${date(e.endMonth!)}，${end}。`], voice,
    summary: `${coreSummary}${lossText ? `${lossText}；${date(e.endMonth!)}终结${exileGap ? `，相隔${duration(exileGap)}` : ""}。` : `${date(e.endMonth!)}，${end}。`}` };
}
