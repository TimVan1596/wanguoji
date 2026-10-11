import { hasRecordedRulerDeath } from "../Politics/RulerLifeState";
import type { Dynasty, Ruler } from "../Politics/Dynasty";
import type { DynastyHouseEpoch } from "../Politics/DynasticRevolution";
import { getFormalRulers } from "../Politics/RulerPresentationRules";
import type { HistoryFactionLike } from "../History/HistoryRenderRules";
import type { WorldEvent } from "../History/WorldHistory";
import { getHistoricalFactionIdentity } from "../History/HistoricalFactionIdentity";
import { getRulerTerminalRole } from "../History/PoliticalTerminalChronicle";
import { formatWorldDate } from "../Simulation/WorldTime";

export interface HouseHistoricalFaction extends HistoryFactionLike {
  status: string;
  terminationMonth?: number;
  extinctionYear?: number;
  terminationReason?: "EXTINCT" | "MERGED" | "SUBMITTED";
}
export interface HouseMilestone { eventId: string; month: number; type: WorldEvent["type"]; rulerId?: string; cityName?: string; historyGroupId?: string; text: string }
export interface HouseAssessment {
  key: string; factionId: string; houseName: string; startMonth: number; endMonth?: number;
  transitionMonth?: number;
  status: "CONTINUING" | "EXILED" | "REPLACED" | "EXTINCT" | "MERGED" | "SUBMITTED" | "ENDED";
  founderId?: string; founderName?: string; currentRulerName?: string; terminalRulerName?: string; terminalDeathSameMonth?: boolean;
  rulerIds: string[]; rulerCount: number; formalRulerCount: number; stateFoundedMonth?: number;
  usurpationProven: boolean;
  startReason: DynastyHouseEpoch["startReason"]; milestones: HouseMilestone[];
  assessment: string[]; voice: string;
}
export interface HouseHistoryContext {
  dynasty: Pick<Dynasty, "houseEpochs" | "rulers" | "currentRulerId" | "factionId">;
  faction: HouseHistoricalFaction; factions: ReadonlyMap<string, HistoryFactionLike>;
  events: readonly WorldEvent[]; worldMonth: number;
}
const TYPES = new Set<WorldEvent["type"]>(["state-founded", "emperor-proclaimed", "world-unification",
  "dynasty-usurped", "capital-fallen", "capital-relocated", "faction-exiled", "faction-restored",
  "faction-extinct", "faction-merged", "faction-submitted"]);
const priority = (type: WorldEvent["type"]) => type === "dynasty-usurped" || type === "world-unification" ? 100 :
  ["faction-extinct", "faction-submitted", "faction-merged", "faction-exiled", "faction-restored", "emperor-proclaimed"].includes(type) ? 90 : type === "state-founded" ? 85 : 50;
const str = (e: WorldEvent, key: string) => typeof e.metadata?.[key] === "string" ? e.metadata[key] as string : undefined;
const person = (r: Ruler) => `${r.houseName.replace(/氏$/, "")}${r.givenName}`;

/** One faction's indexed events only. No lifetime peaks, simulation mutation or RNG. */
export function deriveHouseAssessments(c: HouseHistoryContext): HouseAssessment[] {
  const epochs = [...(c.dynasty.houseEpochs ?? [])].sort((a, b) => a.startMonth - b.startMonth ||
    (c.dynasty.rulers.find(r => r.id === a.foundingRulerId)?.reignOrdinal ?? 0) -
    (c.dynasty.rulers.find(r => r.id === b.foundingRulerId)?.reignOrdinal ?? 0));
  const rulers = getFormalRulers(c.dynasty.rulers);
  const byId = new Map(rulers.map(r => [r.id, r]));
  const terminalMonth = c.faction.status === "EXTINCT" ? c.faction.terminationMonth ?? c.faction.extinctionYear : undefined;
  const limit = Math.min(c.worldMonth, terminalMonth ?? c.worldMonth);
  const name = (id: string, month: number) => {
    const f = c.factions.get(id) ?? (id === c.faction.name ? c.faction : undefined);
    return f ? getHistoricalFactionIdentity(f, month).name : id;
  };
  const phases = epochs.map((epoch, i): HouseAssessment => {
    const next = epochs[i + 1];
    const end = next ? epoch.endMonth ?? next.startMonth : terminalMonth ?? epoch.endMonth;
    const recordedFounder = byId.get(epoch.foundingRulerId);
    const founder = recordedFounder && recordedFounder.houseName === epoch.houseName && recordedFounder.accessionYear <= epoch.startMonth &&
      (recordedFounder.endYear ?? limit) >= epoch.startMonth ? recordedFounder : undefined;
    // Count actual holders of this political phase. At a same-month succession,
    // the recorded founder/ordinal owns the new phase; a former ruler is not counted twice.
    const members = rulers.filter(r => {
      if (r.houseName !== epoch.houseName || r.accessionYear > (end ?? limit) || (r.endYear ?? limit) < epoch.startMonth) return false;
      if (r.endYear === epoch.startMonth && r.id !== epoch.foundingRulerId) return false;
      if (founder && r.accessionYear === epoch.startMonth && r.reignOrdinal < founder.reignOrdinal) return false;
      if (next && r.accessionYear === next.startMonth) {
        const nextFounder = byId.get(next.foundingRulerId);
        if (nextFounder && r.reignOrdinal >= nextFounder.reignOrdinal) return false;
      }
      return true;
    });
    const status: HouseAssessment["status"] = next ? "REPLACED" : terminalMonth !== undefined ? c.faction.terminationReason ?? "EXTINCT" :
      epoch.endMonth !== undefined || c.faction.status === "EXTINCT" ? "ENDED" : c.faction.status === "EXILED" ? "EXILED" : "CONTINUING";
    const terminalRuler = terminalMonth === undefined ? undefined : [...members].sort((a, b) => b.reignOrdinal - a.reignOrdinal).find(r => r.endYear === terminalMonth);
    const current = members.find(r => r.id === c.dynasty.currentRulerId);
    return { key: `${c.dynasty.factionId}:${epoch.startMonth}:${epoch.foundingRulerId}:${i}`,
      factionId: c.dynasty.factionId, houseName: epoch.houseName, startMonth: epoch.startMonth, endMonth: end,
      status, transitionMonth: next?.startMonth, founderId: founder?.id, founderName: founder ? person(founder) : undefined,
      currentRulerName: current ? person(current) : undefined, terminalRulerName: terminalRuler ? person(terminalRuler) : undefined,
      terminalDeathSameMonth: terminalRuler ? hasRecordedRulerDeath(terminalRuler) && terminalRuler.deathMonth === terminalMonth : false, rulerIds: members.map(r => r.id), rulerCount: members.length,
      formalRulerCount: c.faction.stateFoundedMonth === undefined ? 0 : members.filter(r =>
        (r.endYear ?? limit) >= c.faction.stateFoundedMonth! && (end ?? limit) >= c.faction.stateFoundedMonth!).length,
      stateFoundedMonth: c.faction.stateFoundedMonth, usurpationProven: epoch.startReason === "USURPATION" && founder?.relationType === "USURPER", startReason: epoch.startReason, milestones: [], assessment: [], voice: "" };
  });
  // Binary month lookup avoids scanning all epochs for every historical event.
  const phaseAt = (month: number) => {
    let lo = 0, hi = epochs.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (epochs[mid].startMonth <= month) lo = mid + 1; else hi = mid; }
    return lo - 1;
  };
  const rulerPhases = new Map<string, number[]>();
  phases.forEach((p, i) => p.rulerIds.forEach(id => rulerPhases.set(id, [...(rulerPhases.get(id) ?? []), i])));
  const seen = new Set<string>();
  for (const e of c.events) {
    const month = e.monthIndex ?? e.year;
    const evidenceKey = `${e.type}:${e.historyGroupId ?? e.id}`;
    if (!TYPES.has(e.type) || month > limit || seen.has(evidenceKey)) continue;
    let source = e.actorFactionId === c.faction.name;
    let target = e.targetFactionId === c.faction.name;
    if (e.type === "faction-merged") source = (str(e, "absorbedFactionId") ?? e.actorFactionId) === c.faction.name;
    if (e.type === "faction-submitted") source = (str(e, "submittedFactionId") ?? e.actorFactionId) === c.faction.name;
    const defensive = ["capital-fallen", "faction-exiled", "faction-extinct"].includes(e.type);
    if (defensive ? !target : !source) continue;
    const recordedId = e.type === "faction-merged" ? str(e, "absorbedRulerId") : e.type === "faction-submitted" ? str(e, "submittedRulerId") :
      !defensive ? e.rulerId ?? str(e, "rulerId") : undefined;
    const actor = recordedId ? byId.get(recordedId) : undefined;
    const verified = actor && actor.accessionYear <= month && (actor.endYear ?? limit) >= month ? actor : undefined;
    // An explicit foreign/wrong-tenure person cannot be backfilled with today's ruler.
    if (recordedId && !verified) continue;
    let index = phaseAt(month);
    if (verified) {
      const matching = (rulerPhases.get(verified.id) ?? []).filter(i => phases[i].startMonth <= month);
      if (!matching.length) continue;
      index = matching.at(-1)!;
    }
    if (index < 0) continue;
    const p = phases[index];
    if (month > (p.endMonth ?? limit) && (!verified || month !== verified.endYear || month !== epochs[index + 1]?.startMonth)) continue;
    if (e.type === "dynasty-usurped" && (p.startReason !== "USURPATION" || !verified || verified.id !== p.founderId)) continue;
    const own = name(c.faction.name, month), city = e.cityName ?? str(e, "cityName");
    const who = verified ? person(verified) : undefined;
    let text: string;
    switch (e.type) {
      case "state-founded": text = `${who ? `${who}在位时，` : ""}${own}正式建国`; break;
      case "emperor-proclaimed": text = `${who ?? own}称帝`; break;
      case "world-unification": text = `${own}完成天下统一${who ? `，当时由${who}承统` : ""}`; break;
      case "dynasty-usurped": p.usurpationProven = true; text = `${who ?? p.houseName}篡朝接掌王统`; break;
      case "capital-relocated": text = `${own}${city ? `迁都${city}` : "迁都"}`; break;
      case "capital-fallen": text = `${own}${city ? `都城${city}` : "都城"}失守`; break;
      case "faction-exiled": text = `${own}失去最后据点${city ? `（${city}）` : ""}，王室流亡`; break;
      case "faction-restored": text = `${own}${city ? `于${city}` : ""}复国`; break;
      case "faction-extinct": text = `${own}政治王统最终终结`; break;
      default: {
        if (verified && getRulerTerminalRole(e, verified, c.faction.name) !== "SOURCE") continue;
        const receiving = e.type === "faction-merged" ? str(e, "absorbingFactionId") ?? e.targetFactionId : str(e, "receivingFactionId") ?? e.targetFactionId;
        text = e.type === "faction-merged" ? `${own}并入${receiving ? name(receiving, month) : "接受国"}（同源合邦）` :
          `${own}纳土归附${receiving ? name(receiving, month) : "接受国"}`;
      }
    }
    seen.add(evidenceKey);
    p.milestones.push({ eventId: e.id, month, type: e.type, rulerId: verified?.id, cityName: city, historyGroupId: e.historyGroupId, text });
  }
  return phases.map((p, i) => {
    const exileCount = p.milestones.filter(m => m.type === "faction-exiled").length;
    const restorationCount = p.milestones.filter(m => m.type === "faction-restored").length;
    // Keep a bounded representative chain, with an origin and final turning point.
    const important = [...p.milestones].sort((a, b) => priority(b.type) - priority(a.type) || a.month - b.month || a.eventId.localeCompare(b.eventId));
    const selected: HouseMilestone[] = [];
    const types = new Set<string>();
    for (const m of important) {
      const sameFall = m.type === "capital-fallen" && selected.some(x => x.type === "faction-exiled" && x.month === m.month && m.historyGroupId && x.historyGroupId === m.historyGroupId);
      if (!sameFall && !types.has(m.type) && selected.length < 3) { selected.push(m); types.add(m.type); }
    }
    p.milestones = selected.sort((a, b) => a.month - b.month || a.eventId.localeCompare(b.eventId));
    const opening = p.usurpationProven ? "以篡朝开启此段王统" : p.startReason === "NATURAL_HOUSE_SUCCESSION" ? "自然易姓，国家建制延续" :
      p.startReason === "RESTORATION" ? "以复国开启新的政治阶段，并非据此另造宗族" : "开启这段政治王统";
    p.assessment.push(`${formatWorldDate(p.startMonth)}，${p.founderName ?? p.houseName}${opening}；本阶段历${p.rulerCount}位实际统治者${p.formalRulerCount ? `，其中${p.formalRulerCount}位任期涉及正式国家时期` : "；本阶段没有正式国家时期的君主记录"}${exileCount > 1 || restorationCount > 1 ? `，其间流亡${exileCount}次、复国${restorationCount}次` : ""}。`);
    if (p.milestones.length) p.assessment.push(p.milestones.map(m => `${formatWorldDate(m.month)}，${m.text}`).join("；") + "。");
    const next = phases[i + 1];
    const ending = p.status === "REPLACED" ? `随后由${next.houseName}开启新阶段${next.usurpationProven ? "，新阶段明确起于篡朝夺统" : ""}，国家历史并未因此终止。` : p.status === "MERGED" ? "独立统治以同源合邦结束，末君的行政退位不等于死亡。" :
      p.status === "SUBMITTED" ? "独立统治以和平纳土结束，退位与人物死亡分别记载。" : p.status === "EXTINCT" ? `本阶段止于国家政治终结${p.terminalDeathSameMonth ? `；${p.terminalRulerName}的实际死亡另载于同月` : ""}，不据此推定宗亲全部死亡。` :
      p.status === "EXILED" ? "当前仍在流亡中承统，尚不能作最终结语。" : p.status === "CONTINUING" ? `当前王统仍在延续${p.currentRulerName ? `，由${p.currentRulerName}承统` : ""}。` : "此段政治阶段已经结束，后续结局史料不足。";
    p.assessment.push(ending);
    const exile = exileCount > 0;
    const exileCity = p.milestones.find(m => m.type === "faction-exiled")?.cityName;
    const restored = restorationCount > 0 || p.startReason === "RESTORATION";
    p.voice = p.status === "MERGED" ? ` ${p.houseName}的独立传承止于同源合邦；政权合流，旧王统的经历仍留在一国史中。`.trim() :
      p.status === "SUBMITTED" ? `${p.houseName}以和平纳土收束独立统治；末君退位，旧王室的经历并不因此抹去。` :
      restored && exile ? `${p.houseName}曾失城土而复续在国统治，流亡与复国成为政治传承中的两段处境。` :
      p.usurpationProven ? "新姓取代旧统，夺统之事有载；其后兴亡，不能仅凭开端便定因果。" :
      p.status === "REPLACED" ? `${p.houseName}的政治传承转入${next.houseName}的新阶段；旧统已终，国家却仍相续。` :
      exile && p.status === "EXTINCT" ? `${p.houseName}${p.rulerCount > 1 ? "历君相续，" : "承统，"}${exileCity ? `至${exileCity}失守，` : "城土尽失后，"}流亡之统犹续；至政治终结，传承的终点不等于宗族的尽灭。` :
      p.status === "CONTINUING" || p.status === "EXILED" ? "传承仍在继续，已有事迹可论，未至之结局不可预书。" :
      p.rulerCount > 1 ? "诸君先后承接的是同一段政治王统，功业与转折各有其人，不应尽归于末主。" : "此段王统所见事迹有限，政治任期的终结与人物生死仍须分辨。";
    return p;
  });
}
